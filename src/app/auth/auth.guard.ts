import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Route guard protecting the /dashboard route.
 *
 * - If the user has a valid token in localStorage → allow access.
 * - If no token exists → redirect to /login?expired=true so the login
 *   page can display a "Session expired" message (handles the case where
 *   the guard runs after the token has already been removed).
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // No token — redirect to login with the expired flag so the login
  // page can show a contextual "Session expired" message.
  router.navigate(['/login'], { queryParams: { expired: 'true' } });
  return false;
};
