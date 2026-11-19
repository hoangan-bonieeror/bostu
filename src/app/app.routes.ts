import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage) },
  { path: 'roadmap', loadComponent: () => import('./pages/roadmap').then((m) => m.RoadmapPage) },
  { path: 'lessons', loadComponent: () => import('./pages/lessons').then((m) => m.LessonsPage) },
  {
    path: 'lessons/:id',
    loadComponent: () => import('./pages/lesson-detail').then((m) => m.LessonDetailPage),
  },
  { path: 'sql', loadComponent: () => import('./pages/sql-lab').then((m) => m.SqlLabPage) },
  {
    path: 'cards',
    loadComponent: () => import('./pages/flashcards').then((m) => m.FlashcardsPage),
  },
  { path: 'settings', loadComponent: () => import('./pages/settings').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: '' },
];
