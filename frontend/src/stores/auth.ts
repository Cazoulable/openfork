// ---------------------------------------------------------------------------
// Zustand auth store — holds the current user and authentication state
// ---------------------------------------------------------------------------

import { create } from "zustand";
import { clearTokens } from "../api/client";

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
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>((set) => ({
  // State ------------------------------------------------------------------
  user: null,
  isAuthenticated: false,

  // Actions ----------------------------------------------------------------
  setUser: (user) => set({ user, isAuthenticated: true }),

  logout: () => {
    clearTokens();
    set({ user: null, isAuthenticated: false });
  },
}));
