#!/usr/bin/env node
// Daily tech-news bot — collects the day's technology news and publishes a bilingual digest post.
//
// Usage:
//   node scripts/tech-news/index.mjs                     # fetch live data and write today's post
//   node scripts/tech-news/index.mjs --dry-run           # print the selection, write nothing
//   node scripts/tech-news/index.mjs --hours=48          # look further back
//   node scripts/tech-news/index.mjs --date=2026-11-20   # post date (replaces that day's post)
//   node scripts/tech-news/index.mjs --ignore-seen       # rebuild: allow already-published links
//   node scripts/tech-news/index.mjs --no-crawl          # don't read the linked articles
//   node scripts/tech-news/index.mjs --save-fixture=news.json | --fixture=news.json
//
// Env: GEMINI_API_KEY (optional bilingual summaries), GEMINI_MODEL, GEMINI_FALLBACK_MODELS,
//      NEWS_DATE / NEWS_HOURS (same as the flags, used by the workflow),
//      NEWS_TIMEZONE (which calendar day "today" is; default America/Los_Angeles).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyFrontmatter } from '../lib/frontmatter.mjs';
import { aiStatus } from '../tech-radar/ai.mjs';
import { crawlAll } from '../tech-radar/crawl.mjs';
import { LIMITS, WINDOW_HOURS } from './config.mjs';
import { rank, select } from './rank.mjs';
import { renderNews, sectionTags, titleOf } from './render.mjs';
import { SOURCES } from './sources.mjs';
import { summarizeNews } from './summarize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const content = join(here, '..', '..', 'public', 'content');
const SEEN_FILE = join(here, 'seen.json');
const CATEGORY = 'tech-news';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const hours = Math.min(168, Number(args.hours) || Number(process.env.NEWS_HOURS) || WINDOW_HOURS);
const dryRun = !!args['dry-run'];
const ignoreSeen = !!args['ignore-seen'];
const tz = process.env.NEWS_TIMEZONE || 'America/Los_Angeles';

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

async function collect() {
  if (args.fixture) {
    console.log(`📦 Using fixture ${args.fixture}`);
    return JSON.parse(readFileSync(args.fixture, 'utf8'));
  }
  // Feeds are independent, so fetch them in parallel.
  const results = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const items = await s.run({ hours });
        return { id: s.id, name: s.name, ok: true, items };
      } catch (e) {
        return { id: s.id, name: s.name, ok: false, error: String(e.message ?? e), items: [] };
      }
    }),
  );
  for (const r of results)
    console.log(`🔎 ${r.name}: ${r.ok ? `${r.items.length} items` : `failed (${r.error})`}`);
  if (args['save-fixture']) writeFileSync(args['save-fixture'], JSON.stringify(results, null, 2));
  return results;
}

