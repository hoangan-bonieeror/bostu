#!/usr/bin/env node
// Tech Radar bot — finds new backend technologies/techniques and publishes a bilingual blog post.
//
// Usage:
//   node scripts/tech-radar/index.mjs                 # fetch live data and write the post
//   node scripts/tech-radar/index.mjs --dry-run       # print a summary, write nothing
//   node scripts/tech-radar/index.mjs --days=14       # look further back
//   node scripts/tech-radar/index.mjs --save-fixture=radar.json   # also save raw data
//   node scripts/tech-radar/index.mjs --fixture=radar.json        # offline: reuse saved data
//   node scripts/tech-radar/index.mjs --no-crawl                  # skip reading the linked articles
//   node scripts/tech-radar/index.mjs --ignore-seen               # rebuild: allow already-published links
//
// Env: GITHUB_TOKEN (recommended, higher rate limits), GEMINI_API_KEY (optional AI summaries),
//      GEMINI_MODEL (optional, Gemini model id; default gemini-flash-latest).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiStatus, summarize } from './ai.mjs';
import { crawlAll } from './crawl.mjs';
import { pickHighlights, rank } from './classify.mjs';
import { CATEGORIES, LIMITS, WINDOW_DAYS } from './config.mjs';
import { renderCover } from './cover.mjs';
import { postMeta, renderPost } from './render.mjs';
import { SOURCES } from './sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const content = join(root, 'public', 'content');
const SEEN_FILE = join(here, 'seen.json');
const RADAR_SKILL = 'tech-radar';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const days = Math.min(60, Number(args.days) || Number(process.env.RADAR_DAYS) || WINDOW_DAYS);
const dryRun = !!args['dry-run'];
// Rebuild mode: ignore seen.json so items already published can be picked again
// (e.g. to regenerate today's post after improving the bot). Same-day post is replaced.
const ignoreSeen = !!args['ignore-seen'];

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((t - yearStart) / 864e5 + 1) / 7), year: t.getUTCFullYear() };
}
const ymd = (d) => d.toISOString().slice(0, 10);

/**
 * Records what the last run did, so the app (and the Actions summary) can show whether
 * the bot is fetching data even in weeks when nothing new gets published.
 */
