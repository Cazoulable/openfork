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

pub async fn add_reaction(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(message_id): Path<Uuid>,
    Json(req): Json<AddReactionRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let reaction = sqlx::query_as::<_, Reaction>(
        "INSERT INTO reactions (id, message_id, user_id, emoji) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING RETURNING *"
    )
    .bind(id)
    .bind(message_id)
    .bind(user.0.sub)
    .bind(&req.emoji)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    match reaction {
        Some(r) => Ok((StatusCode::CREATED, Json(json!(r)))),
        None => Ok((StatusCode::OK, Json(json!({"status": "already exists"})))),
    }
}

pub async fn remove_reaction(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path((message_id, emoji)): Path<(Uuid, String)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query("DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3")
        .bind(message_id)
        .bind(user.0.sub)
        .bind(&emoji)
        .execute(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(StatusCode::NO_CONTENT)
}
