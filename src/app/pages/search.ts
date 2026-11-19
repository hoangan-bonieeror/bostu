import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { Lang, PostMeta } from '../core/models';
import { PostCard } from '../shared/post-card';

/** Lowercase, strip Vietnamese diacritics so "thiet ke" matches "thiết kế". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

interface Hit {
  post: PostMeta;
  score: number;
  snippet: { text: string; hl: boolean }[];
}

@Component({
  selector: 'app-search',
  imports: [PostCard],
  template: `
    <header class="page-head">
      <h1>🔍 {{ i18n.t('nav.search') }}</h1>
      <input
        #box
        class="search-input"
        type="search"
        [value]="query()"
        (input)="onInput($any($event.target).value)"
        [placeholder]="i18n.t('search.placeholder')"
        [attr.aria-label]="i18n.t('nav.search')"
      />
    </header>

    @if (query().trim().length < 2) {
      <p class="muted">{{ i18n.t('search.hint') }}</p>
    } @else {
      <p class="muted small">{{ hits().length }} {{ i18n.t('search.results') }}</p>
      @for (h of hits(); track h.post.id) {
        <div class="search-hit">
          <app-post-card [post]="h.post" variant="row" />
          @if (h.snippet.length) {
            <p class="search-snippet">
              …
              @for (s of h.snippet; track $index) {
                @if (s.hl) {
                  <mark>{{ s.text }}</mark>
                } @else {
                  {{ s.text }}
                }
              }
              …
            </p>
          }
        </div>
      } @empty {
        <p class="muted">{{ i18n.t('search.none') }}</p>
      }
    }
  `,
})
export class SearchPage {
  readonly q = input<string>();
  protected readonly i18n = inject(I18n);
  private readonly content = inject(ContentService);
  private readonly router = inject(Router);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  protected readonly query = linkedSignal(() => this.q() ?? '');
  private readonly index = signal<Map<string, string>>(new Map());

  constructor() {
    effect(() => {
      const lang: Lang = this.i18n.lang();
      this.content
        .searchIndex(lang)
        .then((rows) => this.index.set(new Map(rows.map((r) => [r.id, r.text]))))
        .catch(() => this.index.set(new Map()));
    });
    afterNextRender(() => this.box()?.nativeElement.focus());
  }

  protected onInput(v: string) {
    this.query.set(v);
    this.router.navigate([], { queryParams: { q: v || null }, replaceUrl: true });
  }

  protected readonly hits = computed<Hit[]>(() => {
    const terms = fold(this.query())
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    if (!terms.length) return [];
    const idx = this.index();
    const out: Hit[] = [];
    for (const p of this.content.posts()) {
      const title = fold(this.i18n.pick(p.title));
      const summary = fold(this.i18n.pick(p.summary));
      const tags = fold(p.tags.join(' '));
      const raw = idx.get(p.id) ?? '';
      const text = fold(raw);
      let score = 0;
      let all = true;
      for (const t of terms) {
        const s =
          (title.includes(t) ? 6 : 0) +
          (tags.includes(t) ? 4 : 0) +
          (summary.includes(t) ? 2 : 0) +
          Math.min(5, text.split(t).length - 1);
        if (!s) all = false;
        score += s;
      }
      if (all && score) out.push({ post: p, score, snippet: this.snippet(raw, text, terms) });
    }
    return out.sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date));
  });

  /** ~180 characters around the first match, with matches highlighted. */
  private snippet(raw: string, folded: string, terms: string[]) {
    const pos = Math.min(...terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0));
    if (!isFinite(pos)) return [];
    const start = Math.max(0, pos - 70);
    const end = Math.min(raw.length, pos + 110);
    const seg = raw.slice(start, end);
    const fseg = folded.slice(start, end);
    const parts: { text: string; hl: boolean }[] = [];
    let i = 0;
    while (i < seg.length) {
      let next = -1;
      let len = 0;
      for (const t of terms) {
        const j = fseg.indexOf(t, i);
        if (j >= 0 && (next < 0 || j < next)) {
          next = j;
          len = t.length;
        }
      }
      if (next < 0) {
        parts.push({ text: seg.slice(i), hl: false });
        break;
      }
      if (next > i) parts.push({ text: seg.slice(i, next), hl: false });
      parts.push({ text: seg.slice(next, next + len), hl: true });
      i = next + len;
    }
    return parts;
  }
}
