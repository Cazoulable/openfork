use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Duration, Utc};
use rand::Rng;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::models::*;
use crate::auth::AuthUser;
use crate::storage::RelationalStore;

fn generate_invite_code() -> String {
    let mut rng = rand::rng();
    (0..12)
        .map(|_| {
            let idx = rng.random_range(0..36u32);
            if idx < 10 {
                (b'0' + idx as u8) as char
            } else {
                (b'a' + (idx - 10) as u8) as char
            }
        })
        .collect()
}

pub struct WorkspaceState {
    pub db: RelationalStore,
}

pub async fn get_workspace_by_slug(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(slug): Path<String>,
) -> Result<Json<WorkspaceWithRole>, (StatusCode, Json<serde_json::Value>)> {
    let row = sqlx::query_as::<_, WorkspaceMemberRow>(
        "SELECT w.id, w.name, w.slug, w.created_at, w.updated_at, wm.role \
         FROM workspaces w \
         JOIN workspace_members wm ON w.id = wm.workspace_id \
         WHERE w.slug = $1 AND wm.user_id = $2"
    )
    .bind(&slug)
    .bind(user.0.sub)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    match row {
        Some(r) => Ok(Json(WorkspaceWithRole {
            workspace: Workspace {
                id: r.id,
                name: r.name,
                slug: r.slug,
                created_at: r.created_at,
                updated_at: r.updated_at,
            },
            role: r.role,
        })),
        None => Err((StatusCode::NOT_FOUND, Json(json!({"error": "workspace not found or access denied"})))),
    }
}

pub async fn create_workspace(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Json(req): Json<CreateWorkspaceRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if super::models::RESERVED_SLUGS.contains(&req.slug.to_lowercase().as_str()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": format!("'{}' is a reserved workspace name", req.slug)}))));
    }

    let id = Uuid::new_v4();

    let mut tx = state.db.pool().begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let workspace = sqlx::query_as::<_, Workspace>(
        "INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.slug)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, Json(json!({"error": "workspace slug already taken"})))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
    })?;

    // Auto-add creator as owner
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')"
    )
    .bind(id)
    .bind(user.0.sub)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(workspace)))
}

pub async fn list_my_workspaces(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
) -> Result<Json<Vec<WorkspaceWithRole>>, (StatusCode, Json<serde_json::Value>)> {
    let rows = sqlx::query_as::<_, WorkspaceMemberRow>(
        "SELECT w.id, w.name, w.slug, w.created_at, w.updated_at, wm.role \
         FROM workspaces w \
         JOIN workspace_members wm ON w.id = wm.workspace_id \
         WHERE wm.user_id = $1 \
         ORDER BY w.created_at DESC"
    )
    .bind(user.0.sub)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let workspaces = rows
        .into_iter()
        .map(|r| WorkspaceWithRole {
            workspace: Workspace {
                id: r.id,
                name: r.name,
                slug: r.slug,
                created_at: r.created_at,
                updated_at: r.updated_at,
            },
            role: r.role,
        })
        .collect();

    Ok(Json(workspaces))
}

pub async fn get_workspace(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Workspace>, (StatusCode, Json<serde_json::Value>)> {
    // Verify membership
    verify_membership(state.db.pool(), id, user.0.sub).await?;

    let workspace = sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces WHERE id = $1")
        .bind(id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "workspace not found"}))))?;

    Ok(Json(workspace))
}

pub async fn update_workspace(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateWorkspaceRequest>,
) -> Result<Json<Workspace>, (StatusCode, Json<serde_json::Value>)> {
    // Verify admin/owner
    let role = get_member_role(state.db.pool(), id, user.0.sub).await?;
    if role == WorkspaceRole::Member {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "only admins and owners can update workspaces"}))));
    }

    let workspace = sqlx::query_as::<_, Workspace>(
        "UPDATE workspaces SET name = COALESCE($2, name), updated_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(&req.name)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "workspace not found"}))))?;

    Ok(Json(workspace))
}

pub async fn list_members(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<WorkspaceMemberInfo>>, (StatusCode, Json<serde_json::Value>)> {
    // Verify membership
    verify_membership(state.db.pool(), id, user.0.sub).await?;

    let members = sqlx::query_as::<_, WorkspaceMemberInfo>(
        "SELECT wm.user_id, u.email, u.handle, u.display_name, wm.role, wm.joined_at \
         FROM workspace_members wm \
         JOIN users u ON wm.user_id = u.id \
         WHERE wm.workspace_id = $1 \
         ORDER BY wm.joined_at"
    )
    .bind(id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(members))
}

pub async fn invite_member(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<InviteMemberRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Verify admin/owner
    let role = get_member_role(state.db.pool(), id, user.0.sub).await?;
    if role == WorkspaceRole::Member {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "only admins and owners can invite members"}))));
    }

    // Look up user by email
    let target_user = sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "user not found"}))))?;

    let member_role = req.role.unwrap_or(WorkspaceRole::Member);

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) \
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $3"
    )
    .bind(id)
    .bind(target_user)
    .bind(&member_role)
    .execute(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(json!({"status": "member added"}))))
}

