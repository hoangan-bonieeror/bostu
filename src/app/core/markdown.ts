import { Marked, Tokens } from 'marked';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import http from 'highlight.js/lib/languages/http';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('http', http);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('yaml', yaml);

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocItem[];
  hasMermaid: boolean;
  words: number;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** URL-safe id that also works for Vietnamese headings ("Vòng đời" → "vong-doi"). */
export function slugify(text: string): string {
  return (
    text
      .replace(/<[^>]+>/g, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

const LANG_LABEL: Record<string, string> = {
  sql: 'SQL',
  python: 'Python',
  http: 'HTTP',
  bash: 'Bash',
  json: 'JSON',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  yaml: 'YAML',
  dockerfile: 'Dockerfile',
};

const CALLOUTS: Record<string, { icon: string; cls: string }> = {
  NOTE: { icon: 'ℹ️', cls: 'note' },
  TIP: { icon: '💡', cls: 'tip' },
  IMPORTANT: { icon: '⭐', cls: 'important' },
  WARNING: { icon: '⚠️', cls: 'warning' },
  CAUTION: { icon: '🛑', cls: 'caution' },
};

/**
 * Render first-party lesson markdown (shipped in this repo) to blog-ready HTML.
 * Supports: heading anchors + TOC, figures with captions, code labels + copy button,
 * ```mermaid diagrams, and GitHub-style callouts (> [!TIP]).
 */
export function renderMarkdown(md: string): RenderedMarkdown {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  let hasMermaid = false;

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(
        this: { parser: { parseInline(t: Tokens.Generic[]): string } },
        { tokens, depth, text }: Tokens.Heading,
      ) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1) return ''; // the page hero already shows the title
        let id = slugify(text);
        const n = used.get(id) ?? 0;
        used.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth <= 3) toc.push({ id, text: inner.replace(/<[^>]+>/g, ''), level: depth });
        return `<h${depth} id="${id}" class="anchor-heading">${inner}</h${depth}>`;
      },
      code({ text, lang }: Tokens.Code) {
        const language = (lang ?? '').split(/\s/)[0].toLowerCase();
        if (language === 'mermaid') {
          hasMermaid = true;
          return `<figure class="diagram"><div class="mermaid-src" data-src="${escapeHtml(text)}"><pre>${escapeHtml(text)}</pre></div></figure>`;
        }
        const html =
          language && hljs.getLanguage(language)
            ? hljs.highlight(text, { language }).value
            : escapeHtml(text);
        const label = LANG_LABEL[language] ?? (language || 'text');
        return (
          `<div class="code-block"><div class="code-head"><span>${escapeHtml(label)}</span>` +
          `<button type="button" class="copy-btn" data-copy aria-label="Copy">⧉</button></div>` +
          `<pre><code class="hljs language-${escapeHtml(language || 'text')}">${html}</code></pre></div>`
        );
      },
      image({ href, title, text }: Tokens.Image) {
        const caption = title || text;
        return (
          `<figure class="figure"><img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" data-zoom />` +
          (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '') +
          `</figure>`
        );
      },
      link({ href, text }: Tokens.Link) {
        const external = /^https?:\/\//.test(href);
        return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
      },
      table(this: { parser: { parseInline(t: Tokens.Generic[]): string } }, token: Tokens.Table) {
        const cell = (c: Tokens.TableCell, tag: 'th' | 'td') =>
          `<${tag}${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        const head = `<tr>${token.header.map((c) => cell(c, 'th')).join('')}</tr>`;
        const body = token.rows
          .map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`)
          .join('');
        return `<div class="table-scroll"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
      },
    },
  });

  let html = marked.parse(md, { async: false }) as string;

  // GitHub-style callouts: <blockquote><p>[!TIP] ... → styled box
  html = html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/g,
    (_m, kind: string) => {
      const c = CALLOUTS[kind];
      return `<blockquote class="callout callout-${c.cls}"><p><span class="callout-icon">${c.icon}</span>`;
    },
  );

  // Paragraphs that only contain a figure: unwrap so <figure> isn't inside <p>.
  html = html.replace(/<p>\s*(<figure[\s\S]*?<\/figure>)\s*<\/p>/g, '$1');

  const words = md
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return { html, toc, hasMermaid, words };
}

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

/** Render all ```mermaid blocks inside `root`. Mermaid is loaded only when a lesson needs it. */
export async function renderMermaid(root: HTMLElement, dark: boolean): Promise<void> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-src'));
  if (!nodes.length) return;
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  const mermaid = await mermaidPromise;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'base',
    fontFamily: 'Inter, system-ui, sans-serif',
    themeVariables: dark
      ? { fontSize: '15px' }
      : {
          fontSize: '15px',
          primaryColor: '#eceafd',
          primaryBorderColor: '#6d63e8',
          primaryTextColor: '#1c2033',
          lineColor: '#6d63e8',
          secondaryColor: '#e3f6ec',
          tertiaryColor: '#fff6dd',
          actorBkg: '#eceafd',
          actorBorder: '#6d63e8',
          noteBkgColor: '#fff6dd',
          noteBorderColor: '#e0b44a',
        },
  });
  let i = 0;
  for (const node of nodes) {
    const src = node.dataset['src'] ?? '';
    try {
      const { svg } = await mermaid.render(`mmd-${Date.now()}-${i++}`, src);
      node.innerHTML = svg;
      node.classList.add('rendered');
    } catch (e) {
      node.innerHTML = `<pre class="mermaid-error">${escapeHtml(String(e))}</pre>`;
    }
  }
}
