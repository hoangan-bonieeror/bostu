import { Injectable, computed, effect, signal } from '@angular/core';
import { addDays, today } from './dates';
import { AppState, CardState, Lang, Settings, Theme } from './models';
import { Grade, schedule } from './srs';

const STORAGE_KEY = 'bostu.state.v1';

function detectLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('vi')
    ? 'vi'
    : 'en';
}

function detectTheme(): Theme {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function initialState(): AppState {
  return {
    version: 1,
    settings: { lang: detectLang(), theme: detectTheme(), dailyNewCards: 10, dailyGoalMinutes: 30 },
    lessonsDone: {},
    skillRatings: {},
    sqlSolved: {},
    sqlDrafts: {},
    cards: {},
    activity: {},
    newCardsIntroduced: {},
  };
}

/** Merge a possibly partial/older state onto defaults so new fields never break old saves. */
function normalize(raw: unknown): AppState {
  const base = initialState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<AppState>;
  return {
    ...base,
    ...s,
    version: 1,
    settings: { ...base.settings, ...(s.settings ?? {}) },
  };
}

/**
 * Single source of truth for all learning progress.
 * Persisted to localStorage on every change; exportable as JSON.
 */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly _state = signal<AppState>(this.load());
  readonly state = this._state.asReadonly();

  readonly settings = computed(() => this._state().settings);
  readonly lang = computed(() => this._state().settings.lang);

  readonly streak = computed(() => {
    const act = this._state().activity;
    let day = today();
    if (!act[day]) day = addDays(day, -1); // today not studied yet: streak still alive from yesterday
    let count = 0;
    while (act[day]) {
      count++;
      day = addDays(day, -1);
    }
    return count;
  });

  readonly todayActivity = computed(
    () => this._state().activity[today()] ?? { minutes: 0, actions: 0 },
  );

  constructor() {
    effect(() => {
      const s = this._state();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        /* storage full or disabled: progress stays in memory */
      }
    });
    effect(() => {
      const { theme, lang } = this._state().settings;
      document.documentElement.dataset['theme'] = theme;
      document.documentElement.lang = lang;
    });
  }

  private load(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : initialState();
    } catch {
      return initialState();
    }
  }

  private update(fn: (s: AppState) => AppState) {
    this._state.update(fn);
  }

  // ---------- settings ----------
  updateSettings(patch: Partial<Settings>) {
    this.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }

  toggleLang() {
    this.updateSettings({ lang: this.lang() === 'vi' ? 'en' : 'vi' });
  }

  toggleTheme() {
    this.updateSettings({ theme: this.settings().theme === 'dark' ? 'light' : 'dark' });
  }

  // ---------- activity ----------
  logActivity(minutes: number, actions = 1) {
    const key = today();
    this.update((s) => {
      const prev = s.activity[key] ?? { minutes: 0, actions: 0 };
      return {
        ...s,
        activity: {
          ...s.activity,
          [key]: {
            minutes: Math.round((prev.minutes + minutes) * 10) / 10,
            actions: prev.actions + actions,
          },
        },
      };
    });
  }

  // ---------- lessons ----------
  isLessonDone(id: string) {
    return !!this._state().lessonsDone[id];
  }

  setLessonDone(id: string, done: boolean, minutes = 0) {
    this.update((s) => {
      const lessonsDone = { ...s.lessonsDone };
      if (done) lessonsDone[id] = today();
      else delete lessonsDone[id];
      return { ...s, lessonsDone };
    });
    if (done) this.logActivity(minutes);
  }

  // ---------- skills ----------
  rateSkill(id: string, rating: number) {
    this.update((s) => ({ ...s, skillRatings: { ...s.skillRatings, [id]: rating } }));
  }

  // ---------- SQL lab ----------
  markSqlSolved(id: string) {
    const first = !this._state().sqlSolved[id];
    this.update((s) => ({ ...s, sqlSolved: { ...s.sqlSolved, [id]: s.sqlSolved[id] ?? today() } }));
    this.logActivity(first ? 5 : 1);
  }

  saveSqlDraft(id: string, sql: string) {
    this.update((s) => ({ ...s, sqlDrafts: { ...s.sqlDrafts, [id]: sql } }));
  }

  // ---------- flashcards ----------
  cardState(id: string): CardState | undefined {
    return this._state().cards[id];
  }

  newCardsLeftToday(): number {
    const used = this._state().newCardsIntroduced[today()] ?? 0;
    return Math.max(0, this.settings().dailyNewCards - used);
  }

  reviewCard(id: string, grade: Grade) {
    const key = today();
    this.update((s) => {
      const isNew = !s.cards[id];
      return {
        ...s,
        cards: { ...s.cards, [id]: schedule(s.cards[id], grade, key) },
        newCardsIntroduced: isNew
          ? { ...s.newCardsIntroduced, [key]: (s.newCardsIntroduced[key] ?? 0) + 1 }
          : s.newCardsIntroduced,
      };
    });
    this.logActivity(0.5);
  }

  // ---------- backup ----------
  exportJson(): string {
    return JSON.stringify(this._state(), null, 2);
  }

  importJson(text: string) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.version !== 1) throw new Error('Invalid backup file');
    this._state.set(normalize(parsed));
  }

  reset() {
    const { lang, theme } = this.settings();
    const fresh = initialState();
    this._state.set({ ...fresh, settings: { ...fresh.settings, lang, theme } });
  }
}
