use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use openfork_core::auth::AuthUser;
use serde_json::json;
use std::sync::Arc;

use crate::models::*;
use crate::state::AppState;

pub async fn search_messages(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<Message>>, (StatusCode, Json<serde_json::Value>)> {
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);

    let messages = sqlx::query_as::<_, Message>(
        "SELECT m.*, u.display_name AS author_name \
         FROM messages m LEFT JOIN users u ON m.author_id = u.id \
         WHERE to_tsvector('english', m.body) @@ plainto_tsquery('english', $1) \
         ORDER BY m.created_at DESC OFFSET $2 LIMIT $3"
    )
    .bind(&params.q)
    .bind(offset)
    .bind(limit)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(messages))
}
