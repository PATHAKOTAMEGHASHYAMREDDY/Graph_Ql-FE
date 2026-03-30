import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';
  showPassword = false;

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async login() {
    this.error = '';
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
