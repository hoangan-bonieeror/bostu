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

/**
 * @returns {Promise<null | {intro:{vi:string,en:string}, items: Record<string, any>}>}
 */
export async function summarizeNews(items) {
  aiStatus.enabled = !!process.env.GEMINI_API_KEY;
  if (!aiStatus.enabled || !items.length) return null;

  const prompt = `You are the editor of a short daily technology news digest read by a software engineer.
Tone: neutral and factual, like a news brief — no hype, no opinions, no advice.

Each item has a title, the outlet's description and possibly "content" crawled from the article.
For EACH item return:
- "title_vi" / "title_en": the headline in Vietnamese and in English (translate; keep product and company names,
  keep technical terms in English inside Vietnamese text). Keep it under ~14 words.
- "vi" / "en": 1–2 sentences on what happened and why it matters for people working in tech.
- "points_vi" / "points_en": only for items with "headline": true and non-empty content, 2–3 short key facts
  (max ~18 words each) from the content; otherwise empty arrays.
Paraphrase in your own words — never copy sentences. Use only facts present in the item; do not invent numbers,
dates, names or quotes. If the item says little, keep the summary short rather than guessing.

Also write "intro": 2 sentences summarising the day's main themes, in both languages.

Items:
${JSON.stringify(items, null, 1)}`;

  try {
    const json = await geminiJSON(prompt, SCHEMA, { temperature: 0.3 });
    if (!json.intro || !Array.isArray(json.items)) throw new Error('Unexpected response shape');
    const map = {};
    for (const it of json.items) {
      if (!it?.key || !it.vi || !it.en) continue;
      map[it.key] = {
        title: { vi: it.title_vi, en: it.title_en },
        summary: { vi: it.vi, en: it.en },
        points: { vi: (it.points_vi ?? []).slice(0, 3), en: (it.points_en ?? []).slice(0, 3) },
      };
    }
    aiStatus.ok = true;
    aiStatus.summarized = Object.keys(map).length;
    console.log(
      `✨ Gemini (${aiStatus.model}) summarized ${aiStatus.summarized}/${items.length} stories`,
    );
    return { intro: json.intro, items: map };
  } catch (e) {
    aiStatus.error = e.message.slice(0, 300);
    console.warn(`⚠ AI summaries skipped: ${e.message}`);
    return null;
  }
}
