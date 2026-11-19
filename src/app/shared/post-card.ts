import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { PostMeta } from '../core/models';
import { StoreService } from '../core/store.service';

/** Post teaser used on the home page, category pages, search and archive. */
@Component({
  selector: 'app-post-card',
  imports: [RouterLink],
  template: `
    @let p = post();
    <a class="pc pc-{{ variant() }}" [routerLink]="['/p', p.id]" [class.is-read]="read()">
      @if (variant() !== 'row' && variant() !== 'compact' && p.cover) {
        <span class="pc-cover-wrap">
          <img
            class="pc-cover"
            [src]="p.cover"
            [alt]="i18n.pick(p.title)"
            [attr.loading]="variant() === 'featured' ? null : 'lazy'"
          />
          @if (bookmarked()) {
            <span class="pc-flag" [title]="i18n.t('post.bookmarked')">🔖</span>
          }
        </span>
      }
      <span class="pc-body">
        <span class="pc-kicker">
          @if (category(); as c) {
            <span class="cat-chip" [style.--c1]="c.colors[0]" [style.--c2]="c.colors[1]"
              >{{ c.icon }} {{ i18n.pick(c.title) }}</span
            >
          }
          @if (p.type === 'note') {
            <span class="type-badge">{{ i18n.t('type.note') }}</span>
          }
          @if (seriesLabel(); as s) {
            <span class="series-badge" [title]="s"
              >📚 {{ variant() === 'card' ? partLabel() : s }}</span
            >
          }
        </span>
        <span class="pc-title">{{ i18n.pick(p.title) }}</span>
        @if (variant() !== 'compact') {
          <span class="pc-summary">{{ i18n.pick(p.summary) }}</span>
        }
        <span class="pc-meta">
          <span>{{ i18n.date(p.date) }}</span>
          <span>· {{ p.minutes[i18n.lang()] }} {{ i18n.t('common.minRead') }}</span>
          @if (read()) {
            <span class="pc-read">· ✓ {{ i18n.t('post.read') }}</span>
          }
        </span>
      </span>
    </a>
  `,
})
export class PostCard {
  readonly post = input.required<PostMeta>();
  /** featured = big hero, card = grid card, row = text row, compact = sidebar */
  readonly variant = input<'featured' | 'card' | 'row' | 'compact'>('card');

  protected readonly i18n = inject(I18n);
  private readonly content = inject(ContentService);
  private readonly store = inject(StoreService);

  protected readonly category = computed(() =>
    this.content.categoryById().get(this.post().category),
  );
  protected readonly read = computed(() => !!this.store.state().read[this.post().id]);
  protected readonly bookmarked = computed(() => !!this.store.state().bookmarks[this.post().id]);
  protected readonly partLabel = computed(
    () => `${this.i18n.t('post.part')} ${this.post().seriesOrder}`,
  );
  protected readonly seriesLabel = computed(() => {
    const p = this.post();
    const s = p.series ? this.content.seriesById().get(p.series) : undefined;
    return s ? `${this.i18n.pick(s.title)} · ${this.i18n.t('post.part')} ${p.seriesOrder}` : '';
  });
}
