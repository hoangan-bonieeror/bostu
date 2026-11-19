import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { today } from '../core/dates';
import { I18n } from '../core/i18n';
import { Flashcard, LessonMeta, Skill, SqlExercise, isRadar, lessonCover } from '../core/models';
import { StoreService } from '../core/store.service';
import { Heatmap } from '../shared/heatmap';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Heatmap],
  template: `
    <section class="page-head">
      <h1>{{ i18n.t('dash.hello') }}</h1>
      <p class="muted">{{ i18n.t('dash.subtitle') }}</p>
    </section>

    <div class="stats">
      <div class="stat">
        <span class="stat-icon">🔥</span>
        <strong>{{ store.streak() }}</strong>
        <span>{{ i18n.t('dash.streak') }}</span>
      </div>
      <a class="stat" routerLink="/lessons">
        <span class="stat-icon">📘</span>
        <strong>{{ lessonsDone() }}/{{ course().length }}</strong>
        <span>{{ i18n.t('dash.lessons') }}</span>
      </a>
      <a class="stat" routerLink="/cards">
        <span class="stat-icon">🃏</span>
        <strong>{{ cardsDue() }}</strong>
        <span>{{ i18n.t('dash.cardsDue') }}</span>
      </a>
      <a class="stat" routerLink="/sql">
        <span class="stat-icon">🧪</span>
        <strong>{{ sqlSolved() }}/{{ exercises().length }}</strong>
        <span>{{ i18n.t('dash.sqlSolved') }}</span>
      </a>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>{{ i18n.t('dash.todayGoal') }}</h2>
        <div class="goal">
          <div class="goal-num">
            <strong>{{ todayMinutes() }}</strong> / {{ store.settings().dailyGoalMinutes }}
            {{ i18n.t('common.minutes') }}
          </div>
          <div class="progress"><span [style.width.%]="goalPct()"></span></div>
        </div>
        <p class="muted small">{{ i18n.t('dash.logTime') }}</p>
        <div class="btn-row">
          @for (m of [15, 30, 60]; track m) {
            <button class="btn ghost" (click)="store.logActivity(m)">
              +{{ m }} {{ i18n.t('common.minutes') }}
            </button>
          }
        </div>
      </div>

      <div class="card">
        <h2>{{ i18n.t('dash.continue') }}</h2>
        @if (nextLesson(); as l) {
          <a class="next-lesson" [routerLink]="['/lessons', l.id]">
            <img class="next-cover" [src]="cover(l)" alt="" />
            <span class="tag">{{ skillName(l.skill) }}</span>
            <strong>{{ i18n.pick(l.title) }}</strong>
            <span class="muted small">{{ i18n.pick(l.summary) }}</span>
            <span class="muted small">⏱ {{ l.minutes }} {{ i18n.t('common.minutes') }}</span>
          </a>
        } @else if (course().length) {
          <p class="muted">{{ i18n.t('dash.allDone') }}</p>
        }
        @if (cardsDue() > 0) {
          <a class="btn" routerLink="/cards"
            >🃏 {{ i18n.t('dash.reviewNow') }} ({{ cardsDue() }})</a
          >
        }
      </div>
    </div>

    @if (latestRadar(); as r) {
      <a class="card radar-card" [routerLink]="['/lessons', r.id]">
        <img [src]="cover(r)" alt="" />
        <span class="radar-card-body">
          <span class="post-kicker">📡 {{ i18n.t('radar.latest') }}</span>
          <strong>{{ i18n.pick(r.title) }}</strong>
          <span class="muted small">{{ i18n.pick(r.summary) }}</span>
        </span>
      </a>
    }

    <div class="card">
      <h2>{{ i18n.t('dash.activity') }}</h2>
      <app-heatmap [activity]="store.state().activity" />
    </div>

    <div class="card">
      <h2>{{ i18n.t('dash.skills') }}</h2>
      <div class="skill-bars">
        @for (s of roadmapSkills(); track s.id) {
          <a class="skill-bar" routerLink="/roadmap" [fragment]="s.id">
            <span class="skill-bar-name">{{ s.icon }} {{ i18n.pick(s.title) }}</span>
            <span class="progress"
              ><span [style.width.%]="(store.state().skillRatings[s.id] ?? 0) * 20"></span
            ></span>
            <span class="muted small">{{ store.state().skillRatings[s.id] ?? 0 }}/5</span>
          </a>
        }
      </div>
    </div>
  `,
})
export class DashboardPage {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);

  protected readonly skills = signal<Skill[]>([]);
  protected readonly lessons = signal<LessonMeta[]>([]);
  protected readonly exercises = signal<SqlExercise[]>([]);
  protected readonly cards = signal<Flashcard[]>([]);
  protected readonly cover = lessonCover;

  protected readonly course = computed(() => this.lessons().filter((l) => !isRadar(l)));
  protected readonly latestRadar = computed(() => this.lessons().find(isRadar));
  protected readonly roadmapSkills = computed(() =>
    this.skills().filter((s) => s.level !== 'trends'),
  );
  protected readonly lessonsDone = computed(
    () => this.course().filter((l) => this.store.state().lessonsDone[l.id]).length,
  );
  protected readonly sqlSolved = computed(
    () => this.exercises().filter((e) => this.store.state().sqlSolved[e.id]).length,
  );
  protected readonly nextLesson = computed(() =>
    this.lessons().find((l) => !this.store.state().lessonsDone[l.id]),
  );
  protected readonly cardsDue = computed(() => {
    const t = today();
    const states = this.store.state().cards;
    const due = this.cards().filter((c) => states[c.id] && states[c.id].due <= t).length;
    const fresh = this.cards().filter((c) => !states[c.id]).length;
    return due + Math.min(fresh, this.store.newCardsLeftToday());
  });
  protected readonly todayMinutes = computed(() => Math.round(this.store.todayActivity().minutes));
  protected readonly goalPct = computed(() =>
    Math.min(
      100,
      (this.todayMinutes() / Math.max(1, this.store.settings().dailyGoalMinutes)) * 100,
    ),
  );

  constructor() {
    this.content
      .skills()
      .then((v) => this.skills.set(v))
      .catch(() => {});
    this.content
      .lessons()
      .then((v) => this.lessons.set(v))
      .catch(() => {});
    this.content
      .sqlLab()
      .then((v) => this.exercises.set(v.exercises))
      .catch(() => {});
    this.content
      .flashcards()
      .then((v) => this.cards.set(v))
      .catch(() => {});
  }

  protected skillName(id: string) {
    return this.i18n.pick(this.skills().find((s) => s.id === id)?.title);
  }
}
