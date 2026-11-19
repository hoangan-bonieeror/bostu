// Assigns each item to a radar category and computes a comparable score.
import { CATEGORIES, EXCLUDE_KEYWORDS } from './config.mjs';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const matchers = CATEGORIES.map((c) => ({
  cat: c,
  res: c.keywords.map((k) => new RegExp(`(^|[^a-z0-9])${escapeRe(k.toLowerCase())}([^a-z0-9]|$)`)),
}));

const excludes = EXCLUDE_KEYWORDS.map(
  (k) => new RegExp(`(^|[^a-z0-9])${escapeRe(k.toLowerCase())}([^a-z0-9]|$)`),
);

/**
 * Returns { category, hits } for the best-matching category, or null.
 * Keywords in the title/description count double; repo topics count once
 * (topics are often stuffed), and at least 2 points are required.
 */
export function categorize(item) {
  const strong = [item.title, item.title.replace(/[/_.-]/g, ' '), item.description]
    .join(' ')
    .toLowerCase();
  const weak = (item.topics ?? [])
    .map((t) => t.replace(/-/g, ' '))
    .join(' | ')
    .toLowerCase();
  if (item.source !== 'release' && excludes.some((re) => re.test(strong) || re.test(weak)))
    return null;
  let best = null;
  for (const { cat, res } of matchers) {
    const hits = res.reduce((n, re) => n + (re.test(strong) ? 2 : re.test(weak) ? 1 : 0), 0);
    if (hits && (!best || hits > best.hits)) best = { category: cat, hits };
  }
  if (!best || (item.source !== 'release' && best.hits < 2)) return null;
  return best;
}

/**
 * Popularity on a comparable log scale (sources have very different magnitudes),
 * plus a relevance bonus for keyword hits.
 */
export function score(item, hits) {
  const m = Math.max(0, item.metric ?? 0);
  const pop =
    item.source === 'github'
      ? Math.log10(m + 1) * 2.0
      : item.source === 'hn'
        ? Math.log10(m + 1) * 2.1
        : item.source === 'devto'
          ? Math.log10(m + 1) * 1.9
          : 3.5; // releases of watched tools are always relevant
  return Math.round((pop + Math.min(hits, 6) * 0.35) * 100) / 100;
}

/** Classify, drop off-topic items, de-duplicate and sort by score. */
export function rank(items, seenUrls = new Set()) {
  const byUrl = new Map();
  for (const it of items) {
    if (!it.url || seenUrls.has(it.url)) continue;
    const c = categorize(it);
    if (!c) continue;
    const ranked = { ...it, category: c.category.id, score: score(it, c.hits) };
    const prev = byUrl.get(it.url);
    if (!prev || prev.score < ranked.score) byUrl.set(it.url, ranked);
  }
  return [...byUrl.values()].sort((a, b) => b.score - a.score);
}

/** Pick highlights with diversity: at most `perCat` from the same category. */
export function pickHighlights(ranked, n, perCat = 2) {
  const count = {};
  const out = [];
  for (const it of ranked) {
    if (it.source === 'release') continue;
    if ((count[it.category] ?? 0) >= perCat) continue;
    count[it.category] = (count[it.category] ?? 0) + 1;
    out.push(it);
    if (out.length >= n) break;
  }
  return out;
}
