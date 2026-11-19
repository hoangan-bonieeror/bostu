import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18n, I18nKey } from '../core/i18n';
import { LessonMeta, Skill, SkillLevel } from '../core/models';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-roadmap',
  imports: [RouterLink],
  template: `
    <section class="page-head">
      <h1>{{ i18n.t('road.title') }}</h1>
      <p class="muted">{{ i18n.t('road.subtitle') }}</p>
    </section>

    @for (group of groups(); track group.level; let gi = $index) {
      <section class="road-group">
        <h2 class="road-level">
          <span class="step">{{ gi + 1 }}</span>{{ i18n.t(group.label) }}
        </h2>
        <div class="skill-grid">
          @for (s of group.skills; track s.id) {
            <article class="card skill-card" [id]="s.id">
              <header>
                <span class="skill-icon">{{ s.icon }}</span>
                <div>
                  <h3>{{ i18n.pick(s.title) }}</h3>
                  <p class="muted small">{{ i18n.pick(s.desc) }}</p>
                </div>
              </header>

              <div class="topics">
                @for (tp of s.topics; track $index) {
                  <span class="chip">{{ i18n.pick(tp) }}</span>
                }
              </div>

              @let ls = lessonsFor(s.id);
              @if (ls.length) {
                <div class="progress-row">
                  <div class="progress"><span [style.width.%]="pct(ls)"></span></div>
                  <span class="small muted">{{ doneCount(ls) }}/{{ ls.length }}</span>
                </div>
                <ul class="lesson-links">
                  @for (l of ls; track l.id) {
                    <li [class.done]="store.state().lessonsDone[l.id]">
                      <a [routerLink]="['/lessons', l.id]"
                        >{{ store.state().lessonsDone[l.id] ? '✓' : '○' }}
                        {{ i18n.pick(l.title) }}</a
                      >
                    </li>
                  }
                </ul>
              } @else {
                <p class="muted small">{{ i18n.t('road.noLessons') }}</p>
              }

              <footer class="rating">
                <span class="small muted">{{ i18n.t('road.rate') }}</span>
                <span class="stars" role="radiogroup" [attr.aria-label]="i18n.t('road.rate')">
                  @for (n of [1, 2, 3, 4, 5]; track n) {
                    <button
                      class="star"
                      role="radio"
                      [attr.aria-checked]="rating(s.id) === n"
                      [class.on]="rating(s.id) >= n"
                      (click)="store.rateSkill(s.id, rating(s.id) === n ? n - 1 : n)"
                      [attr.aria-label]="n + '/5'"
                    >
                      ★
                    </button>
                  }
                </span>
              </footer>
            </article>
          }
        </div>
      </section>
    }
  `,
})
export class RoadmapPage {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);

  private readonly skills = signal<Skill[]>([]);
  private readonly lessons = signal<LessonMeta[]>([]);

  protected readonly groups = computed(() => {
    const levels: { level: SkillLevel; label: I18nKey }[] = [
      { level: 'foundation', label: 'road.foundation' },
      { level: 'core', label: 'road.core' },
      { level: 'advanced', label: 'road.advanced' },
    ];
    return levels.map((g) => ({ ...g, skills: this.skills().filter((s) => s.level === g.level) }));
  });

  constructor() {
    this.content
      .skills()
      .then((v) => this.skills.set(v))
      .catch(() => {});
    this.content
      .lessons()
      .then((v) => this.lessons.set(v))
      .catch(() => {});
  }

  protected lessonsFor(skillId: string) {
    return this.lessons().filter((l) => l.skill === skillId);
  }

  protected doneCount(ls: LessonMeta[]) {
    return ls.filter((l) => this.store.state().lessonsDone[l.id]).length;
  }

  protected pct(ls: LessonMeta[]) {
    return ls.length ? (this.doneCount(ls) / ls.length) * 100 : 0;
  }

  protected rating(id: string) {
    return this.store.state().skillRatings[id] ?? 0;
  }
}
