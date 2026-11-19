import { Injectable } from '@angular/core';
import { Flashcard, Lang, LessonMeta, RadarStatus, Skill, SqlLabData } from './models';

/**
 * Loads learning content from /content (served from the `public/` folder).
 * Content lives in plain JSON/Markdown so you can add lessons without touching code.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private cache = new Map<string, Promise<unknown>>();

  private get<T>(path: string, kind: 'json' | 'text'): Promise<T> {
    const key = `${kind}:${path}`;
    if (!this.cache.has(key)) {
      const p = fetch(`content/${path}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`);
        return kind === 'json' ? r.json() : r.text();
      });
      p.catch(() => this.cache.delete(key)); // allow retry after a failure
      this.cache.set(key, p);
    }
    return this.cache.get(key) as Promise<T>;
  }

  skills() {
    return this.get<Skill[]>('skills.json', 'json');
  }

  lessons() {
    return this.get<LessonMeta[]>('lessons.json', 'json');
  }

  sqlLab() {
    return this.get<SqlLabData>('sql-lab.json', 'json');
  }

  /** Last Tech Radar bot run; resolves to null if the bot has not run yet. */
  radarStatus(): Promise<RadarStatus | null> {
    return fetch(`content/radar-status.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }

  flashcards() {
    return this.get<Flashcard[]>('flashcards.json', 'json');
  }

  /** Lesson markdown in the requested language, falling back to the other language. */
  async lessonMarkdown(id: string, lang: Lang): Promise<{ md: string; lang: Lang }> {
    try {
      return { md: await this.get<string>(`lessons/${id}.${lang}.md`, 'text'), lang };
    } catch {
      const other: Lang = lang === 'vi' ? 'en' : 'vi';
      return { md: await this.get<string>(`lessons/${id}.${other}.md`, 'text'), lang: other };
    }
  }
}
