import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import type { SqlJsStatic } from 'sql.js';
import { ContentService } from '../core/content.service';
import { I18n } from '../core/i18n';
import { SqlLabData } from '../core/models';
import {
  CheckOutcome,
  RunResult,
  compareResults,
  loadSqlEngine,
  runOnFreshDb,
} from '../core/sql-engine';
import { StoreService } from '../core/store.service';

const PLAYGROUND_ID = '__playground__';
const PLAYGROUND_DEFAULT = 'SELECT * FROM customers LIMIT 10;';

interface TableInfo {
  name: string;
  columns: { name: string; type: string; pk: boolean }[];
}

@Component({
  selector: 'app-sql-lab',
  template: `
    <section class="page-head">
      <h1>{{ i18n.t('sql.title') }}</h1>
      <p class="muted">{{ i18n.t('sql.subtitle') }}</p>
    </section>

    <div class="lab">
      <aside class="card lab-list">
        <button class="lab-item" [class.active]="!selected()" (click)="select('')">
          🛝 {{ i18n.t('sql.playground') }}
        </button>
        <h3 class="small muted">
          {{ i18n.t('sql.exercises') }} · {{ solvedCount() }}/{{ data()?.exercises?.length ?? 0 }}
        </h3>
        @for (ex of data()?.exercises ?? []; track ex.id; let i = $index) {
          <button
            class="lab-item"
            [class.active]="selected()?.id === ex.id"
            (click)="select(ex.id)"
          >
            <span class="lab-check">{{ store.state().sqlSolved[ex.id] ? '✅' : i + 1 }}</span>
            <span>{{ i18n.pick(ex.title) }}</span>
            <span class="lvl lvl-{{ ex.level }}">L{{ ex.level }}</span>
          </button>
        }
      </aside>

      <section class="lab-main">
        @if (selected(); as ex) {
          <div class="card">
            <h2>
              {{ i18n.pick(ex.title) }}
              <span class="lvl lvl-{{ ex.level }}">{{ i18n.t('sql.level') }} {{ ex.level }}</span>
            </h2>
            <p class="prompt">{{ i18n.pick(ex.prompt) }}</p>
            @if (showHint() && ex.hint) {
              <p class="notice">💡 {{ i18n.pick(ex.hint) }}</p>
            }
            @if (showSolution()) {
              <pre class="solution"><code>{{ ex.solution }}</code></pre>
            }
          </div>
        }

        <div class="card editor-card">
          <textarea
            class="sql-editor"
            spellcheck="false"
            [value]="query()"
            (input)="onInput($any($event.target).value)"
            (keydown)="onKey($event)"
            aria-label="SQL editor"
          ></textarea>
          <div class="btn-row">
            <button class="btn" (click)="run()" [disabled]="!engine()">
              ▶ {{ i18n.t('sql.run') }}
            </button>
            @if (selected(); as ex) {
              <button class="btn success" (click)="check()" [disabled]="!engine()">
                ✔ {{ i18n.t('sql.check') }}
              </button>
              @if (ex.hint) {
                <button class="btn ghost" (click)="showHint.set(!showHint())">
                  💡 {{ i18n.t('sql.hint') }}
                </button>
              }
              <button class="btn ghost" (click)="showSolution.set(!showSolution())">
                👀 {{ i18n.t('sql.solution') }}
              </button>
            }
            <button class="btn ghost" (click)="onInput('')">✕ {{ i18n.t('sql.reset') }}</button>
            <span class="spacer"></span>
            <span class="small muted">{{
              engine() ? i18n.t('sql.shortcut') : i18n.t('sql.loadingEngine')
            }}</span>
          </div>
        </div>

        @if (outcome(); as o) {
          <div class="check" [class.ok]="o.ok" [class.bad]="!o.ok">{{ outcomeText(o) }}</div>
        }
        @if (error()) {
          <pre class="sql-error">{{ error() }}</pre>
        }
        @if (result(); as r) {
          <div class="card result">
            <div class="small muted">{{ r.rows.length }} {{ i18n.t('sql.rows') }}</div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    @for (c of r.columns; track $index) {
                      <th>{{ c }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of r.rows.slice(0, 200); track $index) {
                    <tr>
                      @for (v of row; track $index) {
                        <td [class.null]="v === null">{{ v === null ? 'NULL' : v }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @else if (ranEmpty()) {
          <p class="muted">{{ i18n.t('sql.noResult') }}</p>
        }

        <details class="card schema">
          <summary>🗂 {{ i18n.t('sql.schema') }}</summary>
          <div class="schema-grid">
            @for (t of tables(); track t.name) {
              <div class="schema-table">
                <strong>{{ t.name }}</strong>
                <ul>
                  @for (c of t.columns; track c.name) {
                    <li>
                      {{ c.pk ? '🔑 ' : '' }}{{ c.name }} <span class="muted">{{ c.type }}</span>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        </details>
      </section>
    </div>
  `,
})
export class SqlLabPage {
  /** ?ex=<exerciseId> query param. */
  readonly ex = input<string>();

