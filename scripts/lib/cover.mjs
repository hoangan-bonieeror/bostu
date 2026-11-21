// Generates a language-neutral 1200×630 SVG cover for posts that don't ship their own.
// Style follows the category colours; shapes are seeded from the post id so each cover differs.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Category-specific motif drawn on the right side. */
const MOTIFS = {
  'system-design': (r) => {
    // boxes connected like an architecture diagram
    const nodes = [
      [720, 140],
      [930, 140],
      [620, 320],
      [825, 320],
      [1030, 320],
      [720, 480],
      [930, 480],
    ];
    let s = '';
    const edges = [
      [0, 2],
      [0, 3],
      [1, 3],
      [1, 4],
      [2, 5],
      [3, 5],
      [3, 6],
      [4, 6],
    ];
    for (const [a, b] of edges)
      s += `<line x1="${nodes[a][0] + 70}" y1="${nodes[a][1] + 40}" x2="${nodes[b][0] + 70}" y2="${nodes[b][1] + 40}" stroke="#fff" stroke-opacity=".45" stroke-width="4"/>`;
    nodes.forEach(([x, y], i) => {
      const hl = r() > 0.6 || i === 3;
      s += `<rect x="${x}" y="${y}" width="140" height="80" rx="18" fill="${hl ? '#fff' : '#ffffff'}" fill-opacity="${hl ? 1 : 0.18}" stroke="#fff" stroke-opacity=".6" stroke-width="3" filter="url(#sh)"/>`;
      s += `<rect x="${x + 22}" y="${y + 26}" width="${50 + r() * 50}" height="10" rx="5" fill="${hl ? '#1e1b4b' : '#fff'}" fill-opacity=".5"/>`;
      s += `<rect x="${x + 22}" y="${y + 46}" width="${30 + r() * 60}" height="10" rx="5" fill="${hl ? '#1e1b4b' : '#fff'}" fill-opacity=".35"/>`;
    });
    return s;
  },
  dsa: (r) => {
    // bars (sorting) + a small tree
    let s = '';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const h = 60 + Math.round(r() * 220);
      const hl = i === 3 || i === 6;
      s += `<rect x="${640 + i * 54}" y="${560 - h}" width="40" height="${h}" rx="8" fill="#fff" fill-opacity="${hl ? 1 : 0.35}" filter="url(#sh)"/>`;
    }
    const t = [
      [930, 110],
      [860, 200],
      [1000, 200],
      [820, 290],
      [900, 290],
    ];
    s += `<g stroke="#fff" stroke-width="4" stroke-opacity=".7"><line x1="930" y1="110" x2="860" y2="200"/><line x1="930" y1="110" x2="1000" y2="200"/><line x1="860" y1="200" x2="820" y2="290"/><line x1="860" y1="200" x2="900" y2="290"/></g>`;
    t.forEach(
      ([x, y], i) =>
        (s += `<circle cx="${x}" cy="${y}" r="26" fill="${i === 0 ? '#fde047' : '#fff'}" filter="url(#sh)"/>`),
    );
    return s;
  },
  database: (r) => {
    let s = '';
    for (let k = 0; k < 2; k++) {
      const x = 640 + k * 260;
      const y = 150 + k * 60;
      s += `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="230" height="${70 + 5 * 44}" rx="18" fill="#fff"/>`;
      s += `<rect x="${x}" y="${y}" width="230" height="54" rx="18" fill="#dbeafe"/><rect x="${x}" y="${y + 36}" width="230" height="18" fill="#dbeafe"/>`;
      s += `<rect x="${x + 20}" y="${y + 20}" width="${90 + r() * 60}" height="14" rx="7" fill="#1e3a8a" fill-opacity=".6"/>`;
      for (let i = 0; i < 5; i++) {
        const yy = y + 66 + i * 44;
        s += `<rect x="${x + 16}" y="${yy}" width="198" height="34" rx="8" fill="${i === 0 ? '#fef3c7' : '#f1f5f9'}"/>`;
        s += `<rect x="${x + 30}" y="${yy + 12}" width="${40 + r() * 100}" height="10" rx="5" fill="#64748b" fill-opacity=".5"/>`;
      }
      s += '</g>';
    }
    s += `<path d="M870 230 C 890 230, 880 300, 900 300" stroke="#fff" stroke-width="5" fill="none" stroke-dasharray="4 8" stroke-linecap="round"/>`;
    return s;
  },
  cicd: () => {
    // pipeline stages
    const stages = ['#ffffff', '#ffffff', '#ffffff', '#ffffff'];
    let s = '';
    stages.forEach((_, i) => {
      const x = 620 + i * 140;
      const y = 250 + (i % 2) * 0;
      s += `<circle cx="${x + 50}" cy="${y + 50}" r="50" fill="#fff" fill-opacity="${i < 3 ? 1 : 0.3}" filter="url(#sh)"/>`;
      s +=
        i < 3
          ? `<path d="M${x + 30} ${y + 52} l14 14 l26 -30" stroke="#16a34a" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          : `<circle cx="${x + 50}" cy="${y + 50}" r="16" fill="#fff"/>`;
      if (i < 3)
        s += `<line x1="${x + 104}" y1="${y + 50}" x2="${x + 136}" y2="${y + 50}" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`;
    });
    s += `<path d="M700 470 C 820 560, 1000 560, 1100 420" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none" stroke-dasharray="3 12" stroke-linecap="round"/>`;
    s += `<path d="M1090 160 l40 -60 l40 60 z" fill="#fde047" filter="url(#sh)"/><rect x="1118" y="160" width="24" height="60" fill="#fde047"/>`;
    return s;
  },
  enterprise: (r) => {
    // building blocks connected to a central hub
    let s = '';
    const hub = [880, 315];
    const around = [
      [700, 160],
      [1060, 160],
      [660, 400],
      [1100, 400],
      [880, 520],
    ];
    for (const [x, y] of around)
      s += `<line x1="${hub[0]}" y1="${hub[1]}" x2="${x}" y2="${y}" stroke="#fff" stroke-opacity=".55" stroke-width="5"/>`;
    s += `<circle cx="${hub[0]}" cy="${hub[1]}" r="70" fill="#fff" filter="url(#sh)"/><circle cx="${hub[0]}" cy="${hub[1]}" r="34" fill="#f59e0b"/>`;
    around.forEach(([x, y]) => {
      const h = 60 + Math.round(r() * 40);
      s += `<g filter="url(#sh)"><rect x="${x - 50}" y="${y - h / 2}" width="100" height="${h}" rx="10" fill="#fff"/>`;
      for (let i = 0; i < 3; i++)
        s += `<rect x="${x - 34 + i * 26}" y="${y - h / 2 + 14}" width="16" height="${h - 28}" rx="4" fill="#fed7aa"/>`;
      s += '</g>';
    });
    return s;
  },
  'tech-news': (r) => {
    // a folded newspaper with headline bars and columns
    let s = '<g filter="url(#sh)">';
    s += '<rect x="660" y="120" width="440" height="400" rx="16" fill="#fff"/>';
    s += '<rect x="690" y="150" width="380" height="34" rx="6" fill="#0f766e"/>';
    s += '<rect x="690" y="204" width="180" height="120" rx="8" fill="#fde68a"/>';
    for (let i = 0; i < 5; i++)
      s += `<rect x="890" y="${206 + i * 24}" width="${130 + Math.round(r() * 50)}" height="10" rx="5" fill="#cbd5e1"/>`;
    for (let c = 0; c < 3; c++)
      for (let i = 0; i < 6; i++)
        s += `<rect x="${690 + c * 130}" y="${350 + i * 24}" width="${80 + Math.round(r() * 30)}" height="9" rx="4" fill="#e2e8f0"/>`;
    s += '</g>';
    s +=
      '<circle cx="1110" cy="130" r="34" fill="#f59e0b"/><text x="1110" y="143" font-size="34" text-anchor="middle" fill="#fff" font-weight="800">24h</text>';
    return s;
  },
  backend: () => {
    let s = '';
    for (let i = 0; i < 3; i++)
      s += `<g filter="url(#sh)"><rect x="760" y="${140 + i * 120}" width="340" height="96" rx="18" fill="#1e1b4b"/><circle cx="1060" cy="${188 + i * 120}" r="10" fill="#34d399"/><rect x="790" y="${170 + i * 120}" width="160" height="14" rx="7" fill="#6366f1"/></g>`;
    s += `<path d="M620 300 H 740" stroke="#fff" stroke-width="6" stroke-dasharray="3 12" stroke-linecap="round"/>`;
    return s;
  },
};

/**
 * @param {{ id:string, category:{id:string, icon:string, colors:string[]}, tags:string[], type?:string }} p
 */
export function renderCover({ id, category, tags = [], type }) {
  const r = rng(id);
  const [c1, c2] = category.colors ?? ['#4338ca', '#7c3aed'];
  const motif = (MOTIFS[category.id] ?? MOTIFS.backend)(r);
  const chips = tags
    .slice(0, 3)
    .map((t, i) => {
      const w = Math.max(90, t.length * 15 + 40);
      const x =
        80 + tags.slice(0, i).reduce((a, s) => a + Math.max(90, s.length * 15 + 40) + 14, 0);
      return `<g><rect x="${x}" y="470" width="${w}" height="48" rx="24" fill="#fff" fill-opacity=".16" stroke="#fff" stroke-opacity=".5"/><text x="${x + w / 2}" y="501" text-anchor="middle" font-family="'JetBrains Mono', Consolas, monospace" font-size="22" font-weight="700" fill="#fff">#${esc(t)}</text></g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" font-family="Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="#fff" fill-opacity=".12"/></pattern>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0b1030" flood-opacity=".28"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <circle cx="${980 + r() * 120}" cy="${60 + r() * 60}" r="200" fill="#fff" fill-opacity=".07"/>
  <circle cx="${80 + r() * 80}" cy="${560 + r() * 40}" r="180" fill="#fff" fill-opacity=".06"/>
  ${motif}
  <text x="80" y="250" font-size="150">${category.icon}</text>
  <text x="84" y="350" font-size="26" font-weight="800" fill="#fff" fill-opacity=".85" letter-spacing="6">${esc(type === 'note' ? 'NOTE' : type === 'news' ? 'DAILY NEWS' : category.id.toUpperCase().replace(/-/g, ' '))}</text>
  ${chips}
</svg>`;
}
