import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { FormsModule }       from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatIconModule }     from '@angular/material/icon';
import { AuthService }       from '../auth.service';

@Component({
  selector   : 'app-login',
  standalone : true,
  imports    : [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './login.component.html',
  styleUrl   : './login.component.css',
})
export class LoginComponent implements OnInit {
  email        = '';
  password     = '';
  loading      = false;
  error        = '';
  showPassword = false;

  /**
   * Set to true when the user arrives here via /login?expired=true
   * (triggered by the token watcher, auth guard, or 401 interceptor).
   * The template displays a distinct "Session expired" banner in this case.
   */
  sessionExpired = false;

  constructor(
    private auth  : AuthService,
    private router: Router,
    private route : ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Already logged in → go to dashboard
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Check if we arrived here because the session expired
    this.route.queryParams.subscribe(params => {
      if (params['expired'] === 'true') {
        this.sessionExpired = true;
        this.error = '⚠️ Session expired. Please log in again.';
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async login(): Promise<void> {
    this.error = '';
    this.sessionExpired = false;

    if (!this.email.trim() || !this.password.trim()) {
      this.error = 'Please fill in all fields.';
      return;
    }
    this.loading = true;
    try {
      await this.auth.login(this.email.trim(), this.password);
      this.router.navigate(['/dashboard']);
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }
}
