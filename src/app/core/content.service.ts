import { Injectable, computed, signal } from '@angular/core';
import { Category, Lang, PostMeta, RadarStatus, Series, SiteInfo } from './models';

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/**
 * Loads blog content from /content (the `public/` folder).
 * The post index is generated at build time by scripts/build-content.mjs.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private cache = new Map<string, Promise<unknown>>();

  /** Reactive copies of the small indexes, loaded once at startup. */
  readonly posts = signal<PostMeta[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly series = signal<Series[]>([]);
  readonly site = signal<SiteInfo | null>(null);
  readonly loaded = signal(false);
  readonly error = signal(false);

  readonly categoryById = computed(() => new Map(this.categories().map((c) => [c.id, c])));
  readonly seriesById = computed(() => new Map(this.series().map((s) => [s.id, s])));
  readonly postById = computed(() => new Map(this.posts().map((p) => [p.id, p])));

  constructor() {
    Promise.all([
      this.get<PostMeta[]>('generated/posts.json', 'json'),
      this.get<Category[]>('categories.json', 'json'),
      this.get<Series[]>('series.json', 'json'),
      this.get<SiteInfo>('site.json', 'json'),
    ])
      .then(([posts, cats, series, site]) => {
        this.posts.set(posts);
        this.categories.set(cats);
        this.series.set(series);
        this.site.set(site);
      })
      .catch(() => this.error.set(true))
      .finally(() => this.loaded.set(true));
  }

  private get<T>(path: string, kind: 'json' | 'text'): Promise<T> {
    const key = `${kind}:${path}`;
    if (!this.cache.has(key)) {
      const p = fetch(`content/${path}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`);
        return kind === 'json' ? r.json() : r.text();
      });
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
    }
    return this.cache.get(key) as Promise<T>;
  }

  /** Post markdown (without front matter) in the requested language, falling back to the other one. */
  async postMarkdown(id: string, lang: Lang): Promise<{ md: string; lang: Lang }> {
    const strip = (t: string) => t.replace(FRONTMATTER, '');
    try {
      return { md: strip(await this.get<string>(`posts/${id}.${lang}.md`, 'text')), lang };
    } catch {
      const other: Lang = lang === 'vi' ? 'en' : 'vi';
      return { md: strip(await this.get<string>(`posts/${id}.${other}.md`, 'text')), lang: other };
    }
  }

  searchIndex(lang: Lang) {
    return this.get<{ id: string; text: string }[]>(`generated/search.${lang}.json`, 'json');
  }

  sqlDatabase(name: string) {
    return this.get<string>(`sql/${name}.sql`, 'text');
  }

  /** Last Tech Radar bot run; null if the bot has not run yet. */
  radarStatus(): Promise<RadarStatus | null> {
    return fetch(`content/radar-status.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
}
