import { Component, inject, signal } from '@angular/core';
import { today } from '../core/dates';
import { I18n } from '../core/i18n';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-settings',
  template: `
    <section class="page-head">
      <h1>{{ i18n.t('set.title') }}</h1>
    </section>

    <div class="card form">
      <label>
        <span>{{ i18n.t('set.language') }}</span>
        <select
          [value]="store.settings().lang"
          (change)="store.updateSettings({ lang: $any($event.target).value })"
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        <span>{{ i18n.t('set.theme') }}</span>
        <select
          [value]="store.settings().theme"
          (change)="store.updateSettings({ theme: $any($event.target).value })"
        >
          <option value="light">{{ i18n.t('set.light') }}</option>
          <option value="dark">{{ i18n.t('set.dark') }}</option>
        </select>
      </label>
    </div>

    <div class="card form">
      <h2>{{ i18n.t('set.study') }}</h2>
      <label>
        <span>{{ i18n.t('set.dailyNew') }}</span>
        <input
          type="number"
          min="0"
          max="100"
          [value]="store.settings().dailyNewCards"
          (change)="setNum('dailyNewCards', $any($event.target).value)"
        />
      </label>
      <label>
        <span>{{ i18n.t('set.dailyGoal') }}</span>
        <input
          type="number"
          min="5"
          max="600"
          step="5"
          [value]="store.settings().dailyGoalMinutes"
          (change)="setNum('dailyGoalMinutes', $any($event.target).value)"
        />
      </label>
    </div>

    <div class="card">
      <h2>{{ i18n.t('set.data') }}</h2>
      <p class="muted small">{{ i18n.t('set.dataNote') }}</p>
      <div class="btn-row">
        <button class="btn" (click)="exportData()">⬇ {{ i18n.t('set.export') }}</button>
        <label class="btn ghost file-btn">
          ⬆ {{ i18n.t('set.import') }}
          <input type="file" accept="application/json,.json" (change)="importData($event)" hidden />
        </label>
        <button class="btn danger" (click)="reset()">🗑 {{ i18n.t('set.reset') }}</button>
      </div>
      @if (message()) {
        <p class="notice">{{ message() }}</p>
      }
    </div>
  `,
})
export class SettingsPage {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  protected readonly message = signal('');

  protected setNum(key: 'dailyNewCards' | 'dailyGoalMinutes', raw: string) {
    const n = Math.max(0, Math.round(Number(raw)));
    if (Number.isFinite(n)) this.store.updateSettings({ [key]: n });
  }

  protected exportData() {
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bostu-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected async importData(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.store.importJson(await file.text());
      this.message.set(this.i18n.t('set.imported'));
    } catch {
      this.message.set(this.i18n.t('set.importFailed'));
    } finally {
      input.value = '';
    }
  }

  protected reset() {
    if (confirm(this.i18n.t('set.resetConfirm'))) this.store.reset();
  }
}
