import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { NEWS_CATEGORY, RADAR_CATEGORY } from '../core/models';
import { PostCard } from '../shared/post-card';
import { RadarStatusCard } from '../shared/radar-status';
import { DecodeText } from '../shared/decode-text';

@Component({
  selector: 'app-category',
  imports: [RouterLink, PostCard, RadarStatusCard, DecodeText],
  template: `
    @if (category(); as c) {
      <header class="cat-hero" [style.--c1]="c.colors[0]" [style.--c2]="c.colors[1]">
        <span class="cat-hero-icon">{{ c.icon }}</span>
        <div>
          <h1 [appDecode]="i18n.pick(c.title)"></h1>
          <p>{{ i18n.pick(c.desc) }}</p>
          <span class="cat-hero-count">{{ posts().length }} {{ i18n.t('common.posts') }}</span>
        </div>
      </header>

      @if (c.id === radarId) {
        <p class="notice">🤖 {{ i18n.t('radar.about') }}</p>
        <app-radar-status />
      }
      @if (c.id === newsId) {
        <p class="notice">🤖 {{ i18n.t('news.about') }}</p>
      }

      <nav class="cat-switch">
        @for (o of content.categories(); track o.id) {
          <a [routerLink]="['/c', o.id]" [class.on]="o.id === c.id"
            >{{ o.icon }} {{ i18n.pick(o.title) }}</a
          >
        }
      </nav>

      <div class="post-grid">
        @for (p of posts(); track p.id) {
          <app-post-card [post]="p" />
        }
      </div>
    } @else if (content.loaded()) {
      <p class="muted">
        {{ i18n.t('common.notFound') }} <a routerLink="/">{{ i18n.t('common.backHome') }}</a>
      </p>
    }
  `,
})
export class CategoryPage {
  readonly id = input.required<string>();
  protected readonly i18n = inject(I18n);
  protected readonly content = inject(ContentService);
  protected readonly radarId = RADAR_CATEGORY;
  protected readonly newsId = NEWS_CATEGORY;
  protected readonly category = computed(() => this.content.categoryById().get(this.id()));
  protected readonly posts = computed(() =>
    this.content.posts().filter((p) => p.category === this.id()),
  );
}
