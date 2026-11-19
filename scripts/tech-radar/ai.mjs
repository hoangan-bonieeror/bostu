// Optional: ask Google Gemini to write short bilingual summaries for the selected items.
// Enabled only when GEMINI_API_KEY is set; otherwise the bot uses original descriptions.
//
// Get a free key at https://aistudio.google.com/apikey
// GEMINI_MODEL defaults to the "gemini-flash-latest" alias (always the newest Flash model);
// pin a specific model id (e.g. from https://ai.google.dev/gemini-api/docs/models) for stable output.

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
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
        properties: { key: { type: 'STRING' }, vi: { type: 'STRING' }, en: { type: 'STRING' } },
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
  if (!key || !items.length) return null;

  const prompt = `You are writing a weekly "Tech Radar" digest for a backend developer who is upskilling
(roadmap: HTTP, REST APIs, SQL, database design, auth, testing, Docker/CI, caching, queues, security, system design).

For EACH item below, write a concise 1–2 sentence summary explaining what it is and why a backend developer
might care, in Vietnamese ("vi") and English ("en"). Keep technical terms in English inside the Vietnamese text.
Only use information given in the item; do not invent features, numbers or dates. If an item is unclear, say what it
appears to be based on its title. Return one entry per item, using the item's "key".

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
          maxOutputTokens: 8192,
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
    for (const it of json.items)
      if (it?.key && it.vi && it.en) map[it.key] = { vi: it.vi, en: it.en };
    console.log(`✨ Gemini (${MODEL}) summarized ${Object.keys(map).length}/${items.length} items`);
    return { intro: json.intro, items: map };
  } catch (e) {
    console.warn(`⚠ AI summaries skipped: ${e.message}`);
    return null;
  }
}
