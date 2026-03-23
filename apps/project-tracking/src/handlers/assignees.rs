use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use openfork_core::auth::AuthUser;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::SetAssigneesRequest;
use crate::state::AppState;

/// GET /api/issues/:issue_id/assignees — returns list of user_ids assigned to an issue
pub async fn list_issue_assignees(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<Vec<Uuid>>, (StatusCode, Json<serde_json::Value>)> {
    let user_ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM issue_assignees WHERE issue_id = $1 ORDER BY user_id"
    )
    .bind(issue_id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(user_ids))
}

/// PUT /api/issues/:issue_id/assignees — replaces all assignees
pub async fn set_issue_assignees(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(issue_id): Path<Uuid>,
    Json(req): Json<SetAssigneesRequest>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let mut tx = state.db.pool().begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    // Remove existing assignees
    sqlx::query("DELETE FROM issue_assignees WHERE issue_id = $1")
        .bind(issue_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    // Insert new assignees
    for user_id in &req.user_ids {
        sqlx::query("INSERT INTO issue_assignees (issue_id, user_id) VALUES ($1, $2)")
            .bind(issue_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("issue.assignees_updated", json!({"issue_id": issue_id})).await;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/projects/:project_id/issue-assignees — returns all (issue_id, user_id) pairs for a project
/// Used by the frontend to efficiently display assignees in list/board views
pub async fn list_project_issue_assignees(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<IssueAssigneeRow>>, (StatusCode, Json<serde_json::Value>)> {
    let rows = sqlx::query_as::<_, IssueAssigneeRow>(
        "SELECT ia.issue_id, ia.user_id \
         FROM issue_assignees ia \
         JOIN issues i ON ia.issue_id = i.id \
         WHERE i.project_id = $1"
    )
    .bind(project_id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(rows))
}

// Row type for the bulk query
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct IssueAssigneeRow {
    pub issue_id: Uuid,
    pub user_id: Uuid,
}
