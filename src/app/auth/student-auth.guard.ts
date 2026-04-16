import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { StudentAuthService } from './student-auth.service';

export const studentAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(StudentAuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Redirect to student login if not authenticated
  router.navigate(['/student/login'], {
    queryParams: { returnUrl: state.url }
  });
  return false;
};
