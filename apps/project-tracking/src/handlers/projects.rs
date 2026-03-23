use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use openfork_core::auth::AuthUser;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::*;
use crate::state::AppState;

pub async fn create_project(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Json(req): Json<CreateProjectRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (id, workspace_id, name, slug, description) VALUES ($1, $2, $3, $4, $5) RETURNING *"
    )
    .bind(id)
    .bind(req.workspace_id)
    .bind(&req.name)
    .bind(&req.slug)
    .bind(&req.description)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("project.created", json!({"project_id": id})).await;
    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn list_projects(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
) -> Result<Json<Vec<Project>>, (StatusCode, Json<serde_json::Value>)> {
    let projects = sqlx::query_as::<_, Project>("SELECT * FROM projects ORDER BY created_at DESC")
        .fetch_all(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(projects))
}

pub async fn get_project(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, (StatusCode, Json<serde_json::Value>)> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = $1")
        .bind(id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "project not found"}))))?;

    Ok(Json(project))
}

pub async fn update_project(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProjectRequest>,
) -> Result<Json<Project>, (StatusCode, Json<serde_json::Value>)> {
    let project = sqlx::query_as::<_, Project>(
        "UPDATE projects SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.description)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "project not found"}))))?;

    state.publish_event("project.updated", json!({"project_id": id})).await;
    Ok(Json(project))
}

pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query("DELETE FROM projects WHERE id = $1")
        .bind(id)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "project not found"}))));
    }

    state.publish_event("project.deleted", json!({"project_id": id})).await;
    Ok(StatusCode::NO_CONTENT)
}
