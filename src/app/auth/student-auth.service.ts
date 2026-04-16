import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Crypto helper ────────────────────────────────────────────────────────────
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Student {
  id: number;
  name: string;
  email: string;
  english: number;
  tamil: number;
  maths: number;
  total: number;
  englishStatus: string;
  tamilStatus: string;
  mathsStatus: string;
}

export interface StudentAuthPayload {
  token: string;
  refreshToken: string;
  student: Student;
  debug?: {
    type: string;
    email?: string;
    maxAttempts?: number;
    remainingAttempts?: number;
    waitMinutes?: number;
    reason?: string;
    timestamp: string;
    message?: string;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────
const API = environment.apiUrl;
const TOKEN_KEY = 'student_token';
const REFRESH_TOKEN_KEY = 'student_refresh_token';
const STUDENT_KEY = 'student_data';

// ── GraphQL helper ─────────────────────────────────────────────────────────
async function gql(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string
): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const errorData = await res.json();
    console.group('🚫 Rate Limit Exceeded');
    console.log('Message:', errorData.message);
    console.log('Retry After:', errorData.retryAfter);
    console.groupEnd();
    throw new Error(errorData.message || 'Too many requests. Please try again later after 5 min.');
  }

  const json = await res.json();
  
  if (json.errors) {
    const error = json.errors[0];
    console.group('🔴 GraphQL Error');
    console.log('Message:', error.message);
    console.log('Extensions:', error.extensions);
    
    if (error.extensions?.debug) {
      console.group('📊 Rate Limit Debug Info');
      console.log('Type:', error.extensions.debug.type);
      console.log('Email:', error.extensions.debug.email);
      console.log('Remaining Attempts:', error.extensions.debug.remainingAttempts);
      console.log('Wait Minutes:', error.extensions.debug.waitMinutes);
      console.log('Timestamp:', error.extensions.debug.timestamp);
      console.groupEnd();
    }
    console.groupEnd();
    
    throw new Error(error.message);
  }
  
  if (json.data?.loginStudent?.debug) {
    console.group('✅ Student Login Success Debug Info');
    console.log('Type:', json.data.loginStudent.debug.type);
    console.log('Remaining Attempts:', json.data.loginStudent.debug.remainingAttempts);
    console.log('Timestamp:', json.data.loginStudent.debug.timestamp);
    console.groupEnd();
  }
  
