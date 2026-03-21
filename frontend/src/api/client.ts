// ---------------------------------------------------------------------------
// Base API fetch wrapper with JWT management and automatic token refresh.
// Tokens are held in module-scoped variables (never in localStorage) so they
// survive across calls but are wiped on page reload for safety.
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Persist a fresh token pair in memory. */
export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

/** Return the current access token (or null). */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Return the current refresh token (or null). */
export function getRefreshToken(): string | null {
  return refreshToken;
}

/** Wipe both tokens from memory. */
export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const API_BASE = "";

/** True while a refresh request is in-flight so concurrent 401s don't race. */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempt to obtain a new access token using the stored refresh token.
 * Returns `true` on success, `false` on failure (tokens cleared, redirect).
 */
async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) {
    clearTokens();
    window.location.href = "/login";
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      window.location.href = "/login";
      return false;
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    window.location.href = "/login";
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public fetch wrapper
// ---------------------------------------------------------------------------

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Skip adding the Authorization header (e.g. for public endpoints). */
  noAuth?: boolean;
}

/**
 * Wrapper around `fetch` that:
 * 1. Prefixes `path` with the API base URL.
 * 2. Attaches the `Authorization: Bearer …` header when a token is available.
 * 3. On a 401, transparently refreshes the access token and retries once.
 * 4. If the refresh itself fails, clears tokens and redirects to /login.
 *
 * Returns the raw `Response` so callers can parse JSON, stream, etc.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { headers: extraHeaders, noAuth, ...rest } = options;

  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { ...extraHeaders };
    if (!noAuth && accessToken) {
      h["Authorization"] = `Bearer ${accessToken}`;
    }
    // Default to JSON content-type when a body is present and caller didn't
    // specify one explicitly.
    if (rest.body && !h["Content-Type"]) {
      h["Content-Type"] = "application/json";
    }
    return h;
  };

  let res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: buildHeaders(),
  });

  // If 401 and we have a refresh token, try a single refresh-then-retry.
  if (res.status === 401 && refreshToken && !noAuth) {
    // Deduplicate concurrent refresh attempts.
    if (!refreshInFlight) {
      refreshInFlight = tryRefresh().finally(() => {
        refreshInFlight = null;
      });
    }

    const ok = await refreshInFlight;
    if (ok) {
      // Retry the original request with the new access token.
      res = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: buildHeaders(),
      });
    }
    // If refresh failed, tryRefresh already redirected.
  }

  return res;
}
