import { Component, inject, signal } from '@angular/core';
import {
  IsActiveMatchOptions,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { I18n, I18nKey } from './core/i18n';
import { StoreService } from './core/store.service';

interface NavItem {
  path: string;
  icon: string;
  label: I18nKey;
  query?: Record<string, string>;
  match: IsActiveMatchOptions;
}

const base: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

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
          @for (item of nav; track item.label) {
            <a
              [routerLink]="item.path"
              [queryParams]="item.query ?? null"
              routerLinkActive="active"
              [routerLinkActiveOptions]="item.match"
            >
              <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
              <span>{{ i18n.t(item.label) }}</span>
            </a>
          }
        </nav>

        <div class="nav-actions">
          <span class="streak-pill" [title]="i18n.t('dash.streak')">🔥 {{ store.streak() }}</span>
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
  `,
})
export class App {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/', icon: '🏠', label: 'nav.dashboard', match: { ...base, paths: 'exact' } },
    { path: '/roadmap', icon: '🗺️', label: 'nav.roadmap', match: base },
    // Lessons is active for /lessons and /lessons/:id, but not for the Tech Radar filter.
    {
      path: '/lessons',
      icon: '📘',
      label: 'nav.lessons',
      match: { ...base, queryParams: 'exact' },
    },
    {
      path: '/lessons',
      icon: '📡',
      label: 'nav.radar',
      query: { skill: 'tech-radar' },
      match: { ...base, queryParams: 'exact' },
    },
    { path: '/sql', icon: '🧪', label: 'nav.sql', match: base },
    { path: '/cards', icon: '🃏', label: 'nav.cards', match: base },
    { path: '/settings', icon: '⚙️', label: 'nav.settings', match: base },
  ];

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.menuOpen.set(false);
    });
  }
}
