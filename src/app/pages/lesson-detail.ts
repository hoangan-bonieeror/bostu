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
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { TocItem, renderMarkdown, renderMermaid } from '../core/markdown';
import { LessonMeta, Skill, SqlExercise, isRadar, lessonCover } from '../core/models';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-lesson-detail',
  imports: [RouterLink],
  template: `
    <div class="read-progress" [style.width.%]="progress()"></div>

    <a
      class="back-link"
      routerLink="/lessons"
      [queryParams]="radar() ? { skill: 'tech-radar' } : null"
      >← {{ i18n.t('lessons.allPosts') }}</a
    >

    @if (meta(); as m) {
      <header class="post-hero">
        <img class="post-hero-cover" [src]="cover(m)" [alt]="i18n.pick(m.title)" />
        <div class="post-hero-text">
          <span class="tag">{{ skill()?.icon }} {{ i18n.pick(skill()?.title) }}</span>
          <h1>{{ i18n.pick(m.title) }}</h1>
          <p class="lead">{{ i18n.pick(m.summary) }}</p>
          <div class="byline">
            @if (radar()) {
              <span class="avatar bot">🤖</span>
            } @else {
              <span class="avatar">AN</span>
            }
            <span>
              <strong>{{ radar() ? 'Tech Radar Bot' : 'An Nguyen' }}</strong>
              <span class="muted small">
                @if (m.date) {
                  {{ formatDate(m.date) }} ·
                }
                ⏱ {{ m.minutes }} {{ i18n.t('common.minutes') }} · {{ words() }}
                {{ i18n.t('lessons.words') }}
              </span>
            </span>
            @if (done()) {
              <span class="done-badge">✓ {{ i18n.t('lessons.done') }}</span>
            }
          </div>
        </div>
      </header>
    }

    @if (fallback()) {
      <p class="notice">{{ i18n.t('lessons.fallback') }}</p>
    }

    <div class="post-layout">
      <div class="post-main">
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

        @if (relatedExercises().length) {
          <div class="card practice">
            <h2>🧪 {{ i18n.t('lessons.practice') }}</h2>
            <div class="btn-row">
              @for (ex of relatedExercises(); track ex.id) {
                <a class="btn ghost" routerLink="/sql" [queryParams]="{ ex: ex.id }">
                  {{ store.state().sqlSolved[ex.id] ? '✓' : '○' }} {{ i18n.pick(ex.title) }}
                </a>
              }
            </div>
          </div>
        }

        @if (meta(); as m) {
          <div class="finish-box">
            @if (done()) {
              <p>🎉 {{ i18n.t('lessons.finished') }}</p>
              <button class="btn ghost" (click)="store.setLessonDone(m.id, false)">
                ↺ {{ i18n.t('lessons.markUndone') }}
              </button>
            } @else {
              <p>{{ i18n.t('lessons.finishPrompt') }}</p>
              <button class="btn big" (click)="complete(m)">
                ✓ {{ i18n.t('lessons.markDone') }}
              </button>
            }
          </div>

          <nav class="post-nav">
            @if (prev(); as p) {
              <a class="post-nav-card" [routerLink]="['/lessons', p.id]">
                <img [src]="cover(p)" alt="" />
                <span
                  ><small class="muted">← {{ i18n.t('lessons.prev') }}</small
                  ><strong>{{ i18n.pick(p.title) }}</strong></span
                >
              </a>
            } @else {
              <span></span>
            }
            @if (next(); as n) {
              <a class="post-nav-card next" [routerLink]="['/lessons', n.id]">
                <span
                  ><small class="muted">{{ i18n.t('lessons.next') }} →</small
                  ><strong>{{ i18n.pick(n.title) }}</strong></span
                >
                <img [src]="cover(n)" alt="" />
              </a>
            }
          </nav>
        }
      </div>

      @if (toc().length) {
        <aside class="toc">
          <div class="toc-inner">
            <h4>{{ i18n.t('lessons.toc') }}</h4>
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

    @if (zoomSrc(); as src) {
      <div class="lightbox" (click)="zoomSrc.set(null)" role="dialog" aria-modal="true">
        <img [src]="src" alt="" />
        <button class="icon-btn lightbox-close" aria-label="Close">✕</button>
      </div>
    }
  `,
})
export class LessonDetailPage {
  /** Route param bound via withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly injector = inject(Injector);
  private readonly article = viewChild<ElementRef<HTMLElement>>('article');

  private readonly lessons = signal<LessonMeta[]>([]);
  private readonly skills = signal<Skill[]>([]);
  private readonly exercises = signal<SqlExercise[]>([]);
  protected readonly html = signal<SafeHtml>('');
  protected readonly toc = signal<TocItem[]>([]);
  protected readonly words = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly fallback = signal(false);
  protected readonly progress = signal(0);
  protected readonly activeId = signal('');
  protected readonly zoomSrc = signal<string | null>(null);
  protected readonly cover = lessonCover;

  protected readonly meta = computed(() => this.lessons().find((l) => l.id === this.id()));
  protected readonly radar = computed(() => isRadar(this.meta()));
  /** Prev/next stay inside the same series: curriculum lessons or Tech Radar posts. */
  private readonly series = computed(() =>
    this.lessons().filter((l) => isRadar(l) === this.radar()),
  );
  private readonly index = computed(() => this.series().findIndex((l) => l.id === this.id()));
  protected readonly skill = computed(() => this.skills().find((s) => s.id === this.meta()?.skill));
  protected readonly prev = computed(() =>
    this.index() > 0 ? this.series()[this.index() - 1] : undefined,
  );
  protected readonly next = computed(() =>
    this.index() >= 0 ? this.series()[this.index() + 1] : undefined,
  );
  protected readonly done = computed(() => !!this.store.state().lessonsDone[this.id()]);
  protected readonly relatedExercises = computed(() => {
    const ids = this.meta()?.sqlExercises ?? [];
    return this.exercises().filter((e) => ids.includes(e.id));
  });

