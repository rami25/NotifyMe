import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'plan', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'plan',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/actions-list/actions-list.page').then(m => m.ActionsListPage)
  },
  {
    path: 'action/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/action-detail/action-detail.page').then(m => m.ActionDetailPage)
  },
  {
    path: 'finished',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/finished-actions/finished-actions.page').then(m => m.FinishedActionsPage)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage)
  },
  // ---- Admin panel: same app, role-gated routes (per the spec, not a standalone app) ----
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/dashboard/dashboard.page').then(m => m.AdminDashboardPage)
  },
  {
    path: 'admin/actions',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/actions-board/actions-board.page').then(m => m.AdminActionsBoardPage)
  },
  {
    path: 'admin/actions/new',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/action-form/action-form.page').then(m => m.AdminActionFormPage)
  },
  {
    path: 'admin/actions/:id/edit',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/action-form/action-form.page').then(m => m.AdminActionFormPage)
  },
  {
    path: 'admin/actions/:id',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-action-detail/admin-action-detail.page').then(
        m => m.AdminActionDetailPage
      )
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/users/users.page').then(m => m.AdminUsersPage)
  },
  { path: '**', redirectTo: 'plan' }
];
