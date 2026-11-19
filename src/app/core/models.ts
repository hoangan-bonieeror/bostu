export type Lang = 'vi' | 'en';
export type Theme = 'light' | 'dark';

/** A piece of text available in both languages. */
export interface I18nText {
  vi: string;
  en: string;
}

export interface Category {
  id: string;
  icon: string;
  colors: [string, string];
  title: I18nText;
  desc: I18nText;
}

export interface Series {
  id: string;
  title: I18nText;
  desc: I18nText;
}

export type PostType = 'article' | 'note' | 'radar';

/** One entry of public/content/generated/posts.json (built by scripts/build-content.mjs). */
export interface PostMeta {
  id: string;
  date: string;
  category: string;
  type: PostType;
  tags: string[];
  series?: string;
  seriesOrder?: number;
  cover?: string;
  author: string;
  langs: Lang[];
  title: I18nText;
  summary: I18nText;
  minutes: { vi: number; en: number };
}

export interface SiteInfo {
  title: string;
  url: string;
  author: string;
  description: I18nText;
}

export const RADAR_CATEGORY = 'tech-radar';

/** Written by the Tech Radar bot on every run (public/content/radar-status.json). */
export interface RadarStatus {
  lastRun: string;
  days: number;
  sources: { id: string; name: string; ok: boolean; fetched: number; error: string | null }[];
  relevant: number;
  published: number;
  postId: string | null;
  crawl?: { attempted: number; ok: number; failed: number; robots: number } | null;
  /** Older status files stored a boolean. */
  ai:
    | boolean
    | { enabled: boolean; ok: boolean; model: string; summarized: number; error: string | null };
}

export interface Settings {
  lang: Lang;
  theme: Theme;
}

export interface PostNote {
  text: string;
  updated: string;
}

export interface AppState {
  version: 2;
  settings: Settings;
  /** postId -> ISO date first read to the end */
  read: Record<string, string>;
  /** postId -> ISO date bookmarked */
  bookmarks: Record<string, string>;
  /** postId -> personal note */
  notes: Record<string, PostNote>;
}
