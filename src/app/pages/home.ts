import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { BOT_CATEGORIES, NEWS_CATEGORY, RADAR_CATEGORY } from '../core/models';
import { PostCard } from '../shared/post-card';

const PAGE = 9;

@Component({
  selector: 'app-home',
  imports: [RouterLink, PostCard],
  template: `
    <section class="home-hero">
      <h1>{{ i18n.t('home.title') }}</h1>
      <p class="muted">{{ i18n.t('home.subtitle') }}</p>
    </section>

    @if (content.error()) {
      <p class="error">{{ i18n.t('common.error') }}</p>
    }

    <div class="home-layout">
      <div class="home-main">
        @if (featured(); as f) {
          <h2 class="section-title">{{ i18n.t('home.featured') }}</h2>
          <app-post-card [post]="f" variant="featured" />
        }

        <h2 class="section-title">{{ i18n.t('home.latest') }}</h2>
        <div class="post-grid">
          @for (p of latest(); track p.id) {
            <app-post-card [post]="p" />
          }
        </div>
        @if (hasMore()) {
          <div class="center load-more">
            <button class="btn ghost" (click)="shown.set(shown() + PAGE)">
              {{ i18n.t('home.loadMore') }}
            </button>
          </div>
        }
      </div>

      <aside class="home-side">
        @if (news(); as n) {
          <div class="side-block">
            <h3 class="side-title">📰 {{ i18n.t('home.news') }}</h3>
            <a class="news-mini" [routerLink]="['/p', n.id]">
              <span class="muted small">{{ i18n.date(n.date, 'long') }}</span>
              <strong>{{ i18n.pick(n.title) }}</strong>
              <span class="news-mini-sum">{{ i18n.pick(n.summary) }}</span>
            </a>
            <a class="small" [routerLink]="['/c', newsId]">{{ i18n.t('home.allNews') }} →</a>
          </div>
        }
        @if (radar(); as r) {
          <div class="side-block">
            <h3 class="side-title">📡 {{ i18n.t('home.radar') }}</h3>
            <a class="radar-mini" [routerLink]="['/p', r.id]">
              <img [src]="r.cover" alt="" />
              <strong>{{ i18n.pick(r.title) }}</strong>
            </a>
          </div>
        }

        <div class="side-block">
          <h3 class="side-title">{{ i18n.t('home.categories') }}</h3>
          <ul class="side-cats">
            @for (c of cats(); track c.id) {
              <li>
                <a [routerLink]="['/c', c.id]">
                  <span
                    class="side-cat-icon"
                    [style.--c1]="c.colors[0]"
                    [style.--c2]="c.colors[1]"
                    >{{ c.icon }}</span
                  >
                  <span>{{ i18n.pick(c.title) }}</span>
                  <span class="muted small">{{ c.count }}</span>
                </a>
              </li>
            }
          </ul>
        </div>

        @if (seriesList().length) {
          <div class="side-block">
            <h3 class="side-title">📚 {{ i18n.t('home.series') }}</h3>
            <ul class="side-series">
              @for (s of seriesList(); track s.id) {
                <li>
                  <a [routerLink]="['/series', s.id]">{{ i18n.pick(s.title) }}</a>
                  <span class="muted small">{{ s.count }} {{ i18n.t('series.parts') }}</span>
                </li>
              }
            </ul>
          </div>
        }

        <div class="side-block">
          <h3 class="side-title"># {{ i18n.t('home.tags') }}</h3>
          <div class="tag-cloud">
            @for (t of tags(); track t.tag) {
              <a class="tag-pill" [routerLink]="['/tag', t.tag]"
                >#{{ t.tag }} <span>{{ t.count }}</span></a
              >
            }
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class HomePage {
  protected readonly i18n = inject(I18n);
  protected readonly content = inject(ContentService);
  protected readonly PAGE = PAGE;
  protected readonly shown = signal(PAGE);

  /** Bot posts (news, radar) live in their own boxes; the feed shows articles and notes. */
  private readonly feed = computed(() =>
    this.content.posts().filter((p) => !BOT_CATEGORIES.includes(p.category)),
  );
  protected readonly newsId = NEWS_CATEGORY;
  protected readonly news = computed(() =>
    this.content.posts().find((p) => p.category === NEWS_CATEGORY),
  );
  protected readonly featured = computed(() => this.feed().find((p) => p.type === 'article'));
  private readonly rest = computed(() => this.feed().filter((p) => p !== this.featured()));
  protected readonly latest = computed(() => this.rest().slice(0, this.shown()));
  protected readonly hasMore = computed(() => this.rest().length > this.shown());
  protected readonly radar = computed(() =>
    this.content.posts().find((p) => p.category === RADAR_CATEGORY),
  );

  protected readonly cats = computed(() =>
    this.content.categories().map((c) => ({
      ...c,
      count: this.content.posts().filter((p) => p.category === c.id).length,
    })),
  );
  protected readonly seriesList = computed(() =>
    this.content
      .series()
      .map((s) => ({ ...s, count: this.content.posts().filter((p) => p.series === s.id).length }))
      .filter((s) => s.count > 0),
  );
  protected readonly tags = computed(() => {
    const m = new Map<string, number>();
    for (const p of this.feed()) for (const t of p.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([tag, count]) => ({ tag, count }));
  });
}
