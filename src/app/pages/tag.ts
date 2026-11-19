import { Component, computed, inject, input } from '@angular/core';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { PostCard } from '../shared/post-card';

@Component({
  selector: 'app-tag',
  imports: [PostCard],
  template: `
    <header class="page-head">
      <span class="muted small">{{ i18n.t('tag.title') }}</span>
      <h1>#{{ tag() }}</h1>
      <p class="muted">{{ posts().length }} {{ i18n.t('common.posts') }}</p>
    </header>
    <div class="post-list">
      @for (p of posts(); track p.id) {
        <app-post-card [post]="p" variant="row" />
      }
    </div>
  `,
})
export class TagPage {
  readonly tag = input.required<string>();
  protected readonly i18n = inject(I18n);
  private readonly content = inject(ContentService);
  protected readonly posts = computed(() =>
    this.content.posts().filter((p) => p.tags.includes(this.tag())),
  );
}