  return json.data;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StudentAuthService implements OnDestroy {

  private _isLoggedIn$ = new BehaviorSubject<boolean>(this._hasToken());
  readonly isLoggedIn$: Observable<boolean> = this._isLoggedIn$.asObservable();

  private _tokenWatcherId: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 1500;

  private refreshTimer: any = null;
  private readonly REFRESH_BEFORE_EXPIRY_MS = 45 * 1000; // 45 seconds

  constructor(private router: Router) { }

  private _hasToken(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getStudent(): Student | null {
    const raw = localStorage.getItem(STUDENT_KEY);
    return raw ? (JSON.parse(raw) as Student) : null;
  }

  isLoggedIn(): boolean {
    return this._hasToken();
  }

  private _store(payload: StudentAuthPayload): void {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(payload.student));
    this._isLoggedIn$.next(true);
    this.startAutoRefresh();
  }

  // ── Auto-refresh logic ─────────────────────────────────────────────────────

  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    console.log('⏰ Student auto-refresh timer started (will refresh in 45 seconds)');
    
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken();
    }, this.REFRESH_BEFORE_EXPIRY_MS);
  }

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      console.warn('⚠️ No student refresh token found');
      this.expireSession();
      return;
    }
    
    try {
      console.log('🔄 Refreshing student access token...');
      
      const data = await gql(
        `mutation RefreshStudentToken($refreshToken: String!) {
          refreshStudentAccessToken(refreshToken: $refreshToken) {
            token
            refreshToken
            student { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
          }
        }`,
        { refreshToken }
      ) as { refreshStudentAccessToken: StudentAuthPayload };
      
      localStorage.setItem(TOKEN_KEY, data.refreshStudentAccessToken.token);
      
      console.log('✅ Student access token refreshed successfully');
      console.log('⏰ Next refresh in 45 seconds');
      
      this.startAutoRefresh();
      
    } catch (error) {
      console.error('❌ Failed to refresh student token:', error);
      this.expireSession();
    }
  }

  // ── Session monitoring ─────────────────────────────────────────────────────

  startTokenWatch(): void {
    if (this._tokenWatcherId !== null) return;

    this._tokenWatcherId = setInterval(() => {
      if (this._isLoggedIn$.value && !this._hasToken()) {
        this._expireSession();
      }
    }, this.POLL_INTERVAL_MS);
  }

  stopTokenWatch(): void {
    if (this._tokenWatcherId !== null) {
      clearInterval(this._tokenWatcherId);
      this._tokenWatcherId = null;
    }
  }

  expireSession(): void {
    this._expireSession();
  }

  private _expireSession(): void {
    this.stopTokenWatch();
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(STUDENT_KEY);
    this._isLoggedIn$.next(false);

    this.router.navigate(['/student/login'], {
      queryParams: { expired: 'true' }
    }).then(() => {
      alert('⚠️ Session expired. Please log in again.');
      this.startTokenWatch();
    });
  }

  // ── Explicit logout ────────────────────────────────────────────────────────

  logout(): void {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    this.stopTokenWatch();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (refreshToken) {
      gql(
        `mutation LogoutStudent($refreshToken: String!) {
          logoutStudent(refreshToken: $refreshToken)
        }`,
        { refreshToken }
      ).catch(console.warn);
    }
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(STUDENT_KEY);
    this._isLoggedIn$.next(false);
    
    console.log('👋 Student logged out successfully');
    
    this.router.navigate(['/student/login']).then(() => {
      this.startTokenWatch();
    });
  }

  // ── OTP flow ───────────────────────────────────────────────────────────────

  async sendOtp(email: string): Promise<string> {
    const data = await gql(
      `mutation SendStudentOtp($email: String!) { sendStudentOtp(email: $email) }`,
      { email }
    ) as { sendStudentOtp: string };
    return data.sendStudentOtp;
  }

  async verifyOtpAndRegister(
    name: string,
    email: string,
    section: string,
    otp: string,
    password: string
  ): Promise<StudentAuthPayload> {
    const hashedPassword = await sha256(password);

    const data = await gql(
      `mutation VerifyStudentOtp($name: String!, $email: String!, $section: String!, $otp: String!, $password: String!) {
        verifyStudentOtpAndRegister(name: $name, email: $email, section: $section, otp: $otp, password: $password) {
          token
          refreshToken
          student { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
        }
      }`,
      { name, email, section, otp, password: hashedPassword }
    ) as { verifyStudentOtpAndRegister: StudentAuthPayload };
    this._store(data.verifyStudentOtpAndRegister);
    return data.verifyStudentOtpAndRegister;
  }

  // ── Registration ───────────────────────────────────────────────────────────

  async register(name: string, email: string, password: string): Promise<StudentAuthPayload> {
    console.group('📝 Student Registration Attempt');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Timestamp:', new Date().toISOString());
    
    const hashedPassword = await sha256(password);

    try {
      const data = await gql(
        `mutation RegisterStudent($name: String!, $email: String!, $password: String!) {
          registerStudent(name: $name, email: $email, password: $password) {
            token
            refreshToken
            student { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
            debug { type timestamp }
          }
        }`,
        { name, email, password: hashedPassword }
      ) as { registerStudent: StudentAuthPayload };
      
      console.log('✅ Registration successful!');
      console.log('🔑 Access token expires in: 1 minute');
      console.log('🔄 Refresh token expires in: 7 days');
      console.groupEnd();
      
      this._store(data.registerStudent);
      return data.registerStudent;
    } catch (error) {
      console.error('❌ Registration failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<StudentAuthPayload> {
    console.group('🔐 Student Login Attempt');
    console.log('Email:', email);
    console.log('Timestamp:', new Date().toISOString());
    
    const hashedPassword = await sha256(password);

    try {
      const data = await gql(
        `mutation LoginStudent($email: String!, $password: String!) {
          loginStudent(email: $email, password: $password) {
            token
            refreshToken
            student { id name email english tamil maths total englishStatus tamilStatus mathsStatus }
            debug { type email maxAttempts remainingAttempts waitMinutes reason timestamp message }
          }
        }`,
        { email, password: hashedPassword }
      ) as { loginStudent: StudentAuthPayload };
      
      console.log('✅ Login successful!');
      console.log('🔑 Access token expires in: 1 minute');
      console.log('🔄 Refresh token expires in: 7 days');
      console.log('⏰ Auto-refresh will start in 45 seconds');
      console.groupEnd();
      
      this._store(data.loginStudent);
      return data.loginStudent;
    } catch (error) {
      console.error('❌ Login failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.stopTokenWatch();
    this._isLoggedIn$.complete();
  }
}
