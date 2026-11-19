// Generates a language-neutral SVG cover (1200×630) for a Tech Radar post.
import { CATEGORIES } from './config.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {{ week:number, year:number, from:string, to:string, counts:Record<string,number>, items:Array<{category:string,score:number}> }} p
 */
export function renderCover({ week, year, from, to, counts, items }) {
  const cx = 860;
  const cy = 315;
  const R = 250;
  const cats = CATEGORIES.map((c, i) => ({
    ...c,
    angle: (i / CATEGORIES.length) * Math.PI * 2 - Math.PI / 2,
  }));
  const maxScore = Math.max(1, ...items.map((i) => i.score));

  // One blip per item: angle by category, distance by score (higher score = closer to center).
  const blips = items
    .slice(0, 40)
    .map((it, i) => {
      const cat = cats.find((c) => c.id === it.category);
      if (!cat) return '';
      const spread = ((i * 37) % 100) / 100 - 0.5;
      const a = cat.angle + spread * ((Math.PI * 2) / CATEGORIES.length) * 0.8;
      const d = R * (0.22 + 0.72 * (1 - it.score / maxScore));
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const r = i < 5 ? 11 : 7;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${i < 5 ? '#34d399' : '#a5b4fc'}" fill-opacity="${i < 5 ? 1 : 0.85}"/>`;
    })
    .join('');

  const spokes = cats
    .map((c) => {
      const x = cx + Math.cos(c.angle) * (R + 6);
      const y = cy + Math.sin(c.angle) * (R + 6);
      const lx = cx + Math.cos(c.angle + Math.PI / CATEGORIES.length) * (R - 30);
      const ly = cy + Math.sin(c.angle + Math.PI / CATEGORIES.length) * (R - 30);
      return (
        `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#818cf8" stroke-opacity=".35" stroke-width="2"/>` +
        `<text x="${lx.toFixed(1)}" y="${(ly + 10).toFixed(1)}" font-size="28" text-anchor="middle" opacity=".9">${c.icon}</text>`
      );
    })
    .join('');

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, n], i) => {
      const c = CATEGORIES.find((x) => x.id === id);
      const x = 70 + i * 128;
      return `<g><rect x="${x}" y="436" width="116" height="64" rx="16" fill="#ffffff" fill-opacity=".1" stroke="#a5b4fc" stroke-opacity=".4"/>
        <text x="${x + 34}" y="478" font-size="26" text-anchor="middle">${c?.icon ?? '•'}</text>
        <text x="${x + 80}" y="479" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">${n}</text></g>`;
    })
    .join('');

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" font-family="Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1026"/><stop offset="1" stop-color="#312e81"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#6366f1" stop-opacity=".45"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34d399" stop-opacity="0"/><stop offset="1" stop-color="#34d399" stop-opacity=".45"/></linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" fill-opacity=".08"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <circle cx="${cx}" cy="${cy}" r="${R + 60}" fill="url(#glow)"/>
  ${[1, 0.75, 0.5, 0.25].map((k) => `<circle cx="${cx}" cy="${cy}" r="${R * k}" fill="none" stroke="#818cf8" stroke-opacity="${0.25 + (1 - k) * 0.3}" stroke-width="2"/>`).join('')}
  ${spokes}
  <path d="M${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${(cx + R * Math.cos(-0.6)).toFixed(1)} ${(cy + R * Math.sin(-0.6)).toFixed(1)} Z" fill="url(#sweep)"/>
  ${blips}
  <circle cx="${cx}" cy="${cy}" r="9" fill="#34d399"/>

  <text x="70" y="150" font-size="26" font-weight="800" fill="#a5b4fc" letter-spacing="6">TECH RADAR</text>
  <text x="66" y="262" font-size="110" font-weight="900" fill="#ffffff" letter-spacing="-3">W${String(week).padStart(2, '0')}</text>
  <text x="72" y="320" font-size="40" font-weight="700" fill="#c7d2fe">${year}</text>
  <text x="72" y="362" font-family="'JetBrains Mono', Consolas, monospace" font-size="24" fill="#a5b4fc">${esc(from)} → ${esc(to)}</text>
  <text x="72" y="404" font-size="22" font-weight="700" fill="#34d399">● ${total} signals</text>
  ${top}
</svg>`;
}
