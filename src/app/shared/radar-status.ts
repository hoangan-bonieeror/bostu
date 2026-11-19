import { Component, inject, signal } from '@angular/core';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { RadarStatus } from '../core/models';

/** "Last scan" card for the Tech Radar bot (reads content/radar-status.json). */
@Component({
  selector: 'app-radar-status',
  template: `
    @if (status(); as st) {
      <div class="card radar-status">
        <div class="radar-status-head">
          <span class="radar-dot"></span>
          <strong>{{ i18n.t('radar.lastRun') }}</strong>
          <span class="muted">{{ dateTime(st.lastRun) }} · {{ ago(st.lastRun) }}</span>
        </div>
        <div class="radar-sources">
          @for (s of st.sources; track s.id) {
            <span class="src-chip" [class.bad]="!s.ok" [title]="s.error ?? ''">
              {{ s.ok ? '✅' : '❌' }} {{ s.name }} <strong>{{ s.fetched }}</strong>
            </span>
          }
        </div>
        <p class="small muted">
          {{ i18n.t('radar.relevant') }}: <strong>{{ st.relevant }}</strong> ·
          @if (st.postId) {
            {{ i18n.t('radar.published') }}: <strong>{{ st.published }}</strong>
          } @else {
            {{ i18n.t('radar.noPost') }}
          }
          @if (st.crawl; as c) {
            · {{ i18n.t('radar.crawled') }}: <strong>{{ c.ok }}/{{ c.attempted }}</strong>
          }
          · Gemini: {{ aiLabel(st) }}
        </p>
      </div>
    } @else if (loaded()) {
      <p class="notice">⏳ {{ i18n.t('radar.neverRun') }}</p>
    }
  `,
})
export class RadarStatusCard {
  protected readonly i18n = inject(I18n);
  protected readonly status = signal<RadarStatus | null>(null);
  protected readonly loaded = signal(false);

  constructor() {
    inject(ContentService)
      .radarStatus()
      .then((s) => {
        this.status.set(s);
        this.loaded.set(true);
      });
  }

  protected aiLabel(st: RadarStatus): string {
    const ai = st.ai;
    if (typeof ai === 'boolean') return ai ? 'ON' : 'OFF';
    if (!ai.enabled) return this.i18n.t('radar.aiOff');
    if (ai.ok) return `✅ ${ai.summarized} (${ai.model})`;
    return `❌ ${(ai.error ?? '?').split('\n')[0].slice(0, 120)}`;
  }

  protected dateTime(iso: string) {
    return new Date(iso).toLocaleString(this.i18n.lang() === 'vi' ? 'vi-VN' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  protected ago(iso: string) {
    const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
    return days <= 0 ? this.i18n.t('radar.today') : `${days} ${this.i18n.t('radar.daysAgo')}`;
  }
}
