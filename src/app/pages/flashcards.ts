import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ContentService } from '../core/content.service';
import { today } from '../core/dates';
import { I18n, I18nKey } from '../core/i18n';
import { Flashcard, Skill } from '../core/models';
import { Grade, previewInterval } from '../core/srs';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-flashcards',
  template: `
    <section class="page-head">
      <h1>{{ i18n.t('cards.title') }}</h1>
      <p class="muted">{{ i18n.t('cards.subtitle') }}</p>
    </section>

    @if (!session()) {
      <div class="filter-row">
        <button class="chip-btn" [class.on]="deck() === ''" (click)="deck.set('')">
          {{ i18n.t('common.all') }} ({{ cards().length }})
        </button>
        @for (s of usedSkills(); track s.id) {
          <button class="chip-btn" [class.on]="deck() === s.id" (click)="deck.set(s.id)">
            {{ s.icon }} {{ i18n.pick(s.title) }}
          </button>
        }
      </div>

      <div class="stats">
        <div class="stat">
          <strong>{{ counts().due }}</strong><span>{{ i18n.t('cards.due') }}</span>
        </div>
        <div class="stat">
          <strong>{{ counts().fresh }}</strong><span>{{ i18n.t('cards.new') }}</span>
        </div>
        <div class="stat">
          <strong>{{ counts().learned }}</strong><span>{{ i18n.t('cards.learned') }}</span>
        </div>
      </div>

      @if (finished()) {
        <p class="notice">{{ i18n.t('cards.finished') }}</p>
      }
      @if (buildQueue().length) {
        <button class="btn big" (click)="start()">
          ▶ {{ i18n.t('cards.start') }} ({{ buildQueue().length }})
        </button>
      } @else {
        <p class="muted">{{ i18n.t('cards.nothing') }}</p>
      }
    } @else {
      @if (current(); as c) {
        <div class="session-bar">
          <span class="small muted">{{ queue().length }} {{ i18n.t('cards.left') }}</span>
          <button class="btn ghost small-btn" (click)="end()">{{ i18n.t('cards.end') }}</button>
        </div>
        <div class="flashcard" [class.flipped]="flipped()" (click)="flipped.set(true)">
          <span class="tag">{{ skillIcon(c.skill) }} {{ skillName(c.skill) }}</span>
          <div class="fc-front">{{ i18n.pick(c.front) }}</div>
          @if (flipped()) {
            <hr />
            <div class="fc-back">{{ i18n.pick(c.back) }}</div>
          }
        </div>
        @if (!flipped()) {
          <button class="btn big" (click)="flipped.set(true)">{{ i18n.t('cards.show') }}</button>
        } @else {
          <div class="grades">
            @for (g of grades; track g.grade; let i = $index) {
              <button class="btn grade grade-{{ g.grade }}" (click)="grade(g.grade)">
                <span>{{ i + 1 }} · {{ i18n.t(g.label) }}</span>
                <small>{{ intervalLabel(c, g.grade) }}</small>
              </button>
            }
          </div>
        }
        <p class="small muted center">{{ i18n.t('cards.shortcuts') }}</p>
      }
    }
  `,
})
export class FlashcardsPage {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);

  protected readonly cards = signal<Flashcard[]>([]);
  private readonly skills = signal<Skill[]>([]);
  protected readonly deck = signal('');
  protected readonly session = signal(false);
  protected readonly finished = signal(false);
  protected readonly queue = signal<Flashcard[]>([]);
  protected readonly flipped = signal(false);
  protected readonly current = computed(() => this.queue()[0]);

  protected readonly grades: { grade: Grade; label: I18nKey }[] = [
    { grade: 0, label: 'cards.again' },
    { grade: 3, label: 'cards.hard' },
    { grade: 4, label: 'cards.good' },
    { grade: 5, label: 'cards.easy' },
  ];

  protected readonly usedSkills = computed(() =>
    this.skills().filter((s) => this.cards().some((c) => c.skill === s.id)),
  );
  private readonly deckCards = computed(() =>
    this.deck() ? this.cards().filter((c) => c.skill === this.deck()) : this.cards(),
  );
  protected readonly counts = computed(() => {
    const st = this.store.state().cards;
    const t = today();
    const list = this.deckCards();
    return {
      due: list.filter((c) => st[c.id] && st[c.id].due <= t).length,
      fresh: list.filter((c) => !st[c.id]).length,
      learned: list.filter((c) => st[c.id]).length,
    };
  });

  /** Due cards first (most overdue first), then new cards up to today's limit. */
  protected readonly buildQueue = computed(() => {
    const st = this.store.state().cards;
    const t = today();
    const list = this.deckCards();
    const due = list
      .filter((c) => st[c.id] && st[c.id].due <= t)
      .sort((a, b) => st[a.id].due.localeCompare(st[b.id].due));
    const fresh = list.filter((c) => !st[c.id]).slice(0, this.store.newCardsLeftToday());
    return [...due, ...fresh];
  });

  constructor() {
    this.content
      .flashcards()
      .then((v) => this.cards.set(v))
      .catch(() => {});
    this.content
      .skills()
      .then((v) => this.skills.set(v))
      .catch(() => {});
  }

  protected start() {
    this.queue.set(this.buildQueue());
    this.flipped.set(false);
    this.finished.set(false);
    this.session.set(true);
  }

  protected end() {
    this.session.set(false);
    this.queue.set([]);
  }

  protected grade(g: Grade) {
    const c = this.current();
    if (!c) return;
    this.store.reviewCard(c.id, g);
    const rest = this.queue().slice(1);
    // "Again" puts the card back at the end of this session.
    this.queue.set(g === 0 ? [...rest, c] : rest);
    this.flipped.set(false);
    if (!this.queue().length) {
      this.session.set(false);
      this.finished.set(true);
    }
  }

  protected intervalLabel(c: Flashcard, g: Grade): string {
    const days = previewInterval(this.store.cardState(c.id), g, today());
    if (days === 0) return this.i18n.lang() === 'vi' ? 'ôn lại ngay' : 'now';
    return `${days} ${this.i18n.t('common.days')}`;
  }

  protected skillName(id: string) {
    return this.i18n.pick(this.skills().find((s) => s.id === id)?.title);
  }

  protected skillIcon(id: string) {
    return this.skills().find((s) => s.id === id)?.icon ?? '';
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(e: KeyboardEvent) {
    if (!this.session() || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.flipped.set(true);
    } else if (this.flipped() && ['1', '2', '3', '4'].includes(e.key)) {
      this.grade(this.grades[Number(e.key) - 1].grade);
    }
  }
}
