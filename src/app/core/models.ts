export type Lang = 'vi' | 'en';
export type Theme = 'light' | 'dark';

/** A piece of text available in both languages. */
export interface I18nText {
  vi: string;
  en: string;
}

/** 'trends' skills (e.g. tech-radar) are blog categories, not roadmap steps. */
export type SkillLevel = 'foundation' | 'core' | 'advanced' | 'trends';

export interface Skill {
  id: string;
  icon: string;
  level: SkillLevel;
  title: I18nText;
  desc: I18nText;
  topics: I18nText[];
}

export interface LessonMeta {
  id: string;
  skill: string;
  minutes: number;
  title: I18nText;
  summary: I18nText;
  /** Related exercise ids in the SQL Lab. */
  sqlExercises?: string[];
  /** Publish date YYYY-MM-DD shown on the blog card. */
  date?: string;
  /** Cover image path; defaults to content/covers/<id>.svg */
  cover?: string;
  tags?: string[];
}

export const RADAR_SKILL = 'tech-radar';

/** Written by the Tech Radar bot on every run (public/content/radar-status.json). */
export interface RadarStatus {
  lastRun: string;
  days: number;
  sources: { id: string; name: string; ok: boolean; fetched: number; error: string | null }[];
  relevant: number;
  published: number;
  postId: string | null;
  /** Older status files stored a boolean. */
  ai:
    | boolean
    | { enabled: boolean; ok: boolean; model: string; summarized: number; error: string | null };
}

/** Tech Radar posts are generated weekly by the bot in scripts/tech-radar. */
export function isRadar(l: LessonMeta | undefined): boolean {
  return l?.skill === RADAR_SKILL;
}

export function lessonCover(l: LessonMeta): string {
  return l.cover ?? `content/covers/${l.id}.svg`;
}

export interface SqlExercise {
  id: string;
  level: 1 | 2 | 3;
  title: I18nText;
  prompt: I18nText;
  hint?: I18nText;
  solution: string;
  /** When true, row order must match the solution (query uses ORDER BY). */
  ordered?: boolean;
}

export interface SqlLabData {
  schema: string;
  exercises: SqlExercise[];
}

export interface Flashcard {
  id: string;
  skill: string;
  front: I18nText;
  back: I18nText;
}

/** SM-2 scheduling state of one flashcard. */
export interface CardState {
  ef: number;
  interval: number;
  reps: number;
  lapses: number;
  /** Local date YYYY-MM-DD when the card is next due. */
  due: string;
}

export interface DayActivity {
  minutes: number;
  actions: number;
}

export interface Settings {
  lang: Lang;
  theme: Theme;
  dailyNewCards: number;
  dailyGoalMinutes: number;
}

export interface AppState {
  version: 1;
  settings: Settings;
  /** lessonId -> date completed */
  lessonsDone: Record<string, string>;
  /** skillId -> self rating 0..5 */
  skillRatings: Record<string, number>;
  /** exerciseId -> date solved */
  sqlSolved: Record<string, string>;
  /** exerciseId -> last query typed */
  sqlDrafts: Record<string, string>;
  cards: Record<string, CardState>;
  /** date -> activity */
  activity: Record<string, DayActivity>;
  /** date -> number of new cards introduced */
  newCardsIntroduced: Record<string, number>;
}
