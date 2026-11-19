import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ContentService } from './core/content.service';
import { I18n } from './core/i18n';
import { RADAR_CATEGORY } from './core/models';
import { StoreService } from './core/store.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="navbar" [class.open]="menuOpen()">
      <div class="navbar-inner">
        <a class="brand" routerLink="/">
          <span class="brand-logo">⌘</span>
          <span class="brand-text">
            <strong>{{ i18n.t('app.name') }}</strong>
            <small>{{ i18n.t('app.tagline') }}</small>
          </span>
        </a>

        <nav class="nav-links" [attr.aria-label]="i18n.t('nav.menu')">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">{{
            i18n.t('nav.home')
          }}</a>

          <div class="nav-drop" [class.open]="catsOpen()">
            <button
              type="button"
              class="nav-drop-btn"
              (click)="toggleCats($event)"
              [attr.aria-expanded]="catsOpen()"
            >
              {{ i18n.t('nav.categories') }} ▾
            </button>
            <div class="nav-drop-menu">
              @for (c of topics(); track c.id) {
                <a [routerLink]="['/c', c.id]" routerLinkActive="active">
                  <span
                    class="side-cat-icon"
                    [style.--c1]="c.colors[0]"
                    [style.--c2]="c.colors[1]"
                    >{{ c.icon }}</span
                  >
                  {{ i18n.pick(c.title) }}
                </a>
              }
            </div>
          </div>

          <a routerLink="/series" routerLinkActive="active">{{ i18n.t('nav.series') }}</a>
          <a [routerLink]="['/c', radarId]" routerLinkActive="active"
            >📡 {{ i18n.t('nav.radar') }}</a
          >
          <a routerLink="/archive" routerLinkActive="active">{{ i18n.t('nav.archive') }}</a>
        </nav>

        <div class="nav-actions">
          <a
            class="icon-btn"
            routerLink="/search"
            [title]="i18n.t('nav.search')"
            [attr.aria-label]="i18n.t('nav.search')"
            >🔍</a
          >
          <a
            class="icon-btn saved-btn"
            routerLink="/saved"
            [title]="i18n.t('nav.saved')"
            [attr.aria-label]="i18n.t('nav.saved')"
          >
            🔖
            @if (store.bookmarkCount()) {
              <span class="count-dot">{{ store.bookmarkCount() }}</span>
            }
          </a>
          <div class="lang-switch" role="group" aria-label="Language">
            <button
              [class.on]="i18n.lang() === 'vi'"
              (click)="store.updateSettings({ lang: 'vi' })"
            >
              VI
            </button>
            <button
              [class.on]="i18n.lang() === 'en'"
              (click)="store.updateSettings({ lang: 'en' })"
            >
              EN
            </button>
          </div>
          <button
            class="icon-btn"
            (click)="store.toggleTheme()"
            [attr.aria-label]="i18n.t('nav.toggleTheme')"
            [title]="i18n.t('nav.toggleTheme')"
          >
            {{ store.settings().theme === 'dark' ? '☀️' : '🌙' }}
          </button>
          <button
            class="icon-btn menu-btn"
            (click)="menuOpen.set(!menuOpen())"
            [attr.aria-expanded]="menuOpen()"
            [attr.aria-label]="i18n.t('nav.menu')"
          >
            {{ menuOpen() ? '✕' : '☰' }}
          </button>
        </div>
      </div>
    </header>

    <main class="content">
      <router-outlet />
    </main>

    <footer class="site-footer">
      <div><strong>⌘ Bostu</strong> — {{ i18n.t('footer.about') }}</div>
      <div class="footer-links">
        <a [href]="'feed.' + i18n.lang() + '.xml'">📰 {{ i18n.t('footer.rss') }}</a>
        <a href="https://github.com/hoangan-bonieeror/bostu" target="_blank" rel="noopener"
          >GitHub</a
        >
      </div>
    </footer>
  `,
})
export class App {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);
  protected readonly menuOpen = signal(false);
  protected readonly catsOpen = signal(false);
  protected readonly radarId = RADAR_CATEGORY;
  protected readonly topics = () =>
    this.content.categories().filter((c) => c.id !== RADAR_CATEGORY);

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.menuOpen.set(false);
        this.catsOpen.set(false);
      }
    });
  }

  protected toggleCats(e: Event) {
    e.stopPropagation();
    this.catsOpen.set(!this.catsOpen());
  }

  @HostListener('document:click')
  protected closeMenus() {
    this.catsOpen.set(false);
  }
}
