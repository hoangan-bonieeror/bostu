// Minimal front-matter parser/serializer for post files (a small YAML subset, no dependency).
//
//   ---
//   title: "Rate limiter"          # strings (quoted or bare)
//   date: 2026-11-19
//   tags: [caching, redis]         # inline arrays
//   seriesOrder: 2                 # numbers
//   ---
//   Markdown body…

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseValue(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((x) => parseValue(x))
      .filter((x) => x !== '');
  }
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
}

/** @returns {{ data: Record<string, unknown>, body: string }} */
export function parseFrontmatter(text) {
  const m = text.match(FM);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (kv) data[kv[1]] = parseValue(kv[2].replace(/\s+#.*$/, ''));
  }
  return { data, body: text.slice(m[0].length) };
}

export function stringifyFrontmatter(data) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
      if (typeof v === 'number' || typeof v === 'boolean') return `${k}: ${v}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v) || /^[a-z0-9-]+$/.test(v)) return `${k}: ${v}`;
      return `${k}: ${JSON.stringify(v)}`;
    });
  return `---\n${lines.join('\n')}\n---\n`;
}

/** Strip front matter in the browser too (same regex). */
export const FRONTMATTER_RE = FM;
