use axum::{
    extract::{Path, Query, State},
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

pub async fn create_issue(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<CreateIssueRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let issue = sqlx::query_as::<_, Issue>(
        "INSERT INTO issues (id, project_id, title, description, status, priority, issue_type, estimate, due_date, creator_id) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 'backlog'), COALESCE($6, 'none'), COALESCE($7, 'task'), COALESCE($8, 'none'), $9, $10) RETURNING *"
    )
    .bind(id)
    .bind(project_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.status)
    .bind(&req.priority)
    .bind(&req.issue_type)
    .bind(&req.estimate)
    .bind(&req.due_date)
    .bind(user.0.sub)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("issue.created", json!({"issue_id": id, "project_id": project_id})).await;
    Ok((StatusCode::CREATED, Json(issue)))
}

pub async fn list_issues(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(filters): Query<IssueFilters>,
) -> Result<Json<Vec<Issue>>, (StatusCode, Json<serde_json::Value>)> {
    let offset = filters.offset.unwrap_or(0);
    let limit = filters.limit.unwrap_or(50);

    // Build dynamic query based on filters
    let mut query = String::from("SELECT * FROM issues WHERE project_id = $1");
    let mut param_idx = 2u32;

    if filters.status.is_some() {
        query.push_str(&format!(" AND status = ${param_idx}"));
        param_idx += 1;
    }
    if filters.priority.is_some() {
        query.push_str(&format!(" AND priority = ${param_idx}"));
        param_idx += 1;
    }
    if filters.assignee_id.is_some() {
        query.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM issue_assignees WHERE issue_id = issues.id AND user_id = ${param_idx})"
        ));
        param_idx += 1;
    }
    if filters.issue_type.is_some() {
        query.push_str(&format!(" AND issue_type = ${param_idx}"));
        param_idx += 1;
    }
    if filters.estimate.is_some() {
        query.push_str(&format!(" AND estimate = ${param_idx}"));
        param_idx += 1;
    }

    query.push_str(&format!(" ORDER BY created_at DESC OFFSET ${param_idx}"));
    param_idx += 1;
    query.push_str(&format!(" LIMIT ${param_idx}"));

    let mut q = sqlx::query_as::<_, Issue>(&query).bind(project_id);

    if let Some(ref status) = filters.status {
        q = q.bind(status);
    }
    if let Some(ref priority) = filters.priority {
        q = q.bind(priority);
    }
    if let Some(assignee_id) = filters.assignee_id {
        q = q.bind(assignee_id);
    }
    if let Some(ref issue_type) = filters.issue_type {
        q = q.bind(issue_type);
    }
    if let Some(ref estimate) = filters.estimate {
        q = q.bind(estimate);
    }

    q = q.bind(offset).bind(limit);

    let issues = q.fetch_all(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(issues))
}

pub async fn get_issue(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Issue>, (StatusCode, Json<serde_json::Value>)> {
    let issue = sqlx::query_as::<_, Issue>("SELECT * FROM issues WHERE id = $1")
        .bind(id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "issue not found"}))))?;

    Ok(Json(issue))
}

pub async fn update_issue(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateIssueRequest>,
) -> Result<Json<Issue>, (StatusCode, Json<serde_json::Value>)> {
    // For nullable fields (due_date), we use CASE WHEN
    // so that we can distinguish "not provided" from "set to null".
    let update_due_date = req.due_date.is_some();
    let due_date_value = req.due_date.flatten();

    let issue = sqlx::query_as::<_, Issue>(
        "UPDATE issues SET \
         title = COALESCE($2, title), \
         description = COALESCE($3, description), \
         status = COALESCE($4, status), \
         priority = COALESCE($5, priority), \
         issue_type = COALESCE($6, issue_type), \
         estimate = COALESCE($7, estimate), \
         due_date = CASE WHEN $8 THEN $9 ELSE due_date END, \
         updated_at = now() \
         WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.status)
    .bind(&req.priority)
    .bind(&req.issue_type)
    .bind(&req.estimate)
    .bind(update_due_date)
    .bind(&due_date_value)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "issue not found"}))))?;

    state.publish_event("issue.updated", json!({"issue_id": id})).await;
    Ok(Json(issue))
}

pub async fn delete_issue(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query("DELETE FROM issues WHERE id = $1")
        .bind(id)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "issue not found"}))));
    }

    state.publish_event("issue.deleted", json!({"issue_id": id})).await;
    Ok(StatusCode::NO_CONTENT)
}
