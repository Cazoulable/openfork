use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::{
    jwt::JwtManager,
    models::*,
    password::{hash_password, verify_password},
};
use crate::storage::RelationalStore;

pub struct AuthState {
    pub db: RelationalStore,
    pub jwt: Arc<JwtManager>,
}

pub async fn register(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Validate
    if req.email.is_empty() || req.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "invalid email or password (min 8 chars)"}))));
    }

    let password_hash = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let user_id = Uuid::new_v4();
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(user_id)
    .bind(&req.email)
    .bind(&req.display_name)
    .bind(&password_hash)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, Json(json!({"error": "email already registered"})))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
    })?;

    let access_token = state.jwt.create_access_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(AuthResponse { access_token, refresh_token, user })))
}

pub async fn login(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid credentials"}))))?;

    let valid = verify_password(&req.password, &user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid credentials"}))));
    }

    let access_token = state.jwt.create_access_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(AuthResponse { access_token, refresh_token, user }))
}

pub async fn refresh(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<RefreshRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let claims = state.jwt.validate_token(&req.refresh_token)
        .map_err(|_| (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid refresh token"}))))?;

    if claims.token_type != super::jwt::TokenType::Refresh {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "not a refresh token"}))));
    }

    let access_token = state.jwt.create_access_token(claims.sub)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(claims.sub)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(TokenResponse { access_token, refresh_token }))
}
