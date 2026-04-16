import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../auth.service';

type Step = 'email' | 'otp' | 'password';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {
  step: Step = 'email';

  name = '';
  email = '';
  section = '';
  otp = '';
  password = '';
  confirmPassword = '';

  // Section options
  sections = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'];

  loading = false;
  error = '';
  success = '';
  showPassword = false;
  showConfirm = false;

  resendCooldown = 0;
  private resendInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  get stepNumber(): number {
    return { email: 1, otp: 2, password: 3 }[this.step];
  }

  async sendOtp() {
    this.error = '';
    if (!this.name.trim()) { this.error = 'Please enter your full name.'; return; }
    if (!this.section) { this.error = 'Please select a section.'; return; }
    if (!this.email.trim()) { this.error = 'Please enter your email address.'; return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email.trim())) { this.error = 'Please enter a valid email address.'; return; }

    this.loading = true;
    try {
      await this.auth.sendOtp(this.email.trim());
      this.success = `OTP sent to ${this.email}! Check your inbox.`;
      this.step = 'otp';
      this.startResendTimer();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async resendOtp() {
    if (this.resendCooldown > 0) return;
    this.error = '';
    this.success = '';
    this.loading = true;
    try {
      await this.auth.sendOtp(this.email.trim());
      this.success = 'New OTP sent! Check your inbox.';
      this.startResendTimer();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private startResendTimer() {
    this.resendCooldown = 60;
    if (this.resendInterval) clearInterval(this.resendInterval);
    this.resendInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendInterval!);
        this.resendInterval = null;
      }
    }, 1000);
  }

  verifyOtp() {
    this.error = '';
    if (!this.otp.trim() || this.otp.trim().length !== 6) {
      this.error = 'Please enter the 6-digit OTP.'; return;
    }
    this.step = 'password';
    this.success = '';
  }

  async register() {
    this.error = '';
    if (!this.password || this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.'; return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.'; return;
    }
    this.loading = true;
    try {
      await this.auth.verifyOtpAndRegister(this.name.trim(), this.email.trim(), this.otp.trim(), this.password, this.section);
      this.router.navigate(['/dashboard']);
    } catch (e: unknown) {
      this.error = (e as Error).message;
      if ((e as Error).message.toLowerCase().includes('otp')) {
        this.step = 'otp';
      }
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    this.error = '';
    this.success = '';
    if (this.step === 'otp') this.step = 'email';
    else if (this.step === 'password') this.step = 'otp';
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirm() { this.showConfirm = !this.showConfirm; }
}
