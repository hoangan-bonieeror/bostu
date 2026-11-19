// Renders the Tech Radar post as Markdown in Vietnamese and English.
import { CATEGORIES } from './config.mjs';

const T = {
  vi: {
    by: (date, list) =>
      `🤖 Bài viết được **Tech Radar Bot** tổng hợp tự động ngày ${date} từ ${list}. Mỗi mục được xếp vào một chủ đề gắn với kỹ năng trên [lộ trình](#/roadmap) của bạn.`,
    origDesc:
      'Mô tả của repo/bài viết được giữ nguyên tiếng Anh — đây cũng là cách luyện đọc tài liệu kỹ thuật!',
    failed: (names) =>
      `Lần chạy này không lấy được dữ liệu từ: ${names}. Bot sẽ thử lại ở lần chạy sau.`,
    overview: '📊 Toàn cảnh tuần này',
    pieTitle: 'Số mục theo chủ đề',
    table: ['Chủ đề', 'Số mục', 'Kỹ năng liên quan'],
    noSkill: 'Chủ đề mở rộng',
    highlights: (n) => `🔥 Top ${n} đáng chú ý`,
    why: 'Vì sao nên quan tâm:',
    keyPoints: '📌 Điểm chính',
    covers: '🗂️ Bài viết gồm các phần',
    readTime: (n) => `⏱ ~${n} phút đọc bài gốc`,
    open: 'Xem chi tiết →',
    discuss: 'Thảo luận trên HN',
    releases: '🚀 Bản phát hành mới của công cụ quen thuộc',
    relTable: ['Công cụ', 'Phiên bản', 'Ngày', 'Ghi chú'],
    byTopic: '🧭 Theo chủ đề',
    actions: '✅ Việc nên làm tuần này',
    tryIt: (name) => `Thử với **${name}**:`,
    review: 'Ôn lại [flashcard](#/cards) và luyện thêm một bài trong [SQL Lab](#/sql).',
    about: '⚙️ Về bot này',
    aboutText:
      'Bot chạy tự động mỗi thứ Hai qua GitHub Actions (`.github/workflows/tech-radar.yml`), lấy dữ liệu từ GitHub, Hacker News và DEV, chấm điểm theo độ phổ biến và mức liên quan tới backend, mở từng link để đọc nội dung (README, release notes, bài viết — có tôn trọng robots.txt), rồi xuất bản thành bài blog này. Bài chỉ trích đoạn ngắn kèm link gốc. Bạn có thể đổi nguồn, từ khóa và chủ đề trong `scripts/tech-radar/config.mjs`.',
    none: 'Tuần này chưa có mục nào đủ nổi bật.',
    src: { github: 'GitHub', release: 'Release', hn: 'Hacker News', devto: 'DEV' },
    points: 'điểm',
    comments: 'bình luận',
    reactions: 'lượt thích',
    newRepo: 'repo mới',
    title: (w, y, d) => `Tech Radar ${d} · tuần ${w}/${y}`,
    summary: (names) => `Nổi bật: ${names}`,
  },
  en: {
    by: (date, list) =>
      `🤖 This post was compiled automatically by **Tech Radar Bot** on ${date} from ${list}. Each item is mapped to a topic linked to the skills on your [roadmap](#/roadmap).`,
    origDesc: '',
    failed: (names) =>
      `This run could not fetch data from: ${names}. The bot will retry on the next run.`,
    overview: '📊 This week at a glance',
    pieTitle: 'Items per topic',
    table: ['Topic', 'Items', 'Related skill'],
    noSkill: 'Bonus topic',
    highlights: (n) => `🔥 Top ${n} highlights`,
    why: 'Why it matters:',
    keyPoints: '📌 Key points',
    covers: '🗂️ What it covers',
    readTime: (n) => `⏱ ~${n} min read`,
    open: 'Read more →',
    discuss: 'HN discussion',
    releases: '🚀 New releases of tools you know',
    relTable: ['Tool', 'Version', 'Date', 'Notes'],
    byTopic: '🧭 By topic',
    actions: '✅ To-do this week',
    tryIt: (name) => `Try it with **${name}**:`,
    review: 'Review your [flashcards](#/cards) and solve one more [SQL Lab](#/sql) exercise.',
    about: '⚙️ About this bot',
    aboutText:
      'The bot runs every Monday via GitHub Actions (`.github/workflows/tech-radar.yml`), pulls data from GitHub, Hacker News and DEV, scores items by popularity and backend relevance, opens each link to read its content (README, release notes, articles — respecting robots.txt), and publishes this post. Only short excerpts are quoted, always with a link to the source. Change sources, keywords and topics in `scripts/tech-radar/config.mjs`.',
    none: 'Nothing stood out enough this week.',
    src: { github: 'GitHub', release: 'Release', hn: 'Hacker News', devto: 'DEV' },
    points: 'points',
    comments: 'comments',
    reactions: 'reactions',
    newRepo: 'new repo',
    title: (w, y, d) => `Tech Radar ${d} · week ${w}/${y}`,
    summary: (names) => `Highlights: ${names}`,
  },
};

