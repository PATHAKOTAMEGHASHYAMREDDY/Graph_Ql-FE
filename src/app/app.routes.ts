import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { studentAuthGuard } from './auth/student-auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  
  // Landing Page
  {
    path: 'home',
    loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent)
  },
  
  // Faculty Routes
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./auth/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  
  // Student Routes
  {
    path: 'student/login',
    loadComponent: () => import('./auth/student-login/student-login.component').then(m => m.StudentLoginComponent)
  },
  {
    path: 'student/signup',
    loadComponent: () => import('./auth/student-signup/student-signup.component').then(m => m.StudentSignupComponent)
  },
  {
    path: 'student/dashboard',
    loadComponent: () => import('./student-dashboard/student-dashboard.component').then(m => m.StudentDashboardComponent),
    canActivate: [studentAuthGuard]
  },
  
  { path: '**', redirectTo: 'home' }
];
