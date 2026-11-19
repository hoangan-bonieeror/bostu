// Crawls the content behind each selected item so the post can show what an article/repo
// is actually about: a short excerpt, its outline, key points, a preview image and reading time.
//
// Copyright & politeness:
//  - Only short excerpts (≤ EXCERPT_CHARS) and headings/bullets are published, always with a link
//    to the original. The full text is used only in memory (e.g. as input for Gemini summaries).
//  - robots.txt is respected, requests identify the bot, time out, are size-limited and rate-limited.
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

const UA = 'bostu-tech-radar-bot/1.0 (+https://github.com/hoangan-bonieeror/bostu)';
const BOT_NAME = 'bostu-tech-radar-bot';
const TIMEOUT_MS = 15000;
const MAX_BYTES = 2_000_000;
const EXCERPT_CHARS = 280;
const AI_TEXT_CHARS = 3500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const clip = (s, n) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
};

async function fetchText(url, accept = 'text/html,application/xhtml+xml', headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  // Read at most MAX_BYTES so a huge page can't stall the run.
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString('utf8'), type, finalUrl: res.url };
}

// ---------- robots.txt ----------
const robotsCache = new Map();

/** Minimal robots.txt check: honours Disallow rules for "*" and for this bot's name. */
async function allowedByRobots(url) {
  const { origin, pathname, search } = new URL(url);
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      fetchText(`${origin}/robots.txt`, 'text/plain')
        .then(({ text }) => parseRobots(text))
        .catch(() => []), // no robots.txt (or unreachable) → allowed
    );
  }
  const rules = await robotsCache.get(origin);
  const path = pathname + search;
  // Longest matching rule wins (Allow beats Disallow on ties), as in Google's implementation.
  let best = null;
  for (const r of rules) {
    if (
      r.path &&
      path.startsWith(r.path) &&
      (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))
    )
      best = r;
  }
  return !best || best.allow;
}

function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (key.toLowerCase() === 'user-agent') {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if (current) {
      current.rules.push({
        allow: key.toLowerCase() === 'allow',
        path: value.replace(/\*.*$/, ''),
      });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => BOT_NAME.startsWith(a) && a !== '*'));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

