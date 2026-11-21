// Data sources for the daily tech-news bot: RSS/Atom feeds and the Hacker News front page.
// Every source is optional: a failing feed is reported, it never fails the whole run.
import { DOMParser } from 'linkedom';
import { cleanText } from '../tech-radar/sources.mjs';
import { FEEDS, HN_MIN_POINTS } from './config.mjs';

const UA = 'bostu-tech-news-bot/1.0 (+https://github.com/hoangan-bonieeror/bostu)';
const MAX_BYTES = 3_000_000;

async function fetchText(url, accept) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.subarray(0, MAX_BYTES).toString('utf8');
}

const textOf = (el, ...tags) => {
  for (const t of tags) {
    const n = el.getElementsByTagName(t)[0];
    const v = n?.textContent?.trim();
    if (v) return v;
  }
  return '';
};

/** Atom <link rel="alternate" href> or RSS <link>text</link>. */
function linkOf(el) {
  const links = [...el.getElementsByTagName('link')];
  for (const l of links) {
    const href = l.getAttribute('href');
    const rel = l.getAttribute('rel');
    if (href && (!rel || rel === 'alternate')) return href.trim();
  }
  const t = links[0]?.textContent?.trim();
  return t || textOf(el, 'guid');
}

/** First image URL from media tags, enclosure, or the description HTML. */
function imageOf(el, html) {
  for (const tag of ['media:content', 'media:thumbnail', 'enclosure']) {
    for (const n of el.getElementsByTagName(tag)) {
      const url = n.getAttribute('url');
      const type = n.getAttribute('type') ?? '';
      if (url && (tag !== 'enclosure' || type.startsWith('image'))) return url;
    }
  }
  return html.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? '';
}

/** Parse an RSS 2.0 or Atom document into items. Exported for tests. */
export function parseFeed(xml, feed) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const entries = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagName('entry')];
  return entries
    .map((el) => {
      const html = textOf(el, 'description', 'summary', 'content:encoded', 'content');
      const date = textOf(el, 'pubDate', 'published', 'updated', 'dc:date');
      const time = Date.parse(date);
      return {
        source: feed.id,
        sourceName: feed.name,
        weight: feed.weight ?? 1,
        lang: feed.lang ?? 'en',
        title: cleanText(textOf(el, 'title'), 200),
        url: linkOf(el),
        description: cleanText(html, 300),
        image: imageOf(el, html),
        time: Number.isNaN(time) ? null : time,
      };
    })
    .filter((it) => it.title && /^https?:\/\//.test(it.url));
}

export async function readFeed(feed, { hours }) {
  const xml = await fetchText(
    feed.url,
    'application/rss+xml, application/atom+xml, application/xml, text/xml',
  );
  const since = Date.now() - hours * 3600e3;
  // Undated items are kept; the seen-list stops them from repeating on later days.
  return parseFeed(xml, feed).filter((it) => !it.time || it.time >= since);
}

/** Hacker News front-page stories from the window, with their points. */
export async function hackerNews({ hours }) {
  const ts = Math.floor((Date.now() - hours * 3600e3) / 1000);
  const url = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>${ts},points>${HN_MIN_POINTS}&hitsPerPage=60`;
  const data = JSON.parse(await fetchText(url, 'application/json'));
  return (data?.hits ?? [])
    .filter((h) => h.title && !/^(Ask|Show|Tell|Launch) HN/i.test(h.title))
    .map((h) => ({
      source: 'hn',
      sourceName: 'Hacker News',
      weight: 1.0,
      lang: 'en',
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      description: '',
      points: h.points,
      comments: h.num_comments,
      time: (h.created_at_i ?? 0) * 1000 || null,
    }));
}

export const SOURCES = [
  { id: 'hn', name: 'Hacker News', run: hackerNews },
  ...FEEDS.map((f) => ({ id: f.id, name: f.name, run: (o) => readFeed(f, o) })),
];
