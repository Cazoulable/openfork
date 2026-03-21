// ---------------------------------------------------------------------------
// Projects module API — projects, issues, comments, labels
// ---------------------------------------------------------------------------

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Project ---------------------------------------------------------------------

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectPayload {
  workspace_id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
}

// Issue -----------------------------------------------------------------------

export type IssueStatus = "backlog" | "todo" | "in_progress" | "done" | "cancelled";
export type IssuePriority = "none" | "low" | "medium" | "high" | "urgent";

export interface Issue {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_id: string | null;
  creator_id: string;
  issue_number: number;
  created_at: string;
  updated_at: string;
}

export interface CreateIssuePayload {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_id?: string;
}

export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_id?: string | null;
}

export interface ListIssuesFilters {
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_id?: string;
}

// Comment ---------------------------------------------------------------------

export interface Comment {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentPayload {
  body: string;
}

export interface UpdateCommentPayload {
  body: string;
}

// Label -----------------------------------------------------------------------

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface CreateLabelPayload {
  name: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Helper to throw on non-OK responses
// ---------------------------------------------------------------------------

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(
  payload: CreateProjectPayload,
): Promise<Project> {
  const res = await apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Project>(res);
}

export async function listProjects(): Promise<Project[]> {
  const res = await apiFetch("/api/projects");
  return unwrap<Project[]>(res);
}

export async function getProject(projectId: string): Promise<Project> {
  const res = await apiFetch(`/api/projects/${projectId}`);
  return unwrap<Project>(res);
}

export async function updateProject(
  projectId: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  const res = await apiFetch(`/api/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap<Project>(res);
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Delete failed");
  }
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export async function createIssue(
  projectId: string,
  payload: CreateIssuePayload,
): Promise<Issue> {
  const res = await apiFetch(`/api/projects/${projectId}/issues`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Issue>(res);
}

export async function listIssues(
  projectId: string,
  filters?: ListIssuesFilters,
): Promise<Issue[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.assignee_id) params.set("assignee_id", filters.assignee_id);

  const qs = params.toString();
  const path = `/api/projects/${projectId}/issues${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path);
  return unwrap<Issue[]>(res);
}

export async function getIssue(issueId: string): Promise<Issue> {
  const res = await apiFetch(`/api/issues/${issueId}`);
  return unwrap<Issue>(res);
}

export async function updateIssue(
  issueId: string,
  payload: UpdateIssuePayload,
): Promise<Issue> {
  const res = await apiFetch(`/api/issues/${issueId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap<Issue>(res);
}

export async function deleteIssue(issueId: string): Promise<void> {
  const res = await apiFetch(`/api/issues/${issueId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Delete failed");
  }
}

// ---------------------------------------------------------------------------
// Comments (nested under issues)
// ---------------------------------------------------------------------------

export async function createComment(
  issueId: string,
  payload: CreateCommentPayload,
): Promise<Comment> {
  const res = await apiFetch(`/api/issues/${issueId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Comment>(res);
}

export async function listComments(issueId: string): Promise<Comment[]> {
  const res = await apiFetch(`/api/issues/${issueId}/comments`);
  return unwrap<Comment[]>(res);
}

export async function updateComment(
  commentId: string,
  payload: UpdateCommentPayload,
): Promise<Comment> {
  const res = await apiFetch(`/api/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap<Comment>(res);
}

export async function deleteComment(commentId: string): Promise<void> {
  const res = await apiFetch(`/api/comments/${commentId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Delete failed");
  }
}

// ---------------------------------------------------------------------------
// Labels (nested under projects)
// ---------------------------------------------------------------------------

export async function createLabel(
  projectId: string,
  payload: CreateLabelPayload,
): Promise<Label> {
  const res = await apiFetch(`/api/projects/${projectId}/labels`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Label>(res);
}

export async function listLabels(projectId: string): Promise<Label[]> {
  const res = await apiFetch(`/api/projects/${projectId}/labels`);
  return unwrap<Label[]>(res);
}

/**
 * Replace all labels on an issue with the supplied set of label IDs.
 *
 * PUT /api/issues/:issueId/labels
 */
export async function setIssueLabels(
  issueId: string,
  labelIds: string[],
): Promise<void> {
  const res = await apiFetch(`/api/issues/${issueId}/labels`, {
    method: "PUT",
    body: JSON.stringify({ label_ids: labelIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? "Set labels failed",
    );
  }
}
