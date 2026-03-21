// ---------------------------------------------------------------------------
// Zustand workspace store — holds the currently selected workspace
// Persisted to localStorage so the selection survives page reloads.
// ---------------------------------------------------------------------------

import { create } from "zustand";
import type { WorkspaceWithRole } from "../api/workspaces";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceState {
  currentWorkspace: WorkspaceWithRole | null;
  setWorkspace: (ws: WorkspaceWithRole) => void;
  clearWorkspace: () => void;
}

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "openfork_current_workspace";

function loadWorkspace(): WorkspaceWithRole | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceWithRole;
  } catch {
    return null;
  }
}

function saveWorkspace(ws: WorkspaceWithRole | null): void {
  if (ws) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspace: loadWorkspace(),

  setWorkspace: (ws) => {
    saveWorkspace(ws);
    set({ currentWorkspace: ws });
  },

  clearWorkspace: () => {
    saveWorkspace(null);
    set({ currentWorkspace: null });
  },
}));