// ---------- Markdown (README, release notes, DEV articles) ----------
function cleanInline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images / badges
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/<[^>]+>/g, '') // inline html
    .replace(/[`*_~]/g, '')
    .replace(/\\([[\]\\_*`#<>()-])/g, '$1') // markdown escapes like \[flake8\]
    .replace(/\s+by @[\w-]+ in (https?:\/\/\S+|#\d+)/gi, '') // release-note credits
    .replace(/\.?\s*PR #\d+( by @[\w-]+)?\.?/gi, '')
    .replace(/\s*\(@[\w-]+\)|\s+by @[\w-]+\.?$/gi, '')
    .replace(/^#\d+\s+/, '')
    .replace(/\(#\d+\)|https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SKIP_HEADINGS =
  /^(table of contents|contents|license|licen[cs]e|contributors?|contributing|sponsors?|.*\bsponsors?$|backers|opinions|star history|acknowledge?ments?|credits|support|community|installation|faq|.*mini documentary)$/i;

export function markdownDigest(md) {
  const lines = (md ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<(picture|table|details|div|p)[\s\S]*?<\/\1>/gi, (m) =>
      /<img|<picture/i.test(m) ? '' : m.replace(/<[^>]+>/g, ' '),
    )
    .split(/\r?\n/);
  const outline = [];
  const bullets = [];
  const paras = [];
  let para = [];
  const flush = () => {
    const t = cleanInline(para.join(' '));
    if (t.length >= 60 && !/^(\||table of contents)/i.test(t)) paras.push(t);
    para = [];
  };
  let rawBullet = null; // bullet text being collected (list items can wrap onto several lines)
  const flushBullet = () => {
    if (rawBullet === null) return;
    const t = cleanInline(rawBullet);
    if (t.length >= 12 && t.length <= 200) bullets.push(t);
    rawBullet = null;
  };
  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.+)/);
    const b = line.match(/^\s{0,3}(?:[-*+]|\d+\.)\s+(.+)/);
    if (h) {
      flush();
      flushBullet();
      const t = cleanInline(h[1]);
      if (t && t.length < 80 && !SKIP_HEADINGS.test(t)) outline.push(t);
    } else if (b) {
      flush();
      flushBullet();
      rawBullet = b[1];
    } else if (!line.trim()) {
      flush();
      flushBullet();
    } else if (rawBullet !== null) {
      rawBullet += ' ' + line.trim(); // continuation of the current list item
    } else {
      para.push(line.trim());
    }
  }
  flushBullet();
  flush();
  const text = paras.join('\n');
  return {
    excerpt: clip(paras[0] ?? '', EXCERPT_CHARS),
    outline: [...new Set(outline)].slice(0, 6),
    bullets: [...new Set(bullets)].slice(0, 5),
    words: text.split(/\s+/).filter(Boolean).length,
    text: clip([text, ...bullets].join('\n'), AI_TEXT_CHARS),
  };
}

// ---------- HTML articles ----------
export function htmlDigest(html, url) {
  const { document } = parseHTML(html);
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';
  let image = meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
  if (image) {
    try {
      image = new URL(image, url).href;
    } catch {
      image = '';
    }
  }
  const site = meta('meta[property="og:site_name"]') || new URL(url).hostname.replace(/^www\./, '');
  const ogDesc = meta('meta[property="og:description"]') || meta('meta[name="description"]');

  const article = new Readability(document, { charThreshold: 300 }).parse();
  if (!article?.content) {
    return {
      excerpt: clip(ogDesc, EXCERPT_CHARS),
      outline: [],
      bullets: [],
      words: 0,
      text: ogDesc,
      image,
      site,
    };
  }
  const { document: doc } = parseHTML(`<html><body>${article.content}</body></html>`);
  const outline = [...doc.querySelectorAll('h2, h3')]
    .map((h) => clip(h.textContent, 80))
    .filter(
      (t) =>
        t.length >= 3 &&
        t !== clip(article.title, 80) &&
        !/^(share|related|comments?|subscribe|newsletter|references?)\b/i.test(t),
    );
  const paras = [...doc.querySelectorAll('p')]
    .map((p) => clip(p.textContent, 1000))
    .filter((t) => t.length >= 60);
  const lists = [...doc.querySelectorAll('ul, ol')]
    .map((l) => [...l.querySelectorAll(':scope > li')].map((li) => clip(li.textContent, 180)))
    .filter(
      (items) => items.length >= 2 && items.length <= 10 && items.every((t) => t.length >= 12),
    );
  const text = (article.textContent ?? '').replace(/\s+/g, ' ').trim();
  return {
    excerpt: clip(paras.slice(0, 2).join(' ') || article.excerpt || ogDesc, EXCERPT_CHARS),
    outline: [...new Set(outline)].slice(0, 6),
    bullets: (lists[0] ?? []).slice(0, 5),
    words: text.split(/\s+/).filter(Boolean).length,
    text: clip(text, AI_TEXT_CHARS),
    image,
    site,
  };
}

// ---------- per-source crawlers ----------
function ghHeaders() {
  const h = { 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function crawlGithubRepo(item) {
  const { text } = await fetchText(
    `https://api.github.com/repos/${item.title}/readme`,
    'application/vnd.github.raw',
    ghHeaders(),
  );
  return {
    ...markdownDigest(text),
    image: `https://opengraph.githubassets.com/1/${item.title}`,
    site: 'GitHub',
  };
}

async function crawlRelease(item) {
  const d = markdownDigest(item.body ?? '');
  return {
    ...d,
    image: `https://opengraph.githubassets.com/1/${item.title}`,
    site: 'GitHub Releases',
  };
}

async function crawlDevTo(item) {
  const path = item.apiPath ?? new URL(item.url).pathname;
  const { text } = await fetchText(`https://dev.to/api/articles${path}`, 'application/json');
  const a = JSON.parse(text);
  return {
    ...markdownDigest(a.body_markdown),
    image: a.cover_image || a.social_image || '',
    site: 'DEV Community',
    minutes: a.reading_time_minutes,
  };
}

async function crawlWebPage(item) {
  const url = item.url;
  if (/news\.ycombinator\.com\/item/.test(url)) throw new Error('HN discussion only');
  if (/\.(pdf|zip|mp4|mp3|png|jpe?g|gif)(\?|$)/i.test(url)) throw new Error('not an HTML page');
  if (!(await allowedByRobots(url))) {
    const e = new Error('blocked by robots.txt');
    e.robots = true;
    throw e;
  }
  const { text, type, finalUrl } = await fetchText(url);
  if (!/html/i.test(type)) throw new Error(`unsupported content-type ${type.split(';')[0]}`);
  return htmlDigest(text, finalUrl || url);
}

/** Crawl one item. Never throws: returns { ok:false, error } on failure. */
export async function crawlItem(item) {
  try {
    const run =
      item.source === 'github'
        ? crawlGithubRepo
        : item.source === 'release'
          ? crawlRelease
          : item.source === 'devto'
            ? crawlDevTo
            : crawlWebPage;
    const d = await run(item);
    const minutes = d.minutes ?? (d.words ? Math.max(1, Math.round(d.words / 220)) : undefined);
    return { ok: true, ...d, minutes };
  } catch (e) {
    return { ok: false, error: String(e.message ?? e).slice(0, 160), robots: !!e.robots };
  }
}

/**
 * Crawl many items with limited concurrency and a small delay per request.
 * @returns {Promise<{ stats: {attempted:number, ok:number, failed:number, robots:number} }>}
 */
export async function crawlAll(items, { concurrency = 4, delayMs = 400 } = {}) {
  const queue = [...items];
  const stats = { attempted: items.length, ok: 0, failed: 0, robots: 0 };
  async function worker() {
    while (queue.length) {
      const it = queue.shift();
      it.crawl = await crawlItem(it);
      if (it.crawl.ok) stats.ok++;
      else if (it.crawl.robots) stats.robots++;
      else stats.failed++;
      process.stdout.write(it.crawl.ok ? '.' : 'x');
      await sleep(delayMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  process.stdout.write('\n');
  return { stats };
}