  private observer?: IntersectionObserver;

  constructor() {
    this.content
      .lessons()
      .then((v) => this.lessons.set(v))
      .catch(() => {});
    this.content
      .skills()
      .then((v) => this.skills.set(v))
      .catch(() => {});
    this.content
      .sqlLab()
      .then((v) => this.exercises.set(v.exercises))
      .catch(() => {});

    // Reload when the lesson, language or theme changes (theme re-colors diagrams).
    effect(() => {
      const id = this.id();
      const lang = this.i18n.lang();
      const dark = this.store.settings().theme === 'dark';
      this.loading.set(true);
      this.error.set(false);
      this.content
        .lessonMarkdown(id, lang)
        .then(({ md, lang: got }) => {
          if (id !== this.id()) return; // stale response
          const r = renderMarkdown(md);
          // Lesson content is first-party markdown shipped in this repo, so it is trusted.
          this.html.set(this.sanitizer.bypassSecurityTrustHtml(r.html));
          this.toc.set(r.toc);
          this.words.set(r.words);
          this.fallback.set(got !== lang);
          this.loading.set(false);
          afterNextRender(() => this.enhance(r.hasMermaid, dark), { injector: this.injector });
        })
        .catch(() => {
          this.error.set(true);
          this.loading.set(false);
        });
    });

    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  /** Post-render work on the article DOM: diagrams and scroll-spy for the TOC. */
  private async enhance(hasMermaid: boolean, dark: boolean) {
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
    if (hasMermaid) await renderMermaid(el, dark);
  }

  @HostListener('window:scroll')
  protected onScroll() {
    const el = this.article()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight * 0.6;
    const read = Math.min(Math.max(-rect.top + 80, 0), Math.max(total, 1));
    this.progress.set(total > 0 ? (read / total) * 100 : 100);
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
    if (target instanceof HTMLImageElement && target.hasAttribute('data-zoom')) {
      this.zoomSrc.set(target.src);
    }
  }

  protected scrollTo(id: string) {
    // Hash routing owns the URL fragment, so scroll manually instead of href="#id".
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeId.set(id);
  }

  protected complete(m: LessonMeta) {
    this.store.setLessonDone(m.id, true, m.minutes);
  }

  protected formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString(
      this.i18n.lang() === 'vi' ? 'vi-VN' : 'en-US',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      },
    );
  }
}
