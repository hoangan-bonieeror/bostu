import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { TocItem, renderMarkdown, renderMermaid } from '../core/markdown';
import { PostMeta } from '../core/models';
import { mountSqlRunners } from '../core/sql-runner';
import { StoreService } from '../core/store.service';
import { PostCard } from '../shared/post-card';

@Component({
  selector: 'app-post',
  imports: [RouterLink, PostCard],
  template: `
    <div class="read-progress" [style.width.%]="progress()"></div>

    @if (meta(); as m) {
      @let c = category();
      <a class="back-link" [routerLink]="c ? ['/c', c.id] : ['/']"
        >← {{ c ? i18n.pick(c.title) : i18n.t('nav.home') }}</a
      >

      <header class="post-hero">
        @if (m.cover) {
          <img class="post-hero-cover" [src]="m.cover" [alt]="i18n.pick(m.title)" />
        }
        <div class="post-hero-text">
          <div class="pc-kicker">
            @if (c) {
              <a
                class="cat-chip"
                [routerLink]="['/c', c.id]"
                [style.--c1]="c.colors[0]"
                [style.--c2]="c.colors[1]"
                >{{ c.icon }} {{ i18n.pick(c.title) }}</a
              >
            }
            @if (m.type === 'note') {
              <span class="type-badge">{{ i18n.t('type.note') }}</span>
            }
          </div>
          <h1>{{ i18n.pick(m.title) }}</h1>
          <p class="lead">{{ i18n.pick(m.summary) }}</p>
          <div class="byline">
            <span class="avatar" [class.bot]="m.type === 'radar'">{{
              m.type === 'radar' ? '🤖' : initials(m.author)
            }}</span>
            <span>
              <strong>{{ m.author }}</strong>
              <span class="muted small"
                >{{ i18n.date(m.date, 'long') }} · {{ m.minutes[i18n.lang()] }}
                {{ i18n.t('common.minRead') }}</span
              >
            </span>
            <span class="byline-actions">
              @if (read()) {
                <span class="done-badge">✓ {{ i18n.t('post.read') }}</span>
              }
              <button
                class="btn ghost small-btn"
                [class.on]="bookmarked()"
                (click)="store.toggleBookmark(m.id)"
              >
                🔖 {{ bookmarked() ? i18n.t('post.bookmarked') : i18n.t('post.bookmark') }}
              </button>
            </span>
          </div>
          @if (m.tags.length) {
            <div class="tag-row">
              @for (t of m.tags; track t) {
                <a class="tag-pill" [routerLink]="['/tag', t]">#{{ t }}</a>
              }
            </div>
          }
        </div>
      </header>

      @if (fallback()) {
        <p class="notice">{{ i18n.t('post.fallback') }}</p>
      }

      <div class="post-layout">
        <div class="post-main">
          @if (seriesInfo(); as s) {
            <div class="series-box">
              <span class="small muted">📚 {{ i18n.t('post.inSeries') }}</span>
              <a [routerLink]="['/series', s.id]"
                ><strong>{{ i18n.pick(s.title) }}</strong></a
              >
              <ol>
                @for (p of s.parts; track p.id) {
                  <li [class.current]="p.id === m.id">
                    @if (p.id === m.id) {
                      <span>{{ i18n.pick(p.title) }}</span>
                    } @else {
                      <a [routerLink]="['/p', p.id]">{{ i18n.pick(p.title) }}</a>
                    }
                  </li>
                }
              </ol>
            </div>
          }

          @if (loading()) {
            <div class="card prose skeleton">
              <span></span><span></span><span></span><span></span>
            </div>
          } @else if (error()) {
            <p class="error">{{ i18n.t('common.error') }}</p>
          } @else {
            <article
              #article
              class="card prose"
              [innerHTML]="html()"
              (click)="onArticleClick($event)"
            ></article>
          }

          @if (seriesInfo(); as s) {
            <nav class="post-nav">
              @if (s.prev; as p) {
                <a class="post-nav-card" [routerLink]="['/p', p.id]">
                  @if (p.cover) {
                    <img [src]="p.cover" alt="" />
                  }
                  <span
                    ><small class="muted">← {{ i18n.t('post.prev') }}</small
                    ><strong>{{ i18n.pick(p.title) }}</strong></span
                  >
                </a>
              } @else {
                <span></span>
              }
              @if (s.next; as n) {
                <a class="post-nav-card next" [routerLink]="['/p', n.id]">
                  <span
                    ><small class="muted">{{ i18n.t('post.next') }} →</small
                    ><strong>{{ i18n.pick(n.title) }}</strong></span
                  >
                  @if (n.cover) {
                    <img [src]="n.cover" alt="" />
                  }
                </a>
              }
            </nav>
          }

          <section class="card notes-box">
            <h2>✍️ {{ i18n.t('post.notes') }}</h2>
            <textarea
              [value]="noteDraft()"
              (input)="onNote($any($event.target).value)"
              [placeholder]="i18n.t('post.notesHint')"
              rows="4"
            ></textarea>
            @if (noteSaved()) {
              <span class="small muted">✓ {{ i18n.t('post.notesSaved') }}</span>
            }
          </section>

          @if (related().length) {
            <section>
              <h2 class="section-title">{{ i18n.t('post.related') }}</h2>
              <div class="post-grid three">
                @for (p of related(); track p.id) {
                  <app-post-card [post]="p" />
                }
              </div>
            </section>
          }
        </div>

        @if (toc().length) {
          <aside class="toc">
            <div class="toc-inner">
              <h4>{{ i18n.t('post.toc') }}</h4>
              <ul>
                @for (item of toc(); track item.id) {
                  <li [class.sub]="item.level === 3" [class.active]="activeId() === item.id">
                    <button type="button" (click)="scrollTo(item.id)">{{ item.text }}</button>
                  </li>
                }
              </ul>
            </div>
          </aside>
        }
      </div>
    } @else if (content.loaded()) {
      <p class="muted">
        {{ i18n.t('common.notFound') }} <a routerLink="/">{{ i18n.t('common.backHome') }}</a>
      </p>
    }

    @if (zoomSrc(); as src) {
      <div class="lightbox" (click)="zoomSrc.set(null)" role="dialog" aria-modal="true">
        <img [src]="src" alt="" />
        <button class="icon-btn lightbox-close" aria-label="Close">✕</button>
      </div>
    }
  `,
})
export class PostPage {
  /** Route param bound via withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  protected readonly content = inject(ContentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly injector = inject(Injector);
  private readonly article = viewChild<ElementRef<HTMLElement>>('article');

  protected readonly html = signal<SafeHtml>('');
  protected readonly toc = signal<TocItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly fallback = signal(false);
  protected readonly progress = signal(0);
  protected readonly activeId = signal('');
  protected readonly zoomSrc = signal<string | null>(null);
  protected readonly noteSaved = signal(false);

  protected readonly meta = computed(() => this.content.postById().get(this.id()));
  protected readonly category = computed(() =>
    this.content.categoryById().get(this.meta()?.category ?? ''),
  );
  protected readonly read = computed(() => !!this.store.state().read[this.id()]);
  protected readonly bookmarked = computed(() => !!this.store.state().bookmarks[this.id()]);
  protected readonly noteDraft = linkedSignal(
    () => this.store.state().notes[this.id()]?.text ?? '',
  );

  protected readonly seriesInfo = computed(() => {
    const m = this.meta();
    const s = m?.series ? this.content.seriesById().get(m.series) : undefined;
    if (!m || !s) return null;
    const parts = this.content
      .posts()
      .filter((p) => p.series === s.id)
      .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
    const i = parts.findIndex((p) => p.id === m.id);
    return {
      ...s,
      parts,
      prev: parts[i - 1] as PostMeta | undefined,
      next: parts[i + 1] as PostMeta | undefined,
    };
  });

  /** Same category first, then shared tags; newest first. */
  protected readonly related = computed(() => {
    const m = this.meta();
    if (!m) return [];
    return this.content
      .posts()
      .filter((p) => p.id !== m.id)
      .map((p) => ({
        p,
        score:
          (p.category === m.category ? 3 : 0) + p.tags.filter((t) => m.tags.includes(t)).length * 2,
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.p.date.localeCompare(a.p.date))
      .slice(0, 3)
      .map((x) => x.p);
  });

  private observer?: IntersectionObserver;
  private noteTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Reload when the post, language or theme changes (theme re-colors diagrams).
    effect(() => {
      const id = this.id();
      const lang = this.i18n.lang();
      const dark = this.store.settings().theme === 'dark';
      this.loading.set(true);
      this.error.set(false);
      this.content
        .postMarkdown(id, lang)
        .then(({ md, lang: got }) => {
          if (id !== this.id()) return; // stale response
          const r = renderMarkdown(md);
          // Posts are first-party Markdown shipped in this repo, so the HTML is trusted.
          this.html.set(this.sanitizer.bypassSecurityTrustHtml(r.html));
          this.toc.set(r.toc);
          this.fallback.set(got !== lang);
          this.loading.set(false);
          afterNextRender(() => this.enhance(r.hasMermaid, r.hasSql, dark), {
            injector: this.injector,
          });
        })
        .catch(() => {
          this.error.set(true);
          this.loading.set(false);
        });
    });

    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      clearTimeout(this.noteTimer);
    });
  }

  private async enhance(hasMermaid: boolean, hasSql: boolean, dark: boolean) {
    const el = this.article()?.nativeElement;
    if (!el) return;
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) this.activeId.set(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    el.querySelectorAll('h2[id], h3[id]').forEach((h) => this.observer!.observe(h));
    this.onScroll();
    if (hasSql) {
      mountSqlRunners(el, { loadDb: (n) => this.content.sqlDatabase(n), t: (k) => this.i18n.t(k) });
    }
    if (hasMermaid) await renderMermaid(el, dark);
  }

  @HostListener('window:scroll')
  protected onScroll() {
    const el = this.article()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight * 0.6;
    const done = Math.min(Math.max(-rect.top + 80, 0), Math.max(total, 1));
    const pct = total > 0 ? (done / total) * 100 : 100;
    this.progress.set(pct);
    if (pct >= 92) this.store.markRead(this.id());
  }

  @HostListener('document:keydown.escape')
  protected closeZoom() {
    this.zoomSrc.set(null);
  }

  protected onArticleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const copy = target.closest<HTMLButtonElement>('[data-copy]');
    if (copy) {
      const code = copy.closest('.code-block')?.querySelector('code')?.textContent ?? '';
      navigator.clipboard?.writeText(code).then(() => {
        copy.textContent = '✓';
        setTimeout(() => (copy.textContent = '⧉'), 1500);
      });
      return;
    }
    if (target instanceof HTMLImageElement && target.hasAttribute('data-zoom'))
      this.zoomSrc.set(target.src);
  }

  protected onNote(text: string) {
    this.noteDraft.set(text);
    this.noteSaved.set(false);
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => {
      this.store.saveNote(this.id(), text);
      this.noteSaved.set(true);
    }, 600);
  }

  protected scrollTo(id: string) {
    // Hash routing owns the URL fragment, so scroll manually instead of href="#id".
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeId.set(id);
  }

  protected initials(name: string) {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