function summary(results, { selected, postId }) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = results
    .map(
      (r) =>
        `| ${r.ok ? '✅' : '❌'} ${r.name} | ${r.items.length} | ${(r.error ?? '').replace(/\|/g, '/')} |`,
    )
    .join('\n');
  const ai = !process.env.GEMINI_API_KEY
    ? 'off (no GEMINI_API_KEY)'
    : aiStatus.ok
      ? `✅ ${aiStatus.summarized} stories (${aiStatus.model})`
      : `❌ ${aiStatus.error ?? 'not called'}`;
  writeFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## 📰 Daily tech news',
      '',
      '| Source | Items | Error |',
      '|---|---:|---|',
      rows,
      '',
      `- Selected: **${selected}** ${postId ? `→ \`${postId}\`` : '(no post)'}`,
      `- Gemini: ${ai}`,
      '',
    ].join('\n'),
    { flag: 'a' },
  );
}

async function main() {
  const dateArg = args.date || process.env.NEWS_DATE || '';
  if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg))
    throw new Error(`Invalid date "${dateArg}" (expected YYYY-MM-DD)`);
  const today = dateArg || new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const id = `tech-news-${today}`;
  const dateObj = new Date(`${today}T12:00:00Z`);

  // One digest per day: a second run on the same day (a late scheduled run after a manual
  // one, say) would otherwise replace the post with only the stories not published yet.
  const postFile = join(content, 'posts', `${id}.vi.md`);
  if (existsSync(postFile) && !ignoreSeen && !dryRun) {
    console.log(`📰 ${id} already exists — skipping. Run with --ignore-seen to rebuild it.`);
    if (process.env.GITHUB_STEP_SUMMARY)
      writeFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## 📰 Daily tech news\n\n\`${id}\` already exists, nothing to do. Use **ignore_seen** to rebuild it.\n`,
        { flag: 'a' },
      );
    return;
  }

  const seen = existsSync(SEEN_FILE) ? JSON.parse(readFileSync(SEEN_FILE, 'utf8')) : { urls: [] };
  const seenSet = ignoreSeen ? new Set() : new Set(seen.urls);
  if (ignoreSeen) console.log('♻️  --ignore-seen: previously published links may appear again');

  const results = await collect();
  const ranked = rank(
    results.flatMap((r) => r.items),
    seenSet,
    Date.now(),
    hours,
  );
  const items = select(ranked);
  if (items.length < LIMITS.minItems) {
    console.log(`😴 Only ${items.length} new stories — no post today.`);
    summary(results, { selected: items.length });
    return;
  }
  items.forEach((it, i) => (it.k = `n${i}`));
  const headlines = items.slice(0, LIMITS.headlines);
  const headlineKeys = new Set(headlines.map((h) => h.k));

  if (!args['no-crawl']) {
    process.stdout.write(`📖 Reading ${items.length} articles `);
    const { stats } = await crawlAll(items);
    console.log(`   ${stats.ok} ok, ${stats.failed} failed, ${stats.robots} blocked by robots.txt`);
  }

  const ai = await summarizeNews(
    items.map((it) => ({
      key: it.k,
      title: it.title,
      description: it.description,
      source: it.sourceName,
      language: it.lang,
      headline: headlineKeys.has(it.k),
      content: it.crawl?.ok ? it.crawl.text.slice(0, headlineKeys.has(it.k) ? 3500 : 800) : '',
    })),
  );

  const okSources = results.filter((r) => r.ok && r.items.length).map((r) => r.name);
  const failed = results.filter((r) => !r.ok).map((r) => r.name);
  const labels = {
    vi: dateObj.toLocaleDateString('vi-VN', { timeZone: 'UTC' }),
    en: dateObj.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' }),
  };
  const body = (lang) =>
    renderNews(lang, { dateLabel: labels[lang], items, headlines, ai, sources: okSources, failed });

  console.log(`\n📰 ${id}: ${items.length} stories`);
  for (const it of items)
    console.log(
      `   ${headlineKeys.has(it.k) ? '★' : '·'} [${it.section}] ${it.title} (${it.sourceName}, ${it.score})`,
    );
  if (dryRun) return console.log('\n(dry run — nothing written)');

  const front = (lang) =>
    stringifyFrontmatter({
      title: lang === 'vi' ? `Bản tin công nghệ ${labels.vi}` : `Tech news · ${labels.en}`,
      summary: clip(headlines.map((h) => titleOf(h, lang, ai)).join(' · '), 220),
      date: today,
      category: CATEGORY,
      tags: ['tech-news', ...sectionTags(items).slice(0, 3)],
      type: 'news',
      author: 'Tech News Bot',
    });
  mkdirSync(join(content, 'posts'), { recursive: true });
  for (const lang of ['vi', 'en'])
    writeFileSync(join(content, 'posts', `${id}.${lang}.md`), `${front(lang)}\n${body(lang)}`);

  const urls = [...new Set([...items.map((it) => it.key), ...seen.urls])].slice(0, 4000);
  writeFileSync(SEEN_FILE, JSON.stringify({ updated: today, urls }, null, 2) + '\n');
  summary(results, { selected: items.length, postId: id });
  console.log(`✅ Wrote posts/${id}.{vi,en}.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
