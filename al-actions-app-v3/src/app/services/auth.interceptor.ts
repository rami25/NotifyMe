import { HttpInterceptorFn } from '@angular/common/http';

const SESSION_KEY = 'al_session_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return next(req);

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  );
};
