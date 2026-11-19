// Data sources for the Tech Radar bot. Every source is optional:
// a failing source is reported in the post instead of failing the whole run.
import {
  DEVTO_TAGS,
  GITHUB_MIN_STARS,
  GITHUB_QUERIES,
  HN_MIN_POINTS,
  RELEASE_WATCHLIST,
} from './config.mjs';

const UA = 'bostu-tech-radar-bot (+https://github.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { headers = {}, retries = 1, timeout = 15000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(timeout),
      });
      if (res.status === 404) return null;
      if (res.status === 401 && headers.Authorization) {
        // Invalid/expired token: fall back to anonymous requests for the rest of the run.
        console.warn('\n⚠ GITHUB_TOKEN rejected (401) — continuing without it');
        delete process.env.GITHUB_TOKEN;
        const { Authorization, ...rest } = headers;
        return fetchJson(url, { headers: rest, retries, timeout });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

function ghHeaders() {
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/** Strip markdown/HTML and shorten text for a one-line description. */
export function cleanText(s, max = 220) {
  if (!s) return '';
  const t = String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

const isoDaysAgo = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

/** New repositories (created in the last 30 days) that are gaining stars fast. */
export async function githubRising({ days }) {
  const created = isoDaysAgo(Math.max(30, days));
  const seen = new Map();
  const owners = new Set();
  for (const q of GITHUB_QUERIES) {
    const query = encodeURIComponent(
      `${q} created:>${created} stars:>${GITHUB_MIN_STARS} archived:false`,
    );
    const data = await fetchJson(
      `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=12`,
      {
        headers: ghHeaders(),
      },
    );
    for (const r of data?.items ?? []) {
      if (seen.has(r.html_url) || r.fork) continue;
      // Spam guards: one repo per owner, a real English/Latin description.
      const owner = r.owner?.login?.toLowerCase();
      const desc = r.description ?? '';
      const cjk = (desc.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) ?? []).length;
      if (owners.has(owner) || desc.length < 25 || cjk > desc.length * 0.2) continue;
      owners.add(owner);
      seen.set(r.html_url, {
        source: 'github',
        title: r.full_name,
        url: r.html_url,
        description: cleanText(r.description),
        topics: r.topics ?? [],
        language: r.language ?? '',
        date: r.created_at?.slice(0, 10),
        metric: r.stargazers_count,
      });
    }
    // Unauthenticated search allows 10 requests/minute.
    await sleep(process.env.GITHUB_TOKEN ? 300 : 6500);
  }
  return [...seen.values()];
}

/** Latest stable releases of well-known tools published inside the window. */
export async function githubReleases({ days }) {
  const since = Date.now() - days * 864e5;
  const out = [];
  for (const repo of RELEASE_WATCHLIST) {
    const rel = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: ghHeaders(),
    });
    if (
      !rel ||
      rel.draft ||
      rel.prerelease ||
      /alpha|beta|rc\d*$|-rc|nightly|canary|preview/i.test(rel.tag_name)
    )
      continue;
    const published = Date.parse(rel.published_at);
    if (!(published >= since)) continue;
    out.push({
      source: 'release',
      title: repo,
      url: rel.html_url,
      version: rel.tag_name,
      description: cleanText(
        (rel.name && rel.name !== rel.tag_name && !/^v?\d/.test(rel.name)
          ? rel.name
          : (rel.body ?? '')
        )
          .replace(/^\s*(#+\s*)?(release notes|what's changed|changelog)\s*/i, '')
          .replace(/released on \d{4}-\d{2}-\d{2}\.?/i, ''),
        160,
      ),
      topics: [],
      date: rel.published_at.slice(0, 10),
      metric: 0,
    });
    await sleep(150);
  }
  return out;
}

/** Popular Hacker News stories from the window. */
export async function hackerNews({ days }) {
  const ts = Math.floor((Date.now() - days * 864e5) / 1000);
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${ts},points>${HN_MIN_POINTS}&hitsPerPage=300`;
  const data = await fetchJson(url);
  return (data?.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      source: 'hn',
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      description: '',
      topics: [],
      date: h.created_at?.slice(0, 10),
      metric: h.points,
      comments: h.num_comments,
    }));
}

/** Top weekly DEV.to articles for backend-related tags. */
export async function devTo() {
  const seen = new Map();
  for (const tag of DEVTO_TAGS) {
    const data = await fetchJson(`https://dev.to/api/articles?tag=${tag}&top=7&per_page=15`);
    for (const a of data ?? []) {
      if (seen.has(a.url)) continue;
      seen.set(a.url, {
        source: 'devto',
        title: a.title,
        url: a.url,
        description: cleanText(a.description),
        topics: a.tag_list ?? [],
        date: a.published_at?.slice(0, 10),
        metric: a.positive_reactions_count ?? 0,
      });
    }
    await sleep(400);
  }
  return [...seen.values()];
}

export const SOURCES = [
  { id: 'github', name: 'GitHub', run: githubRising },
  { id: 'release', name: 'GitHub Releases', run: githubReleases },
  { id: 'hn', name: 'Hacker News', run: hackerNews },
  { id: 'devto', name: 'DEV Community', run: devTo },
];
