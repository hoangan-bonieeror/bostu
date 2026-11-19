import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { LessonMeta, RADAR_SKILL, Skill, isRadar, lessonCover } from '../core/models';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-lessons',
  imports: [RouterLink],
  template: `
    <section class="page-head">
      <h1>{{ i18n.t('lessons.title') }}</h1>
      <p class="muted">{{ i18n.t('lessons.subtitle') }}</p>
    </section>

    <div class="filter-row">
      <button class="chip-btn" [class.on]="filter() === ''" (click)="setFilter('')">
        {{ i18n.t('common.all') }}
      </button>
      @for (s of usedSkills(); track s.id) {
        <button class="chip-btn" [class.on]="filter() === s.id" (click)="setFilter(s.id)">
          {{ s.icon }} {{ i18n.pick(s.title) }}
        </button>
      }
    </div>

    @if (error()) {
      <p class="error">{{ i18n.t('common.error') }}</p>
    }

    @if (filter() === '' && latestRadar(); as r) {
      <a class="radar-strip" [routerLink]="['/lessons', r.id]">
        <span class="radar-dot"></span>
        <strong>📡 {{ i18n.t('radar.latest') }}</strong>
        <span class="radar-strip-title">{{ i18n.pick(r.title) }}</span>
        <span class="read-more">→</span>
      </a>
    }

    @if (filter() === radarSkill) {
      <p class="notice">🤖 {{ i18n.t('radar.about') }}</p>
    }

    @if (featured(); as f) {
      <a class="post-featured" [routerLink]="['/lessons', f.id]">
        <img class="post-cover" [src]="cover(f)" [alt]="i18n.pick(f.title)" />
        <div class="post-body">
          <span class="post-kicker">{{
            isRadar(f) ? i18n.t('radar.newest') : i18n.t('lessons.featured')
          }}</span>
          <span class="tag">{{ skillIcon(f.skill) }} {{ skillName(f.skill) }}</span>
          <h2>{{ i18n.pick(f.title) }}</h2>
          <p class="muted">{{ i18n.pick(f.summary) }}</p>
          <div class="post-meta">
            <span>⏱ {{ f.minutes }} {{ i18n.t('common.minutes') }}</span>
            @if (f.date) {
              <span>· {{ formatDate(f.date) }}</span>
            }
            @if (store.state().lessonsDone[f.id]) {
              <span class="done-badge">✓ {{ i18n.t('lessons.done') }}</span>
            }
          </div>
          <span class="read-more">{{ i18n.t('lessons.read') }} →</span>
        </div>
      </a>
    }

    <div class="post-grid">
      @for (l of rest(); track l.id) {
        <a class="post-card" [routerLink]="['/lessons', l.id]">
          <div class="post-cover-wrap">
            <img class="post-cover" [src]="cover(l)" [alt]="i18n.pick(l.title)" loading="lazy" />
            @if (store.state().lessonsDone[l.id]) {
              <span class="done-badge floating">✓ {{ i18n.t('lessons.done') }}</span>
            }
          </div>
          <div class="post-body">
            <span class="tag">{{ skillIcon(l.skill) }} {{ skillName(l.skill) }}</span>
            <h3>{{ i18n.pick(l.title) }}</h3>
            <p class="muted small">{{ i18n.pick(l.summary) }}</p>
            <div class="post-meta">
              <span>⏱ {{ l.minutes }} {{ i18n.t('common.minutes') }}</span>
              @if (l.date) {
                <span>· {{ formatDate(l.date) }}</span>
              }
            </div>
          </div>
        </a>
      }
    </div>
  `,
})
export class LessonsPage {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);

  /** ?skill=<id> query param, e.g. ?skill=tech-radar from the navbar. */
  readonly skill = input<string>();

  private readonly router = inject(Router);
  private readonly skills = signal<Skill[]>([]);
  private readonly lessons = signal<LessonMeta[]>([]);
  protected readonly filter = linkedSignal(() => this.skill() ?? '');
  protected readonly radarSkill = RADAR_SKILL;
  protected readonly isRadar = isRadar;
  protected readonly error = signal(false);
  protected readonly cover = lessonCover;

  protected readonly usedSkills = computed(() =>
    this.skills().filter((s) => this.lessons().some((l) => l.skill === s.id)),
  );
  private readonly visible = computed(() =>
    this.filter() ? this.lessons().filter((l) => l.skill === this.filter()) : this.lessons(),
  );
  protected readonly latestRadar = computed(() => this.lessons().find(isRadar));
  /** Radar view features the newest post; otherwise the first unfinished curriculum lesson. */
  protected readonly featured = computed(() => {
    const v = this.visible();
    if (this.filter() === RADAR_SKILL) return v[0];
    const course = v.filter((l) => !isRadar(l));
    return course.find((l) => !this.store.state().lessonsDone[l.id]) ?? course[0] ?? v[0];
  });
  protected readonly rest = computed(() => this.visible().filter((l) => l !== this.featured()));

  constructor() {
    this.content
      .skills()
      .then((v) => this.skills.set(v))
      .catch(() => {});
    this.content
      .lessons()
      .then((v) => this.lessons.set(v))
      .catch(() => this.error.set(true));
  }

  protected setFilter(id: string) {
    this.filter.set(id);
    this.router.navigate([], { queryParams: { skill: id || null } });
  }

  protected skillName(id: string) {
    return this.i18n.pick(this.skills().find((s) => s.id === id)?.title);
  }

  protected skillIcon(id: string) {
    return this.skills().find((s) => s.id === id)?.icon ?? '';
  }

  protected formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString(
      this.i18n.lang() === 'vi' ? 'vi-VN' : 'en-US',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      },
    );
  }
}