function writeStatus(results, { published = 0, relevant = 0, postId = null, crawl = null }) {
  const status = {
    lastRun: new Date().toISOString(),
    days,
    sources: results.map((r) => ({
      id: r.id,
      name: r.name,
      ok: r.ok,
      fetched: r.items.length,
      error: r.error ?? null,
    })),
    relevant,
    published,
    postId,
    crawl,
    ai: { ...aiStatus, enabled: !!process.env.GEMINI_API_KEY },
  };
  if (!dryRun)
    writeFileSync(join(content, 'radar-status.json'), JSON.stringify(status, null, 2) + '\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = status.sources
      .map(
        (s) =>
          `| ${s.ok ? '✅' : '❌'} ${s.name} | ${s.fetched} | ${s.error ? s.error.replace(/\|/g, '/') : ''} |`,
      )
      .join('\n');
    const summary = [
      '## 📡 Tech Radar run',
      '',
      '| Source | Fetched | Error |',
      '|---|---:|---|',
      rows,
      '',
      `- Relevant new items after filtering: **${relevant}**`,
      `- Published: **${published}** ${postId ? `→ \`${postId}\`` : '(no new post)'}`,
      crawl
        ? `- Articles crawled: **${crawl.ok}/${crawl.attempted}** ok, ${crawl.failed} failed, ${crawl.robots} blocked by robots.txt`
        : '- Articles crawled: skipped',
      `- Gemini summaries: ${!status.ai.enabled ? 'off (no GEMINI_API_KEY)' : status.ai.ok ? `✅ ${status.ai.summarized} items (${status.ai.model})` : `❌ ${status.ai.error ?? 'not called'}`}`,
      '',
    ].join('\n');
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
  }
}

async function collect() {
  if (args.fixture) {
    console.log(`📦 Using fixture ${args.fixture}`);
    return JSON.parse(readFileSync(args.fixture, 'utf8'));
  }
  const results = [];
  for (const s of SOURCES) {
    process.stdout.write(`🔎 ${s.name}… `);
    try {
      const items = await s.run({ days });
      console.log(`${items.length} items`);
      results.push({ id: s.id, name: s.name, ok: true, items });
    } catch (e) {
      console.log(`failed (${e.message})`);
      results.push({ id: s.id, name: s.name, ok: false, error: e.message, items: [] });
    }
  }
  if (args['save-fixture']) writeFileSync(args['save-fixture'], JSON.stringify(results, null, 2));
  return results;
}

async function main() {
  const dateArg = args.date || process.env.RADAR_DATE || '';
  if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) throw new Error(`Invalid date "${dateArg}" (expected YYYY-MM-DD)`);
  const now = dateArg ? new Date(`${dateArg}T12:00:00Z`) : new Date();
  const { week, year } = isoWeek(now);
  const to = ymd(now);
  const from = ymd(new Date(now.getTime() - days * 864e5));
  const id = `tech-radar-${to}`;

  const seen = existsSync(SEEN_FILE) ? JSON.parse(readFileSync(SEEN_FILE, 'utf8')) : { urls: [] };
  const seenUrls = ignoreSeen ? new Set() : new Set(seen.urls);
  if (ignoreSeen) console.log('♻️  --ignore-seen: previously published links may appear again');

  const results = await collect();
  const all = results
    .flatMap((r) => r.items)
    .filter(
      (it) =>
        !(
          it.source === 'release' && /alpha|beta|-rc|nightly|canary|preview/i.test(it.version ?? '')
        ),
    );
  const ranked = rank(all, seenUrls);

  const highlights = pickHighlights(ranked, LIMITS.highlights);
  const hlUrls = new Set(highlights.map((h) => h.url));
  const releases = ranked.filter((r) => r.source === 'release').slice(0, LIMITS.releases);
  const byCategory = {};
  for (const c of CATEGORIES) {
    byCategory[c.id] = ranked
      .filter((r) => r.category === c.id && r.source !== 'release' && !hlUrls.has(r.url))
      .slice(0, LIMITS.perCategory);
  }
  const published = [...highlights, ...releases, ...Object.values(byCategory).flat()];
  const counts = {};
  for (const it of published) counts[it.category] = (counts[it.category] ?? 0) + 1;

  if (!published.length) {
    console.log('😴 Nothing new found — no post written.');
    writeStatus(results, { relevant: ranked.length });
    return;
  }

  // Read what is inside each link (README, release notes, article text).
  let crawlStats = null;
  if (!args['no-crawl']) {
    process.stdout.write(`📖 Crawling ${published.length} links `);
    ({ stats: crawlStats } = await crawlAll(published));
    console.log(
      `   ${crawlStats.ok} ok, ${crawlStats.failed} failed, ${crawlStats.robots} blocked by robots.txt`,
    );
  }

  // Stable keys for the AI step. Highlights get more of the crawled text than list items.
  published.forEach((it, i) => (it.key = `i${i}`));
  const ai = await summarize(
    published.map((it) => ({
      key: it.key,
      title: it.title,
      description: it.description,
      source: it.source,
      category: it.category,
      version: it.version,
      highlight: hlUrls.has(it.url),
      content: it.crawl?.ok
        ? hlUrls.has(it.url)
          ? it.crawl.text
          : it.crawl.text.slice(0, 700)
        : '',
    })),
  );

  const skills = JSON.parse(readFileSync(join(content, 'skills.json'), 'utf8'));
  const skillTitle = (sid, lang) => skills.find((s) => s.id === sid)?.title?.[lang] ?? sid;

  const base = {
    week,
    year,
    sources: results.map((r) => ({
      name: r.name,
      count: published.filter((p) => p.source === r.id).length,
    })),
    failed: results.filter((r) => !r.ok).map((r) => r.name),
    highlights,
    releases,
    byCategory,
    counts,
    ai,
    skillTitle,
    shortDate: {
      vi: `${String(now.getUTCDate()).padStart(2, '0')}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      en: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    },
    maxActions: LIMITS.actions,
  };
  const vi = renderPost('vi', {
    ...base,
    dateLabel: now.toLocaleDateString('vi-VN', { timeZone: 'UTC' }),
  });
  const en = renderPost('en', {
    ...base,
    dateLabel: now.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' }),
  });
  const cover = renderCover({
    week,
    year,
    from,
    to,
    counts,
    items: published.filter((p) => p.source !== 'release'),
  });

  console.log(
    `\n📡 ${id}: ${published.length} items, ${highlights.length} highlights, ${releases.length} releases`,
  );
  for (const h of highlights)
    console.log(`   ★ [${h.category}] ${h.title} (${h.source}, score ${h.score})`);
  if (dryRun) {
    console.log('\n(dry run — nothing written)');
    return;
  }

  writeFileSync(join(content, 'lessons', `${id}.vi.md`), vi);
  writeFileSync(join(content, 'lessons', `${id}.en.md`), en);
  writeFileSync(join(content, 'covers', `${id}.svg`), cover);

  // Register the post: curriculum lessons first, then radar posts newest-first.
  const lessonsPath = join(content, 'lessons.json');
  const lessons = JSON.parse(readFileSync(lessonsPath, 'utf8')).filter((l) => l.id !== id);
  const words = vi.split(/\s+/).length;
  const metaVi = postMeta('vi', base);
  const metaEn = postMeta('en', base);
  const entry = {
    id,
    skill: RADAR_SKILL,
    minutes: Math.max(5, Math.round(words / 200)),
    date: to,
    title: { vi: metaVi.title, en: metaEn.title },
    summary: { vi: metaVi.summary, en: metaEn.summary },
  };
  const course = lessons.filter((l) => l.skill !== RADAR_SKILL);
  const radar = [entry, ...lessons.filter((l) => l.skill === RADAR_SKILL)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  writeFileSync(lessonsPath, JSON.stringify([...course, ...radar], null, 2) + '\n');

  // Remember what was published so next week's post shows new things.
  const urls = [...new Set([...published.map((p) => p.url), ...seen.urls])].slice(0, 2000);
  writeFileSync(SEEN_FILE, JSON.stringify({ updated: to, urls }, null, 2) + '\n');

  writeStatus(results, {
    relevant: ranked.length,
    published: published.length,
    postId: id,
    crawl: crawlStats,
  });
  console.log(`✅ Wrote lessons/${id}.{vi,en}.md, covers/${id}.svg and updated lessons.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
