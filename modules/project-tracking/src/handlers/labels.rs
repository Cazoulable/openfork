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

pub async fn create_label(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<CreateLabelRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let color = req.color.unwrap_or_else(|| "#6B7280".into());
    let label = sqlx::query_as::<_, Label>(
        "INSERT INTO labels (id, project_id, name, color) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(id)
    .bind(project_id)
    .bind(&req.name)
    .bind(&color)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(label)))
}

pub async fn list_labels(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Label>>, (StatusCode, Json<serde_json::Value>)> {
    let labels = sqlx::query_as::<_, Label>(
        "SELECT * FROM labels WHERE project_id = $1 ORDER BY name"
    )
    .bind(project_id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(labels))
}

pub async fn set_issue_labels(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(issue_id): Path<Uuid>,
    Json(req): Json<SetLabelsRequest>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let mut tx = state.db.pool().begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    sqlx::query("DELETE FROM issue_labels WHERE issue_id = $1")
        .bind(issue_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    for label_id in &req.label_ids {
        sqlx::query("INSERT INTO issue_labels (issue_id, label_id) VALUES ($1, $2)")
            .bind(issue_id)
            .bind(label_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("issue.labels_updated", json!({"issue_id": issue_id})).await;
    Ok(StatusCode::NO_CONTENT)
}