  protected readonly i18n = inject(I18n);
  protected readonly store = inject(StoreService);
  private readonly content = inject(ContentService);
  private readonly router = inject(Router);

  protected readonly data = signal<SqlLabData | null>(null);
  protected readonly engine = signal<SqlJsStatic | null>(null);
  protected readonly query = signal('');
  protected readonly result = signal<RunResult | null>(null);
  protected readonly ranEmpty = signal(false);
  protected readonly error = signal('');
  protected readonly outcome = signal<CheckOutcome | null>(null);
  protected readonly showHint = signal(false);
  protected readonly showSolution = signal(false);
  protected readonly tables = signal<TableInfo[]>([]);

  protected readonly selected = computed(() =>
    this.data()?.exercises.find((e) => e.id === this.ex()),
  );
  protected readonly solvedCount = computed(
    () => (this.data()?.exercises ?? []).filter((e) => this.store.state().sqlSolved[e.id]).length,
  );
  private readonly draftKey = computed(() => this.selected()?.id ?? PLAYGROUND_ID);

  constructor() {
    this.content
      .sqlLab()
      .then((d) => this.data.set(d))
      .catch((e) => this.error.set(String(e)));
    loadSqlEngine()
      .then((SQL) => this.engine.set(SQL))
      .catch((e) => this.error.set(String(e)));

    // When the exercise changes: restore its draft and clear previous output.
    effect(() => {
      const key = this.draftKey();
      untracked(() => {
        const draft = this.store.state().sqlDrafts[key];
        this.query.set(draft ?? (key === PLAYGROUND_ID ? PLAYGROUND_DEFAULT : ''));
        this.result.set(null);
        this.ranEmpty.set(false);
        this.error.set('');
        this.outcome.set(null);
        this.showHint.set(false);
        this.showSolution.set(false);
      });
    });

    // Build the schema browser once engine + data are ready.
    effect(() => {
      const SQL = this.engine();
      const d = this.data();
      if (!SQL || !d) return;
      untracked(() => this.tables.set(this.readSchema(SQL, d.schema)));
    });
  }

  protected select(id: string) {
    this.router.navigate([], { queryParams: { ex: id || null } });
  }

  protected onInput(value: string) {
    this.query.set(value);
    this.store.saveSqlDraft(this.draftKey(), value);
  }

  protected onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.run();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target as HTMLTextAreaElement;
      const { selectionStart: s, selectionEnd: end, value } = ta;
      this.onInput(value.slice(0, s) + '  ' + value.slice(end));
      queueMicrotask(() => ta.setSelectionRange(s + 2, s + 2));
    }
  }

  private exec(sql: string): RunResult | null {
    return runOnFreshDb(this.engine()!, this.data()?.schema ?? '', sql);
  }

  protected run() {
    if (!this.engine() || !this.query().trim()) return;
    this.outcome.set(null);
    try {
      const r = this.exec(this.query());
      this.result.set(r);
      this.ranEmpty.set(!r);
      this.error.set('');
    } catch (e) {
      this.result.set(null);
      this.ranEmpty.set(false);
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  protected check() {
    const ex = this.selected();
    if (!ex || !this.engine()) return;
    this.run();
    if (this.error()) return;
    const expected = this.exec(ex.solution);
    const o = compareResults(this.result(), expected, !!ex.ordered);
    this.outcome.set(o);
    if (o.ok) this.store.markSqlSolved(ex.id);
  }

  protected outcomeText(o: CheckOutcome): string {
    if (o.ok) return this.i18n.t('sql.correct');
    const detail =
      o.expected !== undefined
        ? ` (${this.i18n.t('sql.expected')} ${o.expected}, ${this.i18n.t('sql.got')} ${o.got})`
        : '';
    switch (o.reason) {
      case 'cols':
        return this.i18n.t('sql.wrongCols') + detail;
      case 'rows':
        return this.i18n.t('sql.wrongRows') + detail;
      case 'order':
        return this.i18n.t('sql.wrongOrder');
      default:
        return this.i18n.t('sql.wrongValues');
    }
  }

  private readSchema(SQL: SqlJsStatic, schema: string): TableInfo[] {
    const db = new SQL.Database();
    try {
      db.exec(schema);
      const names = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
      );
      return (names[0]?.values ?? []).map(([name]) => {
        const info = db.exec(`PRAGMA table_info("${String(name)}")`)[0];
        return {
          name: String(name),
          columns: (info?.values ?? []).map((c) => ({
            name: String(c[1]),
            type: String(c[2]),
            pk: Number(c[5]) > 0,
          })),
        };
      });
    } finally {
      db.close();
    }
  }
}
