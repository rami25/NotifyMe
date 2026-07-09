import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) {
    return router.parseUrl('/login');
  }
  if (user.role !== 'admin') {
    // Not an admin — send them back to their own plan rather than a dead end.
    return router.parseUrl('/plan');
  }
  return true;
};
