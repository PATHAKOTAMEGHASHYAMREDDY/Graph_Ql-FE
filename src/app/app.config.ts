import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter }     from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes }          from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';

/**
 * Root application configuration.
 *
 * - `provideRouter`      — sets up lazy-loaded standalone-component routes
 * - `provideHttpClient`  — registers Angular's HttpClient with the
 *   `authInterceptor` so every HTTP request automatically carries the
 *   JWT Bearer token and 401 responses trigger session-expiry.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Register HttpClient globally with our JWT interceptor
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
  ],
};
