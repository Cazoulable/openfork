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

pub async fn create_channel(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(req): Json<CreateChannelRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let is_private = req.is_private.unwrap_or(false);

    let mut tx = state.db.pool().begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let channel = sqlx::query_as::<_, Channel>(
        "INSERT INTO channels (id, name, slug, description, is_private, creator_id, workspace_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.slug)
    .bind(&req.description)
    .bind(is_private)
    .bind(user.0.sub)
    .bind(req.workspace_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, Json(json!({"error": "a channel with this name already exists in this workspace"})))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
    })?;

    // Auto-join creator
    sqlx::query("INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)")
        .bind(id)
        .bind(user.0.sub)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("channel.created", json!({"channel_id": id})).await;
    Ok((StatusCode::CREATED, Json(channel)))
}

pub async fn list_channels(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Query(params): Query<ListChannelsParams>,
) -> Result<Json<Vec<Channel>>, (StatusCode, Json<serde_json::Value>)> {
    let channels = if let Some(workspace_id) = params.workspace_id {
        sqlx::query_as::<_, Channel>(
            "SELECT * FROM channels WHERE is_private = false AND workspace_id = $1 ORDER BY created_at DESC"
        )
        .bind(workspace_id)
        .fetch_all(state.db.pool())
        .await
    } else {
        sqlx::query_as::<_, Channel>(
            "SELECT * FROM channels WHERE is_private = false ORDER BY created_at DESC"
        )
        .fetch_all(state.db.pool())
        .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(channels))
}

pub async fn get_channel(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Channel>, (StatusCode, Json<serde_json::Value>)> {
    let channel = sqlx::query_as::<_, Channel>("SELECT * FROM channels WHERE id = $1")
        .bind(id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "channel not found"}))))?;

    Ok(Json(channel))
}

pub async fn update_channel(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateChannelRequest>,
) -> Result<Json<Channel>, (StatusCode, Json<serde_json::Value>)> {
    let channel = sqlx::query_as::<_, Channel>(
        "UPDATE channels SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = now() WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.description)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "channel not found"}))))?;

    Ok(Json(channel))
}

pub async fn delete_channel(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query("DELETE FROM channels WHERE id = $1")
        .bind(id)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "channel not found"}))));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn join_channel(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query("INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(id)
        .bind(user.0.sub)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn leave_channel(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query("DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.0.sub)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(StatusCode::NO_CONTENT)
}
