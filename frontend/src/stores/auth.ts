// ---------------------------------------------------------------------------
// Zustand auth store — holds the current user and authentication state.
// Persisted to localStorage so sessions survive page reloads.
// ---------------------------------------------------------------------------

import { create } from "zustand";
import { clearTokens, getAccessToken } from "../api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const USER_KEY = "openfork_user";

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const savedUser = loadUser();
// Only restore if we also have a token — otherwise stale
const hasToken = !!getAccessToken();

export const useAuthStore = create<AuthStore>((set) => ({
  // State ------------------------------------------------------------------
  user: hasToken ? savedUser : null,
  isAuthenticated: hasToken && !!savedUser,

  // Actions ----------------------------------------------------------------
  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    clearTokens();
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
