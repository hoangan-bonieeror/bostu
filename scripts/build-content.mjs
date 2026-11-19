#!/usr/bin/env node
// Builds the blog index from Markdown posts and validates content.
//
// Input : public/content/posts/<id>.<vi|en>.md   (front matter + Markdown)
//         public/content/{categories,series,site}.json
// Output: public/content/generated/posts.json     (post index used by the app)
//         public/content/generated/search.<lang>.json (plain text for client-side search)
//         public/content/covers/auto/<id>.svg      (cover for posts without one)
//         public/feed.<lang>.xml                   (RSS)
//
// Runs automatically before `npm start` / `npm run build`. Exits 1 on content errors.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCover } from './lib/cover.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const content = join(pub, 'content');
const postsDir = join(content, 'posts');
const genDir = join(content, 'generated');
const autoCovers = join(content, 'covers', 'auto');
const LANGS = ['vi', 'en'];
const TYPES = ['article', 'note', 'radar'];

const readJson = (f) => JSON.parse(readFileSync(join(content, f), 'utf8'));
const categories = readJson('categories.json');
const series = readJson('series.json');
const site = readJson('site.json');
const catById = new Map(categories.map((c) => [c.id, c]));
const seriesIds = new Set(series.map((s) => s.id));

const errors = [];
const warnings = [];

/** Markdown → plain text (for search and word counts). */
function plain(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^>\s*\[![A-Z]+\]/gm, ' ')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function writeIfChanged(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file) && readFileSync(file, 'utf8') === data) return;
  writeFileSync(file, data);
}

// ---------- read posts ----------
const files = existsSync(postsDir) ? readdirSync(postsDir).filter((f) => f.endsWith('.md')) : [];
const byId = new Map();
for (const f of files) {
  const m = f.match(/^([a-z0-9][a-z0-9-]*)\.(vi|en)\.md$/);
  if (!m) {
    errors.push(`${f}: file name must be <id>.<vi|en>.md (lowercase, digits, dashes)`);
    continue;
  }
  const [, id, lang] = m;
  const { data, body } = parseFrontmatter(readFileSync(join(postsDir, f), 'utf8'));
  if (!byId.has(id)) byId.set(id, {});
  byId.get(id)[lang] = { data, body, file: f };
}

const posts = [];
const search = { vi: [], en: [] };

for (const [id, langs] of byId) {
  const present = LANGS.filter((l) => langs[l]);
  const primary = langs.vi ?? langs.en;
  const d = primary.data;
  const where = `post "${id}"`;

  if (present.length < LANGS.length) warnings.push(`${where}: only ${present.join(', ')} version`);
  for (const l of present) {
    const fd = langs[l].data;
    if (!fd.title) errors.push(`${where} (${l}): missing title`);
    if (!fd.summary) warnings.push(`${where} (${l}): missing summary`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date ?? '')))
    errors.push(`${where}: date must be YYYY-MM-DD`);
  if (!catById.has(d.category)) errors.push(`${where}: unknown category "${d.category}"`);
  const type = d.type ?? 'article';
  if (!TYPES.includes(type)) errors.push(`${where}: type must be one of ${TYPES.join(', ')}`);
  if (d.series && !seriesIds.has(d.series)) errors.push(`${where}: unknown series "${d.series}"`);
  // Shared fields should match across languages.
  if (langs.vi && langs.en) {
    for (const k of ['date', 'category', 'type', 'series', 'seriesOrder', 'cover']) {
      if (String(langs.vi.data[k] ?? '') !== String(langs.en.data[k] ?? ''))
        warnings.push(`${where}: "${k}" differs between vi and en`);
    }
  }
  // Local images and embedded SQL databases must exist.
  for (const l of present) {
    const body = langs[l].body;
    for (const m of body.matchAll(/!\[[^\]]*\]\((content\/[^\s)]+)/g))
      if (!existsSync(join(pub, m[1]))) errors.push(`${where} (${l}): image not found ${m[1]}`);
    for (const m of body.matchAll(/```sql-run[^\n]*\n(?:--\s*db:\s*([a-z0-9-]+))?/g))
      if (m[1] && m[1] !== 'none' && !existsSync(join(content, 'sql', `${m[1]}.sql`)))
        errors.push(`${where} (${l}): SQL database "${m[1]}" not found in content/sql/`);
  }

  let cover = d.cover;
  if (cover && !existsSync(join(pub, cover))) errors.push(`${where}: cover not found ${cover}`);
  const tags = Array.isArray(d.tags) ? d.tags.map(String) : [];
  if (!cover && catById.has(d.category)) {
    cover = `content/covers/auto/${id}.svg`;
    writeIfChanged(
      join(autoCovers, `${id}.svg`),
      renderCover({ id, category: catById.get(d.category), tags, type }),
    );
  }

  const entry = {
    id,
    date: String(d.date),
    category: d.category,
    type,
    tags,
    series: d.series || undefined,
    seriesOrder: d.series ? Number(d.seriesOrder) || 0 : undefined,
    cover,
    author: d.author || site.author,
    langs: present,
    title: {},
    summary: {},
    minutes: {},
  };
  for (const l of LANGS) {
    const src = langs[l] ?? primary;
    const text = plain(src.body);
    entry.title[l] = String(src.data.title ?? id);
    entry.summary[l] = String(src.data.summary ?? '');
    // ~200 words/min for prose; code blocks count half (skimmed, but still read).
    const codeWords = [...src.body.matchAll(/```[\s\S]*?```/g)].reduce(
      (n, m) => n + m[0].split(/\s+/).length,
      0,
    );
    entry.minutes[l] = Math.max(1, Math.round((text.split(' ').length + codeWords / 2) / 200));
    search[l].push({ id, text: text.slice(0, 6000) });
  }
  posts.push(entry);
}

posts.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

// Series: orders must be unique inside a series.
for (const s of series) {
  const orders = posts.filter((p) => p.series === s.id).map((p) => p.seriesOrder);
  if (new Set(orders).size !== orders.length)
    errors.push(`series "${s.id}": duplicate seriesOrder values`);
}

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error('❌ Content errors:\n' + errors.map((e) => ' - ' + e).join('\n'));
  process.exit(1);
}

// ---------- outputs ----------
writeIfChanged(join(genDir, 'posts.json'), JSON.stringify(posts, null, 1) + '\n');
for (const l of LANGS)
  writeIfChanged(join(genDir, `search.${l}.json`), JSON.stringify(search[l]) + '\n');

const xml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
for (const l of LANGS) {
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `    <item>
      <title>${xml(p.title[l])}</title>
      <link>${xml(`${site.url}#/p/${p.id}`)}</link>
      <guid isPermaLink="false">${xml(p.id)}</guid>
      <pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>
      <category>${xml(catById.get(p.category)?.title?.[l] ?? p.category)}</category>
      <description>${xml(p.summary[l])}</description>
    </item>`,
    )
    .join('\n');
  writeIfChanged(
    join(pub, `feed.${l}.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(site.title)}</title>
    <link>${xml(site.url)}</link>
    <description>${xml(site.description?.[l] ?? '')}</description>
    <language>${l}</language>
${items}
  </channel>
</rss>
`,
  );
}

const counts = Object.fromEntries(
  categories.map((c) => [c.id, posts.filter((p) => p.category === c.id).length]),
);
console.log(
  `✅ Content OK: ${posts.length} posts · ` +
    Object.entries(counts)
      .map(([k, v]) => `${k} ${v}`)
      .join(', '),
);
