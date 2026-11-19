// Optional: ask Google Gemini to write short bilingual summaries for the selected items.
// Enabled only when GEMINI_API_KEY is set; otherwise the bot uses original descriptions.
//
// Get a free key at https://aistudio.google.com/apikey
// GEMINI_MODEL defaults to the "gemini-flash-latest" alias (always the newest Flash model);
// pin a specific model id (e.g. from https://ai.google.dev/gemini-api/docs/models) for stable output.

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

/** Outcome of the last summarize() call, recorded in radar-status.json for troubleshooting. */
export const aiStatus = { enabled: false, ok: false, model: MODEL, summarized: 0, error: null };
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** JSON schema Gemini must follow (structured output). */
const RESPONSE_SCHEMA = {
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
          vi: { type: 'STRING' },
          en: { type: 'STRING' },
          points_vi: { type: 'ARRAY', items: { type: 'STRING' } },
          points_en: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['key', 'vi', 'en'],
      },
    },
  },
  required: ['intro', 'items'],
};

/**
 * @param {Array<{key:string,title:string,description:string,source:string,category:string}>} items
 * @returns {Promise<null | { intro: {vi:string,en:string}, items: Record<string,{vi:string,en:string}> }>}
 */
export async function summarize(items) {
  const key = process.env.GEMINI_API_KEY;
  aiStatus.enabled = !!key;
  if (!key || !items.length) return null;

  const prompt = `You are writing a weekly "Tech Radar" digest for a backend developer who is upskilling
(roadmap: HTTP, REST APIs, SQL, database design, auth, testing, Docker/CI, caching, queues, security, system design).

Each item may include "content": text crawled from the linked article, README or release notes.
For EACH item:
- "vi" / "en": a concise 1–2 sentence summary of what it is and why a backend developer might care.
- "points_vi" / "points_en": for items with "highlight": true and non-empty content, 2–3 short key takeaways
  (max ~20 words each) taken from the content; otherwise return empty arrays.
Write Vietnamese for "vi"/"points_vi" and English for "en"/"points_en"; keep technical terms in English inside
Vietnamese text. Paraphrase in your own words — never copy sentences from the content. Only use facts present in the
item; do not invent features, numbers, versions or dates. Return one entry per item, using the item's "key".

Also write a 2–3 sentence overview ("intro") of the week's themes in both languages.

Items:
${JSON.stringify(items, null, 1)}`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text)
      throw new Error(
        `Empty response (finishReason: ${data.candidates?.[0]?.finishReason ?? 'unknown'})`,
      );

    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (!json.intro || !Array.isArray(json.items)) throw new Error('Unexpected response shape');

    // Turn the array into a lookup keyed by item key (what render.mjs expects).
    const map = {};
    for (const it of json.items) {
      if (!it?.key || !it.vi || !it.en) continue;
      map[it.key] = {
        vi: it.vi,
        en: it.en,
        points: { vi: (it.points_vi ?? []).slice(0, 3), en: (it.points_en ?? []).slice(0, 3) },
      };
    }
    aiStatus.ok = true;
    aiStatus.summarized = Object.keys(map).length;
    console.log(`✨ Gemini (${MODEL}) summarized ${Object.keys(map).length}/${items.length} items`);
    return { intro: json.intro, items: map };
  } catch (e) {
    aiStatus.error = e.message.slice(0, 300);
    console.warn(`⚠ AI summaries skipped: ${e.message}`);
    return null;
  }
}
