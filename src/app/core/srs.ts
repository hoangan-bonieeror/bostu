import { addDays } from './dates';
import { CardState } from './models';

/** Answer grades shown on the flashcard buttons (SM-2 quality). */
export type Grade = 0 | 3 | 4 | 5;

export const NEW_CARD: Omit<CardState, 'due'> = { ef: 2.5, interval: 0, reps: 0, lapses: 0 };

/**
 * SM-2 spaced-repetition algorithm (SuperMemo 2).
 * 0 = Again, 3 = Hard, 4 = Good, 5 = Easy.
 */
export function schedule(prev: CardState | undefined, grade: Grade, todayKey: string): CardState {
  let { ef, interval, reps, lapses } = prev ?? NEW_CARD;

  if (grade < 3) {
    reps = 0;
    interval = 1;
    lapses += 1;
  } else {
    reps += 1;
    if (reps === 1) interval = grade === 5 ? 4 : 1;
    else if (reps === 2) interval = grade === 5 ? 7 : 4;
    else interval = Math.round(interval * ef);

    if (grade === 3) interval = Math.max(1, Math.round(interval * 0.6));
    if (grade === 5) interval = Math.round(interval * 1.3);
  }

  ef = Math.max(1.3, ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  return {
    ef: Math.round(ef * 100) / 100,
    interval,
    reps,
    lapses,
    due: addDays(todayKey, interval),
  };
}

/** Human readable "next interval" label for a grade, used on buttons. */
export function previewInterval(
  prev: CardState | undefined,
  grade: Grade,
  todayKey: string,
): number {
  return grade < 3 ? 0 : schedule(prev, grade, todayKey).interval;
}
