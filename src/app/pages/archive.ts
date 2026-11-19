import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';

@Component({
  selector: 'app-archive',
  imports: [RouterLink],
  template: `
    <header class="page-head">
      <h1>🗓️ {{ i18n.t('archive.title') }}</h1>
      <p class="muted">
        {{ i18n.t('archive.subtitle') }} · {{ content.posts().length }} {{ i18n.t('common.posts') }}
      </p>
    </header>
    @for (g of groups(); track g.key) {
      <section class="archive-group">
        <h2>{{ g.label }}</h2>
        <ul class="archive-list">
          @for (p of g.posts; track p.id) {
            <li>
              <span class="archive-date">{{ p.date.slice(8, 10) }}/{{ p.date.slice(5, 7) }}</span>
              <a [routerLink]="['/p', p.id]">{{ i18n.pick(p.title) }}</a>
              @if (cat(p.category); as c) {
                <a
                  class="cat-chip small-chip"
                  [routerLink]="['/c', c.id]"
                  [style.--c1]="c.colors[0]"
                  [style.--c2]="c.colors[1]"
                  >{{ c.icon }} {{ i18n.pick(c.title) }}</a
                >
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class ArchivePage {
  protected readonly i18n = inject(I18n);
  protected readonly content = inject(ContentService);
  protected cat = (id: string) => this.content.categoryById().get(id);

  protected readonly groups = computed(() => {
    const out: { key: string; label: string; posts: ReturnType<ContentService['posts']> }[] = [];
    for (const p of this.content.posts()) {
      const key = p.date.slice(0, 7);
      let g = out.find((x) => x.key === key);
      if (!g) {
        const d = new Date(`${key}-01T00:00:00`);
        const label = d.toLocaleDateString(this.i18n.lang() === 'vi' ? 'vi-VN' : 'en-US', {
          month: 'long',
          year: 'numeric',
        });
        out.push((g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), posts: [] }));
      }
      g.posts.push(p);
    }
    return out;
  });
}
