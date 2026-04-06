import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * HTTP Interceptor — Angular 17+ functional style.
 *
 * Responsibilities:
 *  1. Attach the JWT Bearer token to every outgoing HTTP request.
 *  2. Intercept 401 Unauthorized responses and trigger session-expiry:
 *       → logs the user out
 *       → redirects to /login
 *       → shows a "Session expired" alert
 *
 * NOTE: This interceptor works for **Angular HttpClient** calls.
 * The existing GraphQL service uses raw `fetch()` — those calls go directly
 * through the GraphQL endpoint and are handled by the BehaviorSubject watcher.
 * If you migrate GraphQL to use HttpClient in the future, this interceptor
 * will automatically protect those calls too.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Inject services lazily inside the function (Angular 17+ DI pattern)
  const authService = inject(AuthService);

  // ── Step 1: Clone the request and attach the token ──────────────────────
  const token = authService.getToken();

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req; // No token yet (unauthenticated request — let it pass through)

  // ── Step 2: Forward request and handle 401 responses ──────────────────
  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Token is invalid or expired on the server side
        // Trigger the session-expired flow (logout + redirect + alert)
        authService.expireSession();
      }
      // Re-throw so the calling code can also handle the error if needed
      return throwError(() => error);
    })
  );
};
