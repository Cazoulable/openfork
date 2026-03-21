# Workspace Promotion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote workspaces from a project-tracking concept to a core platform concept with membership, roles, and workspace-scoped modules.

**Architecture:** Workspaces become a core entity with a `workspace_members` table (roles: owner, admin, member). After login, users select/create a workspace. All module routes are scoped to the current workspace. The sidebar shows the workspace name.

**Tech Stack:** Rust/Axum backend, React/TypeScript frontend, PostgreSQL.

---

## Phase 1: Backend — Core Workspace Model

### Task 1.1: Migration — workspace_members table + add workspace_id to channels

**Files:**
- Create: `migrations/0004_workspace_members.sql`
- Create: `migrations/0005_add_workspace_id_to_channels.sql`

Migration 0004:
```sql
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
```

Migration 0005:
```sql
ALTER TABLE channels ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX idx_channels_workspace ON channels(workspace_id);
```

### Task 1.2: Core workspace handlers

**Files:**
- Create: `core/src/workspace/mod.rs`
- Create: `core/src/workspace/models.rs`
- Create: `core/src/workspace/handlers.rs`
- Modify: `core/src/lib.rs`

Models: Workspace, WorkspaceMember, WorkspaceRole, CreateWorkspaceRequest, WorkspaceResponse (workspace + user's role).

Handlers:
- `POST /api/workspaces` — create workspace, auto-add creator as owner
- `GET /api/workspaces` — list workspaces for current user (via workspace_members)
- `GET /api/workspaces/:id` — get workspace (must be member)
- `PUT /api/workspaces/:id` — update workspace (admin/owner only)
- `GET /api/workspaces/:id/members` — list members
- `POST /api/workspaces/:id/members` — invite member (admin/owner)
- `DELETE /api/workspaces/:id/members/:user_id` — remove member (admin/owner)

Core exports `workspace_routes()` function like `auth_routes()`.

### Task 1.3: Wire workspace routes in server

**Files:**
- Modify: `server/src/main.rs`

Add workspace routes to the server router.

### Task 1.4: Remove workspace routes from project-tracking

**Files:**
- Modify: `modules/project-tracking/src/lib.rs` — remove workspace routes
- Delete: `modules/project-tracking/src/handlers/workspaces.rs`
- Modify: `modules/project-tracking/src/handlers/mod.rs`

### Task 1.5: Add workspace_id to channel creation in messaging

**Files:**
- Modify: `modules/messaging/src/models.rs` — add workspace_id to CreateChannelRequest and Channel
- Modify: `modules/messaging/src/handlers/channels.rs` — require workspace_id on create, filter list by workspace_id query param

---

## Phase 2: Frontend — Workspace Flow

### Task 2.1: Workspace API client + store

**Files:**
- Create: `frontend/src/api/workspaces.ts`
- Create: `frontend/src/stores/workspace.ts`

API: createWorkspace, listMyWorkspaces, getWorkspace, updateWorkspace, listMembers, inviteMember, removeMember.

Zustand store: currentWorkspace, setWorkspace, clearWorkspace.

### Task 2.2: Workspace selection page

**Files:**
- Create: `frontend/src/components/workspace/WorkspaceSelectPage.tsx`
- Create: `frontend/src/components/workspace/CreateWorkspaceModal.tsx`

After login, if user has workspaces → show list to pick. If none → prompt to create. Store selection in zustand + localStorage.

### Task 2.3: Update routing + app shell

**Files:**
- Modify: `frontend/src/App.tsx` — add workspace selection route, require workspace context
- Modify: `frontend/src/components/layout/Sidebar.tsx` — show workspace name at top
- Modify: `frontend/src/components/layout/AppShell.tsx` — redirect to workspace select if none chosen
- Create: `frontend/src/components/workspace/WorkspaceSettingsPage.tsx`

### Task 2.4: Update modules to use workspace context

**Files:**
- Modify: `frontend/src/components/projects/ProjectsPage.tsx` — remove workspace selector, use global workspace
- Modify: `frontend/src/components/messaging/ChannelsPage.tsx` — pass workspace_id to channel creation
- Modify: `frontend/src/api/projects.ts` — remove workspace CRUD (moved to workspaces.ts)
- Modify: `frontend/src/api/messaging.ts` — add workspace_id to channel operations

---

## Execution Order

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 | 1.1–1.5 | Backend: core workspaces with members/roles, scoped channels |
| 2 | 2.1–2.4 | Frontend: workspace selection, scoped UI, settings page |
