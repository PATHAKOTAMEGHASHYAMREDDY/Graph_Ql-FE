import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IndexedDbService } from '../indexed-db.service';

// ── Crypto helper ────────────────────────────────────────────────────────────
/**
 * SHA-256 hash a string using the browser's native Web Crypto API.
 * The result is a lowercase hex string (64 chars).
 * This runs entirely in the browser — no external library needed.
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Faculty {
  id: number;
  name: string;
  email: string;
  classSection?: string;
  createdAt?: string;
}

export interface AuthPayload {
  token: string;
  refreshToken: string;
  faculty: Faculty;
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
const TOKEN_KEY = 'faculty_token';
const REFRESH_TOKEN_KEY = 'faculty_refresh_token';
const FACULTY_KEY = 'faculty_data';

// ── GraphQL helper with debug logging ─────────────────────────────────────────
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

  // Handle rate limiting errors (429 status)
  if (res.status === 429) {
    const errorData = await res.json();
    console.group('🚫 Rate Limit Exceeded');
    console.log('Message:', errorData.message);
    console.log('Retry After:', errorData.retryAfter);
    console.groupEnd();
    throw new Error(errorData.message || 'Too many requests. Please try again later after 5 min.');
  }

  const json = await res.json();
  
  // Log GraphQL responses for debugging
  if (json.errors) {
    const error = json.errors[0];
    console.group('🔴 GraphQL Error');
    console.log('Message:', error.message);
    console.log('Extensions:', error.extensions);
    
    // Log rate limiting info if present
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
  
  // Log successful responses with debug info
  if (json.data?.loginFaculty?.debug) {
    console.group('✅ Login Success Debug Info');
    console.log('Type:', json.data.loginFaculty.debug.type);
    console.log('Remaining Attempts:', json.data.loginFaculty.debug.remainingAttempts);
    console.log('Timestamp:', json.data.loginFaculty.debug.timestamp);
    console.groupEnd();
  }
  
  return json.data;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {

  // ── Reactive state ─────────────────────────────────────────────────────────
  /**
   * BehaviorSubject holding the current login state.
   * Components & guards subscribe to `isLoggedIn$` instead of calling
   * `localStorage` directly — this ensures the whole app reacts instantly
   * whenever the state changes (login, logout, or auto-logout).
   */
  private _isLoggedIn$ = new BehaviorSubject<boolean>(this._hasToken());

  /** Public observable — subscribe to get real-time login-state changes. */
  readonly isLoggedIn$: Observable<boolean> = this._isLoggedIn$.asObservable();

  // ── Token watcher ──────────────────────────────────────────────────────────
  /**
   * `setInterval` handle used for same-tab token monitoring.
   * NOTE: The `storage` event only fires in *other* tabs.  Polling is the
   * only reliable way to detect manual deletion in the **same** tab.
   */
  private _tokenWatcherId: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 1500; // check every 1.5 seconds

  // ── Auto-refresh timer ─────────────────────────────────────────────────────
  private refreshTimer: any = null;
  private readonly REFRESH_BEFORE_EXPIRY_MS = 45 * 1000; // 45 seconds (refresh before 1 min expiry)

  constructor(private router: Router, private idb: IndexedDbService) { }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _hasToken(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  // ── Public token API ───────────────────────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getFaculty(): Faculty | null {
    const raw = localStorage.getItem(FACULTY_KEY);
    return raw ? (JSON.parse(raw) as Faculty) : null;
  }

  /** Synchronous check — use for guards and one-off checks. */
  isLoggedIn(): boolean {
    return this._hasToken();
  }

  private _store(payload: AuthPayload): void {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    localStorage.setItem(FACULTY_KEY, JSON.stringify(payload.faculty));
    // Mirror faculty + token into IndexedDB (visible in DevTools → Application → IndexedDB)
    this.idb.saveFaculty(payload.faculty, payload.token).catch(console.warn);
    this._isLoggedIn$.next(true);
    
    // Start auto-refresh timer
    this.startAutoRefresh();
  }

  // ── Auto-refresh logic ─────────────────────────────────────────────────────

  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    console.log('⏰ Auto-refresh timer started (will refresh in 45 seconds)');
    
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken();
    }, this.REFRESH_BEFORE_EXPIRY_MS);
  }

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      console.warn('⚠️ No refresh token found');
      this.expireSession();
      return;
    }
    
    try {
      console.log('🔄 Refreshing access token...');
      
      const data = await gql(
        `mutation RefreshToken($refreshToken: String!) {
          refreshAccessToken(refreshToken: $refreshToken) {
            token
            refreshToken
            faculty { id name email classSection createdAt }
          }
        }`,
        { refreshToken }
      ) as { refreshAccessToken: AuthPayload };
      
      localStorage.setItem(TOKEN_KEY, data.refreshAccessToken.token);
      
      console.log('✅ Access token refreshed successfully');
      console.log('⏰ Next refresh in 45 seconds');
      
      this.startAutoRefresh();
      
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      this.expireSession();
    }
  }

  // ── Session monitoring ─────────────────────────────────────────────────────

  /**
   * Starts a periodic poll (every 1.5 s) that checks whether `faculty_token`
   * still exists in `localStorage`.  If it has been removed — even manually
   * via DevTools — the user is immediately logged out and redirected to /login
   * with a "Session expired" alert.
   *
   * Call this once from `AppComponent.ngOnInit()` so it runs for the entire
   * application lifetime.
   */
  startTokenWatch(): void {
    // Prevent multiple watchers if called more than once
    if (this._tokenWatcherId !== null) return;

    this._tokenWatcherId = setInterval(() => {
      if (this._isLoggedIn$.value && !this._hasToken()) {
        // Token has been removed externally — trigger session-expired flow
        this._expireSession();
      }
    }, this.POLL_INTERVAL_MS);
  }

  /** Stops the polling watcher (called on explicit logout to avoid double alerts). */
  stopTokenWatch(): void {
    if (this._tokenWatcherId !== null) {
      clearInterval(this._tokenWatcherId);
      this._tokenWatcherId = null;
    }
  }

  /**
   * Internal — handles session-expiry triggered by the watcher or the
   * HTTP interceptor (401 response).  Shows alert, clears storage, navigates.
   */
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
    localStorage.removeItem(FACULTY_KEY);
    this.idb.clearFaculty().catch(console.warn);
    this._isLoggedIn$.next(false);

    this.router.navigate(['/login'], {
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
        `mutation Logout($refreshToken: String!) {
          logout(refreshToken: $refreshToken)
        }`,
        { refreshToken }
      ).catch(console.warn);
    }
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(FACULTY_KEY);
    this.idb.clearFaculty().catch(console.warn);
    this._isLoggedIn$.next(false);
    
    console.log('👋 Logged out successfully');
    
    this.router.navigate(['/login']).then(() => {
      this.startTokenWatch();
    });
  }

  // ── OTP flow ───────────────────────────────────────────────────────────────

  async sendOtp(email: string): Promise<string> {
    const data = await gql(
      `mutation SendOtp($email: String!) { sendOtp(email: $email) }`,
      { email }
    ) as { sendOtp: string };
    return data.sendOtp;
  }

  async verifyOtpAndRegister(
    name: string,
    email: string,
    otp: string,
    password: string,
    classSection: string
  ): Promise<AuthPayload> {
    const hashedPassword = await sha256(password);

    const data = await gql(
      `mutation Verify($name: String!, $email: String!, $otp: String!, $password: String!, $classSection: String!) {
        verifyOtpAndRegister(name: $name, email: $email, otp: $otp, password: $password, classSection: $classSection) {
          token
          refreshToken
          faculty { id name email classSection createdAt }
        }
      }`,
      { name, email, otp, password: hashedPassword, classSection }
    ) as { verifyOtpAndRegister: AuthPayload };
    this._store(data.verifyOtpAndRegister);
    return data.verifyOtpAndRegister;
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthPayload> {
    console.group('🔐 Login Attempt');
    console.log('Email:', email);
    console.log('Timestamp:', new Date().toISOString());
    
    const hashedPassword = await sha256(password);

    try {
      const data = await gql(
        `mutation Login($email: String!, $password: String!) {
          loginFaculty(email: $email, password: $password) {
            token
            refreshToken
            faculty { id name email createdAt }
            debug { type email maxAttempts remainingAttempts waitMinutes reason timestamp message }
          }
        }`,
        { email, password: hashedPassword }
      ) as { loginFaculty: AuthPayload };
      
      console.log('✅ Login successful!');
      console.log('🔑 Access token expires in: 1 minute');
      console.log('🔄 Refresh token expires in: 7 days');
      console.log('⏰ Auto-refresh will start in 45 seconds');
      console.groupEnd();
      
      this._store(data.loginFaculty);
      return data.loginFaculty;
    } catch (error) {
      console.error('❌ Login failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.stopTokenWatch();
    this._isLoggedIn$.complete();
  }
}