const md = (s) => String(s ?? '').replace(/([\\[\]|*_`<>])/g, '\\$1');
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const catOf = (id) => CATEGORIES.find((c) => c.id === id);

function metricLabel(it, t) {
  switch (it.source) {
    case 'github':
      return `⭐ ${k(it.metric)}${it.language ? ` · ${md(it.language)}` : ''} · ${t.newRepo}`;
    case 'hn':
      return `▲ ${k(it.metric)} ${t.points} · 💬 ${k(it.comments ?? 0)} ${t.comments}`;
    case 'devto':
      return `❤️ ${k(it.metric)} ${t.reactions}`;
    default:
      return it.version ? `🏷️ ${md(it.version)}` : '';
  }
}

function describe(it, ai, lang) {
  return ai?.items?.[it.key]?.[lang] || it.description || it.crawl?.excerpt || '';
}

/** Key points: AI takeaways if available, else bullets found in the crawled page. */
function keyPoints(it, ai, lang) {
  const fromAi = ai?.items?.[it.key]?.points?.[lang];
  if (fromAi?.length) return fromAi;
  // Without AI these are quotes from the source, so keep them short.
  return it.crawl?.ok ? (it.crawl.bullets ?? []).slice(0, 4).map((b) => clipText(b, 140)) : [];
}

const clipText = (s, n) => {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
};

const safeUrl = (u) => String(u).replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');

/**
 * @param {'vi'|'en'} lang
 * @param {object} p  { dateLabel, week, year, sources, failed, ranked, highlights, releases, byCategory, counts, ai }
 */
export function renderPost(lang, p) {
  const t = T[lang];
  const out = [];
  const srcList = p.sources
    .filter((s) => s.count > 0)
    .map((s) => `${s.name} (${s.count})`)
    .join(', ');

  out.push(`# ${t.title(p.week, p.year, p.shortDate[lang])}`, '');
  out.push('> [!NOTE]', `> ${t.by(p.dateLabel, srcList || '—')}`);
  if (!p.ai && t.origDesc) out.push('>', `> ${t.origDesc}`);
  out.push('');
  if (p.failed.length) out.push('> [!WARNING]', `> ${t.failed(p.failed.join(', '))}`, '');
  if (p.ai?.intro?.[lang]) out.push(p.ai.intro[lang], '');

  // Overview: pie chart + table
  const entries = Object.entries(p.counts).sort((a, b) => b[1] - a[1]);
  if (entries.length) {
    out.push(`## ${t.overview}`, '');
    out.push('```mermaid', 'pie showData', `    title ${t.pieTitle}`);
    for (const [id, n] of entries)
      out.push(`    "${catOf(id).title[lang].replace(/"/g, "'")}" : ${n}`);
    out.push('```', '');
    out.push(`| ${t.table.join(' | ')} |`, '|---|---:|---|');
    for (const [id, n] of entries) {
      const c = catOf(id);
      const skill = c.skill ? `[${md(p.skillTitle(c.skill, lang))}](#/roadmap)` : t.noSkill;
      out.push(`| ${c.icon} ${md(c.title[lang])} | ${n} | ${skill} |`);
    }
    out.push('');
  }

  // Highlights
  if (p.highlights.length) {
    out.push(`## ${t.highlights(p.highlights.length)}`, '');
    p.highlights.forEach((it, i) => {
      const c = catOf(it.category);
      out.push(`### ${i + 1}. ${md(it.title)}`, '');
      const cr = it.crawl?.ok ? it.crawl : null;
      out.push(
        `**${t.src[it.source]}** · ${metricLabel(it, t)} · ${c.icon} ${md(c.title[lang])}${it.date ? ` · 📅 ${it.date}` : ''}${cr?.minutes ? ` · ${t.readTime(cr.minutes)}` : ''}`,
        '',
      );
      if (cr?.image)
        out.push(
          `![${md(it.title)}](${safeUrl(cr.image)} "${md(cr.site ?? it.title).replace(/"/g, "'")}")`,
          '',
        );
      const d = describe(it, p.ai, lang);
      if (d) out.push(md(d), '');
      // Short quoted excerpt from the source (only when there is no AI summary to avoid repetition).
      if (cr?.excerpt && !p.ai?.items?.[it.key] && cr.excerpt !== it.description) {
        out.push(`> “${md(cr.excerpt)}”`, `> — *${md(cr.site ?? '')}*`, '');
      }
      const pts = keyPoints(it, p.ai, lang);
      if (pts.length) {
        out.push(`**${t.keyPoints}**`, '', ...pts.map((x) => `- ${md(x)}`), '');
      } else if (cr?.outline?.length) {
        out.push(`**${t.covers}:** ${cr.outline.map(md).join(' · ')}`, '');
      }
      out.push('> [!TIP]', `> **${t.why}** ${c.why[lang]}`, '');
      const links = [`[${t.open}](${it.url})`];
      if (it.discussion && it.discussion !== it.url) links.push(`[${t.discuss}](${it.discussion})`);
      out.push(links.join(' · '), '');
    });
  } else {
    out.push(t.none, '');
  }

  // Releases
  if (p.releases.length) {
    out.push(`## ${t.releases}`, '');
    out.push(`| ${t.relTable.join(' | ')} |`, '|---|---|---|---|');
    for (const r of p.releases) {
      const ai = p.ai?.items?.[r.key]?.[lang];
      const bullets = r.crawl?.ok ? (r.crawl.bullets ?? []).slice(0, 3).join('; ') : '';
      const note = md(clipText(ai || bullets || r.description, 170));
      out.push(
        `| [${md(r.title)}](${r.url}) | \`${r.version.replace(/`/g, '')}\` | ${r.date} | ${note} |`,
      );
    }
    out.push('');
  }

  // By topic
  const topicEntries = Object.entries(p.byCategory).filter(([, list]) => list.length);
  if (topicEntries.length) {
    out.push(`## ${t.byTopic}`, '');
    for (const [id, list] of topicEntries) {
      const c = catOf(id);
      out.push(`### ${c.icon} ${md(c.title[lang])}`, '');
      for (const it of list) {
        const d = describe(it, p.ai, lang);
        out.push(
          `- **[${md(it.title)}](${it.url})**${d ? ` — ${md(d)}` : ''} _(${t.src[it.source]} · ${metricLabel(it, t)})_`,
        );
      }
      out.push('');
    }
  }

  // Actions
  out.push(`## ${t.actions}`, '');
  const done = new Set();
  for (const it of p.highlights) {
    if (done.has(it.category) || done.size >= p.maxActions) continue;
    done.add(it.category);
    const c = catOf(it.category);
    out.push(`- [ ] ${c.icon} ${t.tryIt(md(it.title))} ${c.action[lang]}`);
  }
  out.push(`- [ ] 🃏 ${t.review}`, '');

  out.push(`## ${t.about}`, '', t.aboutText, '');
  return out.join('\n');
}

export function postMeta(lang, p) {
  const t = T[lang];
  return {
    title: t.title(p.week, p.year, p.shortDate[lang]),
    summary: t.summary(
      p.highlights
        .slice(0, 3)
        .map((h) => h.title)
        .join(', ') || '—',
    ),
  };
}
