import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { StudentAuthService } from '../student-auth.service';

@Component({
  selector: 'app-student-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './student-login.component.html',
  styleUrl: './student-login.component.css'
})
export class StudentLoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private auth: StudentAuthService,
    private router: Router
  ) {}

  async onSubmit() {
    if (!this.email.trim() || !this.password.trim()) {
      this.error = 'Please enter both email and password';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.auth.login(this.email.trim(), this.password);
      this.router.navigate(['/student/dashboard']);
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }
}
