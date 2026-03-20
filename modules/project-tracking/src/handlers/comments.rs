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

pub async fn create_comment(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(issue_id): Path<Uuid>,
    Json(req): Json<CreateCommentRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let comment = sqlx::query_as::<_, Comment>(
        "INSERT INTO comments (id, issue_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(id)
    .bind(issue_id)
    .bind(user.0.sub)
    .bind(&req.body)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("comment.created", json!({"comment_id": id, "issue_id": issue_id})).await;
    Ok((StatusCode::CREATED, Json(comment)))
}

pub async fn list_comments(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<Vec<Comment>>, (StatusCode, Json<serde_json::Value>)> {
    let comments = sqlx::query_as::<_, Comment>(
        "SELECT * FROM comments WHERE issue_id = $1 ORDER BY created_at ASC"
    )
    .bind(issue_id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(comments))
}

pub async fn update_comment(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCommentRequest>,
) -> Result<Json<Comment>, (StatusCode, Json<serde_json::Value>)> {
    let comment = sqlx::query_as::<_, Comment>(
        "UPDATE comments SET body = $2, updated_at = now() WHERE id = $1 AND author_id = $3 RETURNING *"
    )
    .bind(id)
    .bind(&req.body)
    .bind(user.0.sub)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "comment not found or not owned by you"}))))?;

    Ok(Json(comment))
}

pub async fn delete_comment(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query("DELETE FROM comments WHERE id = $1 AND author_id = $2")
        .bind(id)
        .bind(user.0.sub)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "comment not found or not owned by you"}))));
    }

    Ok(StatusCode::NO_CONTENT)
}
