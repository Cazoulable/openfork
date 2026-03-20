use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::*;
use crate::state::AppState;

pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let workspace = sqlx::query_as::<_, Workspace>(
        "INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.slug)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(workspace)))
}

pub async fn list_workspaces(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Workspace>>, (StatusCode, Json<serde_json::Value>)> {
    let workspaces = sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces ORDER BY created_at DESC")
        .fetch_all(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(workspaces))
}

pub async fn get_workspace(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Workspace>, (StatusCode, Json<serde_json::Value>)> {
    let workspace = sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces WHERE id = $1")
        .bind(id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "workspace not found"}))))?;

    Ok(Json(workspace))
}
