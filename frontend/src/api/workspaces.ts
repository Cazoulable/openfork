// ---------------------------------------------------------------------------
// Workspaces module API — workspace CRUD, members, invitations
// ---------------------------------------------------------------------------

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}

export interface WorkspaceMemberInfo {
  user_id: string;
  email: string;
  handle: string;
  display_name: string;
  role: WorkspaceRole;
  joined_at: string;
}

export interface CreateWorkspacePayload {
  name: string;
  slug: string;
}

export interface UpdateWorkspacePayload {
  name?: string;
}

export interface InviteMemberPayload {
  email: string;
  role?: WorkspaceRole;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  code: string;
  created_by: string;
  role: WorkspaceRole;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface CreateInvitePayload {
  role?: 'admin' | 'member';
  max_uses?: number;
  expires_in_hours?: number;
}

// ---------------------------------------------------------------------------
// Helper to throw on non-OK responses
// ---------------------------------------------------------------------------

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}

async function unwrapVoid(res: Response): Promise<void> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? `Request failed (${res.status})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export async function createWorkspace(
  payload: CreateWorkspacePayload,
): Promise<WorkspaceWithRole> {
  const res = await apiFetch("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<WorkspaceWithRole>(res);
}

export async function listMyWorkspaces(): Promise<WorkspaceWithRole[]> {
  const res = await apiFetch("/api/workspaces");
  return unwrap<WorkspaceWithRole[]>(res);
}

export async function getWorkspace(
  workspaceId: string,
): Promise<WorkspaceWithRole> {
  const res = await apiFetch(`/api/workspaces/${workspaceId}`);
  return unwrap<WorkspaceWithRole>(res);
}

export async function getWorkspaceBySlug(
  slug: string,
): Promise<WorkspaceWithRole> {
  const res = await apiFetch(`/api/workspaces/by-slug/${encodeURIComponent(slug)}`);
  return unwrap<WorkspaceWithRole>(res);
}

export async function updateWorkspace(
  workspaceId: string,
  payload: UpdateWorkspacePayload,
): Promise<Workspace> {
  const res = await apiFetch(`/api/workspaces/${workspaceId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap<Workspace>(res);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(
  workspaceId: string,
): Promise<WorkspaceMemberInfo[]> {
  const res = await apiFetch(`/api/workspaces/${workspaceId}/members`);
  return unwrap<WorkspaceMemberInfo[]>(res);
}

export async function inviteMember(
  workspaceId: string,
  payload: InviteMemberPayload,
): Promise<void> {
  const res = await apiFetch(`/api/workspaces/${workspaceId}/members`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrapVoid(res);
}

export async function removeMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/workspaces/${workspaceId}/members/${userId}`,
    { method: "DELETE" },
  );
  return unwrapVoid(res);
}

// ---------------------------------------------------------------------------
// Invite Links
// ---------------------------------------------------------------------------

export async function createInvite(
  workspaceId: string,
  payload: CreateInvitePayload,
): Promise<WorkspaceInvite> {
  const res = await apiFetch(`/api/workspaces/${workspaceId}/invites`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<WorkspaceInvite>(res);
}

export async function listInvites(
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  const res = await apiFetch(`/api/workspaces/${workspaceId}/invites`);
  return unwrap<WorkspaceInvite[]>(res);
}

export async function deleteInvite(
  workspaceId: string,
  inviteId: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/workspaces/${workspaceId}/invites/${inviteId}`,
    { method: "DELETE" },
  );
  return unwrapVoid(res);
}

export async function joinViaInvite(
  code: string,
): Promise<WorkspaceWithRole> {
  const res = await apiFetch(`/api/invites/${code}/join`, {
    method: "POST",
  });
  return unwrap<WorkspaceWithRole>(res);
}