pub async fn remove_member(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path((id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // Verify admin/owner
    let role = get_member_role(state.db.pool(), id, user.0.sub).await?;
    if role == WorkspaceRole::Member {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "only admins and owners can remove members"}))));
    }

    // Cannot remove the owner
    let target_role = get_member_role(state.db.pool(), id, target_user_id).await?;
    if target_role == WorkspaceRole::Owner {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "cannot remove the workspace owner"}))));
    }

    let result = sqlx::query(
        "DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(target_user_id)
    .execute(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "member not found"}))));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ── Invite link handlers ──

pub async fn create_invite(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<CreateInviteRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Verify admin/owner
    let role = get_member_role(state.db.pool(), id, user.0.sub).await?;
    if role == WorkspaceRole::Member {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "only admins and owners can create invite links"})),
        ));
    }

    let invite_id = Uuid::new_v4();
    let code = generate_invite_code();
    let invite_role = req.role.unwrap_or(WorkspaceRole::Member);
    let expires_at = req
        .expires_in_hours
        .map(|h| Utc::now() + Duration::hours(h));

    let invite = sqlx::query_as::<_, WorkspaceInvite>(
        "INSERT INTO workspace_invites (id, workspace_id, code, created_by, role, max_uses, expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(invite_id)
    .bind(id)
    .bind(&code)
    .bind(user.0.sub)
    .bind(&invite_role)
    .bind(req.max_uses)
    .bind(expires_at)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "invite": invite,
            "url": format!("/join/{}", invite.code),
        })),
    ))
}

pub async fn list_invites(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<WorkspaceInvite>>, (StatusCode, Json<serde_json::Value>)> {
    // Verify admin/owner
    let role = get_member_role(state.db.pool(), id, user.0.sub).await?;
    if role == WorkspaceRole::Member {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "only admins and owners can list invite links"})),
        ));
    }

    let invites = sqlx::query_as::<_, WorkspaceInvite>(
        "SELECT * FROM workspace_invites WHERE workspace_id = $1 ORDER BY created_at DESC",
    )
    .bind(id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?;

    Ok(Json(invites))
}

pub async fn delete_invite(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path((id, invite_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // Verify admin/owner
    let role = get_member_role(state.db.pool(), id, user.0.sub).await?;
    if role == WorkspaceRole::Member {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "only admins and owners can delete invite links"})),
        ));
    }

    let result = sqlx::query(
        "DELETE FROM workspace_invites WHERE id = $1 AND workspace_id = $2",
    )
    .bind(invite_id)
    .bind(id)
    .execute(state.db.pool())
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "invite not found"})),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn use_invite(
    State(state): State<Arc<WorkspaceState>>,
    user: AuthUser,
    Path(code): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let mut tx = state
        .db
        .pool()
        .begin()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;

    // Look up invite by code
    let invite = sqlx::query_as::<_, WorkspaceInvite>(
        "SELECT * FROM workspace_invites WHERE code = $1 FOR UPDATE",
    )
    .bind(&code)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "invite not found"})),
        )
    })?;

    // Validate expiration
    if let Some(expires_at) = invite.expires_at {
        if Utc::now() > expires_at {
            return Err((
                StatusCode::GONE,
                Json(json!({"error": "invite has expired"})),
            ));
        }
    }

    // Validate max uses
    if let Some(max_uses) = invite.max_uses {
        if invite.use_count >= max_uses {
            return Err((
                StatusCode::GONE,
                Json(json!({"error": "invite has reached maximum uses"})),
            ));
        }
    }

    // Add user to workspace
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) \
         ON CONFLICT (workspace_id, user_id) DO NOTHING",
    )
    .bind(invite.workspace_id)
    .bind(user.0.sub)
    .bind(&invite.role)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?;

    // Increment use_count
    sqlx::query("UPDATE workspace_invites SET use_count = use_count + 1 WHERE id = $1")
        .bind(invite.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;

    // Fetch the workspace to return
    let workspace = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM workspaces WHERE id = $1",
    )
    .bind(invite.workspace_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?;

    Ok((StatusCode::OK, Json(workspace)))
}

// ── Helpers ──

/// Helper row type for the JOIN query in list_my_workspaces
#[derive(Debug, sqlx::FromRow)]
struct WorkspaceMemberRow {
    id: Uuid,
    name: String,
    slug: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
    role: WorkspaceRole,
}

async fn verify_membership(
    pool: &sqlx::PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)"
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if !exists {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "not a member of this workspace"}))));
    }

    Ok(())
}

async fn get_member_role(
    pool: &sqlx::PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<WorkspaceRole, (StatusCode, Json<serde_json::Value>)> {
    let role = sqlx::query_scalar::<_, WorkspaceRole>(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2"
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    .ok_or_else(|| (StatusCode::FORBIDDEN, Json(json!({"error": "not a member of this workspace"}))))?;

    Ok(role)
}
