import { Component, computed, inject, input } from '@angular/core';
import { addDays, fromDateKey, today } from '../core/dates';
import { DayActivity } from '../core/models';
import { I18n } from '../core/i18n';

interface Cell {
  key: string;
  level: number;
  title: string;
  future: boolean;
}

/** GitHub-style activity heatmap: columns are weeks, rows are weekdays (Mon..Sun). */
@Component({
  selector: 'app-heatmap',
  template: `
    <div class="heatmap" [style.--weeks]="weeks()">
      @for (col of columns(); track $index) {
        <div class="hm-col">
          @for (cell of col; track cell.key) {
            <span
              class="hm-cell"
              [class.future]="cell.future"
              [attr.data-level]="cell.level"
              [title]="cell.title"
            ></span>
          }
        </div>
      }
    </div>
    <div class="hm-legend">
      {{ i18n.t('dash.less') }}
      @for (l of [0, 1, 2, 3, 4]; track l) {
        <span class="hm-cell" [attr.data-level]="l"></span>
      }
      {{ i18n.t('dash.more') }}
    </div>
  `,
})
export class Heatmap {
  protected readonly i18n = inject(I18n);
  readonly activity = input.required<Record<string, DayActivity>>();
  readonly weeks = input(20);

  protected readonly columns = computed(() => {
    const act = this.activity();
    const t = today();
    const dow = (fromDateKey(t).getDay() + 6) % 7; // Monday = 0
    const start = addDays(t, -dow - (this.weeks() - 1) * 7);
    const unit = this.i18n.t('common.minutes');
    const cols: Cell[][] = [];
    for (let w = 0; w < this.weeks(); w++) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const key = addDays(start, w * 7 + d);
        const a = act[key];
        const m = a?.minutes ?? 0;
        const level = !a ? 0 : m >= 60 ? 4 : m >= 30 ? 3 : m >= 10 ? 2 : 1;
        col.push({ key, level, future: key > t, title: `${key}: ${Math.round(m)} ${unit}` });
      }
      cols.push(col);
    }
    return cols;
  });
}
