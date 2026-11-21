// Turns the selected stories into the bilingual Markdown body of the daily post.
import { OTHER_SECTION, SECTIONS } from './config.mjs';

const T = {
  vi: {
    note: (date, n) =>
      `Bản tin tự động ngày ${date}, tổng hợp từ ${n} nguồn. Mỗi mục chỉ là tóm tắt ngắn; bấm vào tiêu đề để đọc bài gốc.`,
    noAi: 'Hôm nay chưa có bản tóm tắt tiếng Việt, nên tiêu đề và mô tả được giữ nguyên theo nguồn.',
    top: '⭐ Tiêu điểm',
    source: 'Nguồn',
    also: 'cũng đưa tin',
    points: 'điểm trên HN',
    discuss: 'thảo luận',
    sources: 'Nguồn hôm nay',
    failed: 'Không lấy được',
    radar: 'Muốn xem công cụ và thư viện mới? Đọc [Tech Radar](#/c/tech-radar) hằng tuần.',
  },
  en: {
    note: (date, n) =>
      `Automated digest for ${date}, compiled from ${n} sources. Each entry is a short summary; follow the title to read the original.`,
    noAi: 'No AI summaries today, so titles and descriptions are shown as published by the source.',
    top: '⭐ Top stories',
    source: 'Source',
    also: 'also covered by',
    points: 'points on HN',
    discuss: 'discussion',
    sources: "Today's sources",
    failed: 'Unavailable',
    radar: 'Looking for new tools and libraries? See the weekly [Tech Radar](#/c/tech-radar).',
  },
};

const mdEsc = (s) => String(s ?? '').replace(/([[\]])/g, '\\$1');

export function titleOf(it, lang, ai) {
  return ai?.items[it.k]?.title?.[lang] || it.title;
}
function summaryOf(it, lang, ai) {
  return ai?.items[it.k]?.summary?.[lang] || it.description || '';
}

function meta(it, lang) {
  const t = T[lang];
  const parts = [`${t.source}: ${it.sourceName}`];
  if (it.also?.length) parts.push(`${t.also} ${it.also.join(', ')}`);
  if (it.points) parts.push(`${it.points} ${t.points}`);
  if (it.discussion) parts.push(`[${t.discuss}](${it.discussion})`);
  return `*${parts.join(' · ')}*`;
}

/**
 * @param {'vi'|'en'} lang
 * @param {{ dateLabel:string, items:any[], headlines:any[], ai:any, sources:string[], failed:string[] }} p
 */
export function renderNews(lang, p) {
  const t = T[lang];
  const out = [];
  out.push('> [!NOTE]', `> ${t.note(p.dateLabel, p.sources.length)}`, '');
  if (p.ai?.intro?.[lang]) out.push(p.ai.intro[lang], '');
  else if (!p.ai) out.push(`*${t.noAi}*`, '');

  out.push(`## ${t.top}`, '');
  p.headlines.forEach((it, i) => {
    out.push(`### ${i + 1}. [${mdEsc(titleOf(it, lang, p.ai))}](${it.url})`, '');
    const s = summaryOf(it, lang, p.ai);
    if (s) out.push(s, '');
    const pts = p.ai?.items[it.k]?.points?.[lang] ?? [];
    if (pts.length) out.push(...pts.map((x) => `- ${x}`), '');
    out.push(meta(it, lang), '');
  });

  const headlineKeys = new Set(p.headlines.map((h) => h.k));
  for (const sec of [...SECTIONS, OTHER_SECTION]) {
    const list = p.items.filter((it) => it.section === sec.id && !headlineKeys.has(it.k));
    if (!list.length) continue;
    out.push(`## ${sec.icon} ${sec.title[lang]}`, '');
    for (const it of list) {
      const s = summaryOf(it, lang, p.ai);
      out.push(
        `- **[${mdEsc(titleOf(it, lang, p.ai))}](${it.url})**${s ? ` — ${s}` : ''}  `,
        `  ${meta(it, lang)}`,
      );
    }
    out.push('');
  }

  out.push('---', '', `**${t.sources}:** ${p.sources.join(', ')}.`);
  if (p.failed.length) out.push(`${t.failed}: ${p.failed.join(', ')}.`);
  out.push('', t.radar, '');
  return out.join('\n');
}

/** Sections present in the post, most stories first (used as tags). */
export function sectionTags(items) {
  const n = {};
  for (const it of items) if (it.section !== 'other') n[it.section] = (n[it.section] ?? 0) + 1;
  return Object.entries(n)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
