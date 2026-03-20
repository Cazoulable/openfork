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

pub async fn create_dm_group(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(req): Json<CreateDmGroupRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();

    let mut tx = state.db.pool().begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let group = sqlx::query_as::<_, DirectMessageGroup>(
        "INSERT INTO direct_message_groups (id) VALUES ($1) RETURNING *"
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    // Add current user
    sqlx::query("INSERT INTO direct_message_members (group_id, user_id) VALUES ($1, $2)")
        .bind(id)
        .bind(user.0.sub)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    // Add other users
    for uid in &req.user_ids {
        sqlx::query("INSERT INTO direct_message_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(id)
            .bind(uid)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(group)))
}

pub async fn list_dm_groups(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<Json<Vec<DirectMessageGroup>>, (StatusCode, Json<serde_json::Value>)> {
    let groups = sqlx::query_as::<_, DirectMessageGroup>(
        "SELECT g.* FROM direct_message_groups g \
         JOIN direct_message_members m ON g.id = m.group_id \
         WHERE m.user_id = $1 ORDER BY g.created_at DESC"
    )
    .bind(user.0.sub)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(groups))
}

pub async fn send_dm(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(group_id): Path<Uuid>,
    Json(req): Json<SendDmRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let dm = sqlx::query_as::<_, DirectMessage>(
        "INSERT INTO direct_messages (id, group_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(id)
    .bind(group_id)
    .bind(user.0.sub)
    .bind(&req.body)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("dm.sent", json!({
        "dm_id": id,
        "group_id": group_id,
        "author_id": user.0.sub,
    })).await;

    Ok((StatusCode::CREATED, Json(dm)))
}

pub async fn list_dms(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(group_id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<DirectMessage>>, (StatusCode, Json<serde_json::Value>)> {
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);

    let messages = sqlx::query_as::<_, DirectMessage>(
        "SELECT * FROM direct_messages WHERE group_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3"
    )
    .bind(group_id)
    .bind(offset)
    .bind(limit)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(messages))
}
