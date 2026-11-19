import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { StoreService } from '../core/store.service';
import { PostCard } from '../shared/post-card';

@Component({
  selector: 'app-saved',
  imports: [RouterLink, PostCard],
  template: `
    <header class="page-head">
      <h1>🔖 {{ i18n.t('saved.title') }}</h1>
      <p class="muted">{{ i18n.t('saved.subtitle') }}</p>
    </header>

    <section>
      <h2 class="section-title">{{ i18n.t('saved.bookmarks') }}</h2>
      <div class="post-list">
        @for (p of bookmarks(); track p.id) {
          <app-post-card [post]="p" variant="row" />
        } @empty {
          <p class="muted">{{ i18n.t('saved.emptyBookmarks') }}</p>
        }
      </div>
    </section>

    <section>
      <h2 class="section-title">✍️ {{ i18n.t('saved.notes') }}</h2>
      <div class="notes-list">
        @for (n of notes(); track n.post.id) {
          <a class="card note-item" [routerLink]="['/p', n.post.id]">
            <strong>{{ i18n.pick(n.post.title) }}</strong>
            <span class="note-text">{{ n.text }}</span>
            <span class="muted small">{{ i18n.date(n.updated) }}</span>
          </a>
        } @empty {
          <p class="muted">{{ i18n.t('saved.emptyNotes') }}</p>
        }
      </div>
    </section>

    @if (history().length) {
      <section>
        <h2 class="section-title">{{ i18n.t('saved.history') }}</h2>
        <div class="post-list">
          @for (p of history(); track p.id) {
            <app-post-card [post]="p" variant="compact" />
          }
        </div>
      </section>
    }

    <section class="card">
      <h2>{{ i18n.t('saved.data') }}</h2>
      <p class="muted small">{{ i18n.t('saved.dataNote') }}</p>
      <div class="btn-row">
        <button class="btn" (click)="exportData()">⬇ {{ i18n.t('saved.export') }}</button>
        <label class="btn ghost file-btn">
          ⬆ {{ i18n.t('saved.import') }}
          <input type="file" accept="application/json,.json" (change)="importData($event)" hidden />
        </label>
        <button class="btn danger" (click)="reset()">🗑 {{ i18n.t('saved.reset') }}</button>
      </div>
      @if (message()) {
        <p class="notice">{{ message() }}</p>
      }
    </section>
  `,
})
export class SavedPage {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);
  protected readonly message = signal('');

  private byDateDesc(rec: Record<string, string>) {
    const map = this.content.postById();
    return Object.entries(rec)
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([id]) => map.get(id))
      .filter((p) => !!p);
  }

  protected readonly bookmarks = computed(() => this.byDateDesc(this.store.state().bookmarks));
  protected readonly history = computed(() => this.byDateDesc(this.store.state().read).slice(0, 8));
  protected readonly notes = computed(() => {
    const map = this.content.postById();
    return Object.entries(this.store.state().notes)
      .sort((a, b) => b[1].updated.localeCompare(a[1].updated))
      .map(([id, n]) => ({ post: map.get(id)!, text: n.text, updated: n.updated }))
      .filter((n) => !!n.post);
  });

  protected exportData() {
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bostu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected async importData(e: Event) {
    const inputEl = e.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;
    try {
      this.store.importJson(await file.text());
      this.message.set(this.i18n.t('saved.imported'));
    } catch {
      this.message.set(this.i18n.t('saved.importFailed'));
    } finally {
      inputEl.value = '';
    }
  }

  protected reset() {
    if (confirm(this.i18n.t('saved.resetConfirm'))) this.store.reset();
  }
}
