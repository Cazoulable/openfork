// ---------------------------------------------------------------------------
// useAuth — convenience hook that wires API calls, token management, and
// the Zustand auth store together.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { setTokens, clearTokens } from "../api/client";
import * as authApi from "../api/auth";
import { useAuthStore } from "../stores/auth";
import { useWorkspaceStore } from "../stores/workspace";
import type { AuthUser } from "../stores/auth";

export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    handle: string,
    displayName: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const storeLogout = useAuthStore((s) => s.logout);
  const clearWorkspace = useWorkspaceStore((s) => s.clearWorkspace);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await authApi.login(email, password);
        setTokens(res.access_token, res.refresh_token);
        setUser(res.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {
        setIsLoading(false);
      }
    },
    [setUser],
  );

  const register = useCallback(
    async (email: string, handle: string, displayName: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await authApi.register(email, handle, displayName, password);
        setTokens(res.access_token, res.refresh_token);
        setUser(res.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed");
      } finally {
        setIsLoading(false);
      }
    },
    [setUser],
  );

  const logout = useCallback(() => {
    clearTokens();
    storeLogout();
    clearWorkspace();
    // No navigation — the current route's guard will show the login form
  }, [storeLogout, clearWorkspace]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}
