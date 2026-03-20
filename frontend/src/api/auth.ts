// ---------------------------------------------------------------------------
// Auth API — register, login, refresh
// ---------------------------------------------------------------------------

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * Register a new user account.
 *
 * POST /auth/register
 */
export async function register(
  email: string,
  displayName: string,
  password: string,
): Promise<AuthResponse> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    noAuth: true,
    body: JSON.stringify({ email, display_name: displayName, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Registration failed");
  }

  return res.json() as Promise<AuthResponse>;
}

/**
 * Log in with email + password.
 *
 * POST /auth/login
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    noAuth: true,
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Login failed");
  }

  return res.json() as Promise<AuthResponse>;
}

/**
 * Obtain a new access token using a refresh token.
 *
 * POST /auth/refresh
 */
export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const res = await apiFetch("/auth/refresh", {
    method: "POST",
    noAuth: true,
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Token refresh failed");
  }

  return res.json() as Promise<AuthTokens>;
}
