// Bilingual titles + summaries for the day's stories, written by Gemini (optional).
import { aiStatus, geminiJSON } from '../tech-radar/ai.mjs';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    intro: {
      type: 'OBJECT',
      properties: { vi: { type: 'STRING' }, en: { type: 'STRING' } },
      required: ['vi', 'en'],
    },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          title_vi: { type: 'STRING' },
          title_en: { type: 'STRING' },
          vi: { type: 'STRING' },
          en: { type: 'STRING' },
          points_vi: { type: 'ARRAY', items: { type: 'STRING' } },
          points_en: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['key', 'title_vi', 'title_en', 'vi', 'en'],
      },
    },
  },
  required: ['intro', 'items'],
};

const ITEMS_SCHEMA = {
  type: 'OBJECT',
  properties: { items: SCHEMA.properties.items },
  required: ['items'],
};
const INTRO_SCHEMA = {
  type: 'OBJECT',
  properties: { intro: SCHEMA.properties.intro },
  required: ['intro'],
};
const BATCH = 6; // stories per Gemini call; small calls answer fast and fail independently

const RULES = `You are the editor of a short daily technology news digest read by a software engineer.
Tone: neutral and factual, like a news brief — no hype, no opinions, no advice.
Paraphrase in your own words — never copy sentences. Use only facts present in the item; do not invent numbers,
dates, names or quotes. If the item says little, keep the summary short rather than guessing.`;

function itemsPrompt(items) {
  return `${RULES}

Each item has a title, the outlet's description and possibly "content" crawled from the article.
For EACH item return:
- "title_vi" / "title_en": the headline in Vietnamese and in English (translate; keep product and company names,
  keep technical terms in English inside Vietnamese text). Keep it under ~14 words.
- "vi" / "en": 1–2 sentences on what happened and why it matters for people working in tech.
- "points_vi" / "points_en": only for items with "headline": true and non-empty content, 2–3 short key facts
  (max ~18 words each) from the content; otherwise empty arrays.

Items:
${JSON.stringify(items, null, 1)}`;
}

function introPrompt(items) {
  return `${RULES}

Write "intro": 2 sentences summarising the main themes of today's stories, in Vietnamese ("vi") and English ("en").

Headlines:
${items.map((it) => `- ${it.title}`).join('\n')}`;
}

/**
 * Stories are summarised in parallel batches, so one slow or failed call only costs its own
 * batch: those stories keep their original title and description.
 * @returns {Promise<null | {intro:{vi:string,en:string}|null, items: Record<string, any>}>}
 */
export async function summarizeNews(items) {
  aiStatus.enabled = !!process.env.GEMINI_API_KEY;
  if (!aiStatus.enabled || !items.length) return null;

  const batches = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
  const opts = { temperature: 0.3, maxOutputTokens: 8192, timeoutMs: 150000 };
  const [introRes, ...batchRes] = await Promise.allSettled([
    geminiJSON(introPrompt(items), INTRO_SCHEMA, {
      ...opts,
      maxOutputTokens: 1024,
      timeoutMs: 90000,
    }),
    ...batches.map((b) => geminiJSON(itemsPrompt(b), ITEMS_SCHEMA, opts)),
  ]);

  const map = {};
  const errors = [];
  for (const r of batchRes) {
    if (r.status === 'rejected') {
      errors.push(r.reason?.message ?? String(r.reason));
      continue;
    }
    for (const it of r.value?.items ?? []) {
      if (!it?.key || !it.vi || !it.en) continue;
      map[it.key] = {
        title: { vi: it.title_vi, en: it.title_en },
        summary: { vi: it.vi, en: it.en },
        points: { vi: (it.points_vi ?? []).slice(0, 3), en: (it.points_en ?? []).slice(0, 3) },
      };
    }
  }
  const intro = introRes.status === 'fulfilled' ? (introRes.value?.intro ?? null) : null;
  if (introRes.status === 'rejected') errors.push(`intro: ${introRes.reason?.message}`);

  aiStatus.summarized = Object.keys(map).length;
  aiStatus.ok = aiStatus.summarized > 0;
  if (errors.length) aiStatus.error = errors.join(' | ').slice(0, 300);
  if (!aiStatus.ok) {
    console.warn(`⚠ AI summaries skipped: ${aiStatus.error}`);
    return null;
  }
  console.log(
    `✨ Gemini (${aiStatus.model}) summarized ${aiStatus.summarized}/${items.length} stories` +
      (errors.length ? ` — ${errors.length} call(s) failed: ${aiStatus.error}` : ''),
  );
  return { intro, items: map };
}
