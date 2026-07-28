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
    // Not an admin — send them to the employee workspace rather than a dead end.
    return router.parseUrl('/employee');
  }
  return true;
};
