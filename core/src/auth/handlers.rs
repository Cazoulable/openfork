use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::{
    jwt::JwtManager,
    models::*,
    password::{hash_password, verify_password},
};
use crate::storage::RelationalStore;

pub struct AuthState {
    pub db: RelationalStore,
    pub jwt: Arc<JwtManager>,
}

pub async fn register(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Validate
    if req.email.is_empty() || req.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "invalid email or password (min 8 chars)"}))));
    }

    let password_hash = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let user_id = Uuid::new_v4();
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, handle, display_name, first_name, middle_name, last_name, password_hash) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *"
    )
    .bind(user_id)
    .bind(&req.email)
    .bind(&req.handle)
    .bind(&req.display_name)
    .bind(&req.first_name)
    .bind(&req.middle_name)
    .bind(&req.last_name)
    .bind(&password_hash)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, Json(json!({"error": "email or handle already registered"})))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
    })?;

    let access_token = state.jwt.create_access_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(AuthResponse { access_token, refresh_token, user })))
}

pub async fn register_with_workspace(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<RegisterWithWorkspaceRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Validate inputs
    if req.email.is_empty() || req.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "invalid email or password (min 8 chars)"}))));
    }
    if req.workspace_name.is_empty() || req.workspace_slug.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "workspace name and slug are required"}))));
    }

    // Check reserved slugs
    if crate::workspace::models::RESERVED_SLUGS.contains(&req.workspace_slug.to_lowercase().as_str()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": format!("'{}' is a reserved workspace name", req.workspace_slug)}))));
    }

    let password_hash = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let user_id = Uuid::new_v4();
    let workspace_id = Uuid::new_v4();

    let mut tx = state.db.pool().begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    // Create user
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, handle, display_name, first_name, middle_name, last_name, password_hash) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *"
    )
    .bind(user_id)
    .bind(&req.email)
    .bind(&req.handle)
    .bind(&req.display_name)
    .bind(&req.first_name)
    .bind(&req.middle_name)
    .bind(&req.last_name)
    .bind(&password_hash)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, Json(json!({"error": "email already registered"})))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
    })?;

    // Create workspace
    let workspace = sqlx::query_as::<_, crate::workspace::models::Workspace>(
        "INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(workspace_id)
    .bind(&req.workspace_name)
    .bind(&req.workspace_slug)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, Json(json!({"error": "workspace slug already taken"})))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
    })?;

    // Add user as owner
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')"
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let access_token = state.jwt.create_access_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let ws_with_role = crate::workspace::models::WorkspaceWithRole {
        workspace,
        role: crate::workspace::models::WorkspaceRole::Owner,
    };

    let user_json = serde_json::to_value(&user)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let ws_json = serde_json::to_value(&ws_with_role)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(json!({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user_json,
        "workspace": ws_json,
    }))))
}

pub async fn login(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid credentials"}))))?;

    let valid = verify_password(&req.password, &user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid credentials"}))));
    }

    let access_token = state.jwt.create_access_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(AuthResponse { access_token, refresh_token, user }))
}

pub async fn refresh(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<RefreshRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let claims = state.jwt.validate_token(&req.refresh_token)
        .map_err(|_| (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid refresh token"}))))?;

    if claims.token_type != super::jwt::TokenType::Refresh {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "not a refresh token"}))));
    }

    let access_token = state.jwt.create_access_token(claims.sub)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(claims.sub)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(TokenResponse { access_token, refresh_token }))
}
