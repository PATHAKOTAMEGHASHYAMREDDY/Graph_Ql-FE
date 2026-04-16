import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { StudentAuthService } from '../student-auth.service';

type SignupStep = 'email' | 'otp' | 'password';

@Component({
  selector: 'app-student-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './student-signup.component.html',
  styleUrl: './student-signup.component.css'
})
export class StudentSignupComponent {
  // Step management
  step: SignupStep = 'email';
  stepNumber = 1;

  // Form fields
  name = '';
  email = '';
  section = '';
  otp = '';
  password = '';
  confirmPassword = '';

  // Section options
  sections = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'];

  // UI state
  loading = false;
  error = '';
  success = '';

  // Password visibility
  showPassword = false;
  showConfirm = false;

  // Resend OTP cooldown
  resendCooldown = 0;
  private resendTimer: any;

  constructor(
    private auth: StudentAuthService,
    private router: Router
  ) {}

  // Step 1: Send OTP
  async sendOtp() {
    if (!this.name.trim() || !this.email.trim() || !this.section) {
      this.error = 'Please enter your name, email, and select a section';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      await this.auth.sendOtp(this.email.trim());
      this.success = 'OTP sent to your email!';
      this.step = 'otp';
      this.stepNumber = 2;
      this.startResendCooldown();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  // Step 2: Verify OTP
  async verifyOtp() {
    if (!this.otp.trim() || this.otp.length !== 6) {
      this.error = 'Please enter the 6-digit OTP';
      return;
    }

    this.step = 'password';
    this.stepNumber = 3;
    this.error = '';
    this.success = 'OTP verified! Now set your password.';
  }

  // Step 3: Register with password
  async register() {
    if (!this.password.trim()) {
      this.error = 'Please enter a password';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.auth.verifyOtpAndRegister(
        this.name.trim(),
        this.email.trim(),
        this.section,
        this.otp.trim(),
        this.password
      );
      this.router.navigate(['/student/dashboard']);
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  // Resend OTP
  async resendOtp() {
    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      await this.auth.sendOtp(this.email.trim());
      this.success = 'OTP resent to your email!';
      this.startResendCooldown();
    } catch (e: unknown) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  // Start 60-second cooldown for resend
  private startResendCooldown() {
    this.resendCooldown = 60;
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }

  // Go back to previous step
  goBack() {
    if (this.step === 'otp') {
      this.step = 'email';
      this.stepNumber = 1;
    } else if (this.step === 'password') {
      this.step = 'otp';
      this.stepNumber = 2;
    }
    this.error = '';
    this.success = '';
  }

  // Toggle password visibility
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirm() {
    this.showConfirm = !this.showConfirm;
  }

  ngOnDestroy() {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
  }
}
