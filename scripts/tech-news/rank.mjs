// Classify, de-duplicate and rank news stories.
import { EXCLUDE_PATTERNS, LIMITS, OTHER_SECTION, SECTIONS } from './config.mjs';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matchers = SECTIONS.map((s) => ({
  ...s,
  re: new RegExp(
    `(^|[^\\p{L}\\p{N}])(${s.keywords.map(esc).join('|')})(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  ),
}));

export function sectionOf(item) {
  const text = `${item.title} ${item.description ?? ''}`;
  // Title matches win over description matches.
  return (
    matchers.find((m) => m.re.test(item.title)) ??
    matchers.find((m) => m.re.test(text)) ??
    OTHER_SECTION
  );
}

/** URL without tracking params, fragment, trailing slash or "www." — for de-duplication. */
export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const k of [...url.searchParams.keys()])
      if (/^(utm_|ref$|source$|guccounter|fbclid|gclid)/i.test(k)) url.searchParams.delete(k);
    return (
      url.hostname.replace(/^www\./, '') +
      url.pathname.replace(/\/$/, '') +
      url.search
    ).toLowerCase();
  } catch {
    return u;
  }
}

const STOP = new Set(
  'the a an of to in on for and or is are with by at from as its it this that new how why what after says will can be has have you your'.split(
    ' ',
  ),
);
const words = (t) =>
  new Set(
    t
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
function similar(a, b) {
  const A = words(a);
  const B = words(b);
  if (A.size < 3 || B.size < 3) return false;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter >= 3 && inter / Math.min(A.size, B.size) >= 0.5;
}

/**
 * @param {any[]} items raw items from all sources
 * @param {Set<string>} seen normalized URLs already published
 * @param {number} now ms timestamp of the run
 */
export function rank(items, seen, now, hours) {
  const fresh = [];
  const byUrl = new Map();
  for (const it of items) {
    if (EXCLUDE_PATTERNS.some((re) => re.test(it.title))) continue;
    const key = normalizeUrl(it.url);
    if (seen.has(key)) continue;
    const prev = byUrl.get(key);
    if (prev) {
      // Same link from HN and a feed: merge, keep the HN points/discussion.
      prev.points ??= it.points;
      prev.discussion ??= it.discussion;
      prev.also = [...new Set([...(prev.also ?? []), it.sourceName])];
      continue;
    }
    const entry = { ...it, key };
    byUrl.set(key, entry);
    fresh.push(entry);
  }

  // The same story covered by several outlets: keep one, count the others as a signal.
  const kept = [];
  for (const it of fresh) {
    const dup = kept.find((k) => similar(k.title, it.title));
    if (dup) {
      dup.also = [...new Set([...(dup.also ?? []), it.sourceName])];
      dup.points ??= it.points;
      continue;
    }
    kept.push(it);
  }

  for (const it of kept) {
    const sec = sectionOf(it);
    it.section = sec.id;
    const age = it.time ? Math.max(0, (now - it.time) / 3600e3) : hours / 2;
    const recency = Math.max(0, 1 - age / hours); // 1 = just published
    const hn = it.points ? Math.min(2, Math.max(0, Math.log10(it.points) - 1.7)) : 0;
    const coverage = Math.min(1.5, (it.also?.length ?? 0) * 0.75);
    it.score = +(it.weight * 2 + recency + hn + coverage + sec.bonus).toFixed(2);
  }
  return kept.sort((a, b) => b.score - a.score);
}

/** Pick the day's stories, respecting per-source and per-section caps. */
export function select(ranked, limits = LIMITS) {
  const out = [];
  const perSource = {};
  const perSection = {};
  for (const it of ranked) {
    if (out.length >= limits.items) break;
    if ((perSource[it.source] ?? 0) >= limits.perSource) continue;
    if ((perSection[it.section] ?? 0) >= limits.perSection) continue;
    perSource[it.source] = (perSource[it.source] ?? 0) + 1;
    perSection[it.section] = (perSection[it.section] ?? 0) + 1;
    out.push(it);
  }
  return out;
}
