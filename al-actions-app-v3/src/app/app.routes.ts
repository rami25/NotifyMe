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
  {
    path: 'employee',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/employee/dashboard/dashboard.page').then(m => m.EmployeeDashboardPage)
  },
  {
    path: 'employee/actions',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/employee/actions-board/actions-board.page').then(m => m.EmployeeActionsBoardPage)
  },
  {
    path: 'employee/actions/new',
    canActivate: [authGuard],
    data: { formMode: 'create' },
    loadComponent: () => import('./pages/employee/action-form/action-form.page').then(m => m.EmployeeActionFormPage)
  },
  {
    path: 'employee/actions/:id/edit',
    canActivate: [authGuard],
    data: { formMode: 'edit' },
    loadComponent: () => import('./pages/employee/action-form/action-form.page').then(m => m.EmployeeActionFormPage)
  },
  {
    path: 'employee/actions/:id/duplicate',
    canActivate: [authGuard],
    data: { formMode: 'duplicate' },
    loadComponent: () => import('./pages/employee/action-form/action-form.page').then(m => m.EmployeeActionFormPage)
  },
  {
    path: 'employee/actions/:id/restore',
    canActivate: [authGuard],
    data: { formMode: 'restore' },
    loadComponent: () => import('./pages/employee/action-form/action-form.page').then(m => m.EmployeeActionFormPage)
  },
  {
    path: 'employee/actions/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/employee/action-detail/action-detail.page').then(m => m.EmployeeActionDetailPage)
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
    data: { formMode: 'create' },
    loadComponent: () =>
      import('./pages/admin/action-form/action-form.page').then(m => m.AdminActionFormPage)
  },
  {
    path: 'admin/actions/:id/edit',
    canActivate: [authGuard, adminGuard],
    data: { formMode: 'edit' },
    loadComponent: () =>
      import('./pages/admin/action-form/action-form.page').then(m => m.AdminActionFormPage)
  },
  {
    // Finished actions can't be edited directly — this creates a new
    // action from the finished one's fields, leaving the original as-is.
    path: 'admin/actions/:id/duplicate',
    canActivate: [authGuard, adminGuard],
    data: { formMode: 'duplicate' },
    loadComponent: () =>
      import('./pages/admin/action-form/action-form.page').then(m => m.AdminActionFormPage)
  },
  {
    // Cancelled actions can't be edited directly either — this reactivates
    // the same action (in_progress/postponed, derived from the deadline),
    // letting the admin edit fields as part of the same step.
    path: 'admin/actions/:id/restore',
    canActivate: [authGuard, adminGuard],
    data: { formMode: 'restore' },
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
