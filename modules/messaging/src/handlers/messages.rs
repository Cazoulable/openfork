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

pub async fn send_message(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(channel_id): Path<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let message = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (id, channel_id, author_id, thread_id, body) VALUES ($1, $2, $3, $4, $5) RETURNING *"
    )
    .bind(id)
    .bind(channel_id)
    .bind(user.0.sub)
    .bind(req.thread_id)
    .bind(&req.body)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("message.sent", json!({
        "message_id": id,
        "channel_id": channel_id,
        "author_id": user.0.sub,
        "body": &req.body,
    })).await;

    Ok((StatusCode::CREATED, Json(message)))
}

pub async fn list_messages(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<Message>>, (StatusCode, Json<serde_json::Value>)> {
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);

    let messages = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE channel_id = $1 AND thread_id IS NULL ORDER BY created_at ASC OFFSET $2 LIMIT $3"
    )
    .bind(channel_id)
    .bind(offset)
    .bind(limit)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(messages))
}

pub async fn get_thread(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Message>>, (StatusCode, Json<serde_json::Value>)> {
    let messages = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE id = $1 OR thread_id = $1 ORDER BY created_at ASC"
    )
    .bind(id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(messages))
}

pub async fn update_message(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateMessageRequest>,
) -> Result<Json<Message>, (StatusCode, Json<serde_json::Value>)> {
    let message = sqlx::query_as::<_, Message>(
        "UPDATE messages SET body = $2, updated_at = now() WHERE id = $1 AND author_id = $3 RETURNING *"
    )
    .bind(id)
    .bind(&req.body)
    .bind(user.0.sub)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "message not found or not owned by you"}))))?;

    Ok(Json(message))
}

pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query("DELETE FROM messages WHERE id = $1 AND author_id = $2")
        .bind(id)
        .bind(user.0.sub)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "message not found or not owned by you"}))));
    }

    Ok(StatusCode::NO_CONTENT)
}
