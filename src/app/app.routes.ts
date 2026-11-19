import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.HomePage) },
  { path: 'p/:id', loadComponent: () => import('./pages/post').then((m) => m.PostPage) },
  { path: 'c/:id', loadComponent: () => import('./pages/category').then((m) => m.CategoryPage) },
  { path: 'tag/:tag', loadComponent: () => import('./pages/tag').then((m) => m.TagPage) },
  { path: 'series', loadComponent: () => import('./pages/series').then((m) => m.SeriesPage) },
  { path: 'series/:id', loadComponent: () => import('./pages/series').then((m) => m.SeriesPage) },
  { path: 'archive', loadComponent: () => import('./pages/archive').then((m) => m.ArchivePage) },
  { path: 'search', loadComponent: () => import('./pages/search').then((m) => m.SearchPage) },
  { path: 'saved', loadComponent: () => import('./pages/saved').then((m) => m.SavedPage) },
  // Links from the previous "learning app" version keep working.
  { path: 'lessons/:id', redirectTo: 'p/:id' },
  { path: 'lessons', redirectTo: 'c/tech-radar' },
  { path: '**', redirectTo: '' },
];
