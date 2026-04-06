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
  faculty: Faculty;
}

// ── Constants ────────────────────────────────────────────────────────────────
const API = environment.apiUrl;
const TOKEN_KEY = 'faculty_token';
const FACULTY_KEY = 'faculty_data';

/**
 * Shared GraphQL helper — sends a POST to /graphql with an optional
 * Bearer token attached.  Throws on GraphQL errors.
 */
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
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
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
    localStorage.setItem(FACULTY_KEY, JSON.stringify(payload.faculty));
    // Mirror faculty + token into IndexedDB (visible in DevTools → Application → IndexedDB)
    this.idb.saveFaculty(payload.faculty, payload.token).catch(console.warn);
    this._isLoggedIn$.next(true);
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
    // Stop the watcher FIRST so it doesn't fire again while we clear storage
    this.stopTokenWatch();

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FACULTY_KEY);
    // Clear IndexedDB faculty store on session expiry
    this.idb.clearFaculty().catch(console.warn);
    this._isLoggedIn$.next(false);

    // Navigate then show alert so the redirect happens before the dialog blocks
    this.router.navigate(['/login'], {
      queryParams: { expired: 'true' }
    }).then(() => {
      alert('⚠️ Session expired. Please log in again.');
      // Restart the watcher for the next login
      this.startTokenWatch();
    });
  }

  // ── Explicit logout ────────────────────────────────────────────────────────

  /** Called by the user clicking "Logout". No session-expired alert shown. */
  logout(): void {
    this.stopTokenWatch();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FACULTY_KEY);
    // Clear IndexedDB faculty store on explicit logout
    this.idb.clearFaculty().catch(console.warn);
    this._isLoggedIn$.next(false);
    this.router.navigate(['/login']).then(() => {
      // Restart watcher so it's ready after next login
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
    // Hash the password with SHA-256 before sending over the network.
    // The backend will bcrypt this hash — plaintext never leaves the browser.
    const hashedPassword = await sha256(password);

    const data = await gql(
      `mutation Verify($name: String!, $email: String!, $otp: String!, $password: String!, $classSection: String!) {
        verifyOtpAndRegister(name: $name, email: $email, otp: $otp, password: $password, classSection: $classSection) {
          token
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
    // Hash the password with SHA-256 before sending over the network.
    // The backend compares this hash against bcrypt(sha256(plaintext)) stored at registration.
    const hashedPassword = await sha256(password);

    const data = await gql(
      `mutation Login($email: String!, $password: String!) {
        loginFaculty(email: $email, password: $password) {
          token
          faculty { id name email createdAt }
        }
      }`,
      { email, password: hashedPassword }
    ) as { loginFaculty: AuthPayload };
    this._store(data.loginFaculty);
    return data.loginFaculty;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.stopTokenWatch();
    this._isLoggedIn$.complete();
  }
}
