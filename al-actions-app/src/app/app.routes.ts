import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'plan', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'plan',
    // canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/actions-list/actions-list.page').then(m => m.ActionsListPage)
  },
  {
    path: 'action/:id',
    // canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/action-detail/action-detail.page').then(m => m.ActionDetailPage)
  },
  {
    path: 'finished',
    // canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/finished-actions/finished-actions.page').then(m => m.FinishedActionsPage)
  },
  {
    path: 'profile',
    // canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage)
  },
  { path: '**', redirectTo: 'plan' }
];
