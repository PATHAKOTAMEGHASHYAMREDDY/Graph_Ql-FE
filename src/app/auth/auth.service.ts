import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

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

const API = environment.apiUrl;
const TOKEN_KEY = 'faculty_token';
const FACULTY_KEY = 'faculty_data';

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
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private router: Router) {}

  // ── Token management ────────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getFaculty(): Faculty | null {
    const raw = localStorage.getItem(FACULTY_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private store(payload: AuthPayload) {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(FACULTY_KEY, JSON.stringify(payload.faculty));
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FACULTY_KEY);
    this.router.navigate(['/login']);
  }

  // ── OTP flow ─────────────────────────────────────────────────────────────
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
    const data = await gql(
      `mutation Verify($name: String!, $email: String!, $otp: String!, $password: String!, $classSection: String!) {
        verifyOtpAndRegister(name: $name, email: $email, otp: $otp, password: $password, classSection: $classSection) {
          token
          faculty { id name email classSection createdAt }
        }
      }`,
      { name, email, otp, password, classSection }
    ) as { verifyOtpAndRegister: AuthPayload };
    this.store(data.verifyOtpAndRegister);
    return data.verifyOtpAndRegister;
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<AuthPayload> {
    const data = await gql(
      `mutation Login($email: String!, $password: String!) {
        loginFaculty(email: $email, password: $password) {
          token
          faculty { id name email createdAt }
        }
      }`,
      { email, password }
    ) as { loginFaculty: AuthPayload };
    this.store(data.loginFaculty);
    return data.loginFaculty;
  }
}
