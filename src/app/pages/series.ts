import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { PostMeta } from '../core/models';
import { StoreService } from '../core/store.service';

/** /series (all series) and /series/:id (one series, parts in order). */
@Component({
  selector: 'app-series',
  imports: [RouterLink],
  template: `
    @if (id(); as sid) {
      @if (current(); as s) {
        <header class="page-head">
          <span class="muted small">📚 {{ i18n.t('nav.series') }}</span>
          <h1>{{ i18n.pick(s.title) }}</h1>
          <p class="muted">{{ i18n.pick(s.desc) }}</p>
        </header>
        <ol class="series-parts">
          @for (p of parts(sid); track p.id; let i = $index) {
            <li>
              <a
                [routerLink]="['/p', p.id]"
                class="series-part"
                [class.is-read]="store.state().read[p.id]"
              >
                <span class="series-num">{{ store.state().read[p.id] ? '✓' : i + 1 }}</span>
                @if (p.cover) {
                  <img [src]="p.cover" alt="" />
                }
                <span class="series-part-body">
                  <strong>{{ i18n.pick(p.title) }}</strong>
                  <span class="muted small">{{ i18n.pick(p.summary) }}</span>
                  <span class="muted small"
                    >{{ i18n.date(p.date) }} · {{ p.minutes[i18n.lang()] }}
                    {{ i18n.t('common.minRead') }}</span
                  >
                </span>
              </a>
            </li>
          }
        </ol>
      } @else if (content.loaded()) {
        <p class="muted">{{ i18n.t('common.notFound') }}</p>
      }
    } @else {
      <header class="page-head">
        <h1>📚 {{ i18n.t('nav.series') }}</h1>
        <p class="muted">{{ i18n.t('series.subtitle') }}</p>
      </header>
      <div class="series-grid">
        @for (s of all(); track s.id) {
          <a class="card series-card" [routerLink]="['/series', s.id]">
            @if (s.first?.cover) {
              <img [src]="s.first!.cover" alt="" />
            }
            <span class="series-card-body">
              <strong>{{ i18n.pick(s.title) }}</strong>
              <span class="muted small">{{ i18n.pick(s.desc) }}</span>
              <span class="small"
                >{{ s.count }} {{ i18n.t('series.parts') }} · {{ i18n.t('series.start') }} →</span
              >
            </span>
          </a>
        }
      </div>
    }
  `,
})
export class SeriesPage {
  readonly id = input<string>();
  protected readonly i18n = inject(I18n);
  protected readonly content = inject(ContentService);
  protected readonly store = inject(StoreService);

  protected readonly current = computed(() =>
    this.id() ? this.content.seriesById().get(this.id()!) : undefined,
  );
  protected readonly all = computed(() =>
    this.content
      .series()
      .map((s) => {
        const ps = this.parts(s.id);
        return { ...s, count: ps.length, first: ps[0] as PostMeta | undefined };
      })
      .filter((s) => s.count > 0),
  );

  protected parts(seriesId: string) {
    return this.content
      .posts()
      .filter((p) => p.series === seriesId)
      .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
  }
}
