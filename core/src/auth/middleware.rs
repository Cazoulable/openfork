use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
    response::{IntoResponse, Json},
};
use serde_json::json;
use std::sync::Arc;

use super::jwt::{Claims, JwtManager, TokenType};

/// Extractor that validates the JWT and provides the authenticated user's claims.
/// Requires `Arc<JwtManager>` to be present as an Axum Extension.
#[derive(Debug, Clone)]
pub struct AuthUser(pub Claims);

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let jwt_manager = parts
            .extensions
            .get::<Arc<JwtManager>>()
            .cloned()
            .ok_or(AuthError::MissingToken)?;

        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AuthError::MissingToken)?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or(AuthError::InvalidToken)?;

        let claims = jwt_manager
            .validate_token(token)
            .map_err(|_| AuthError::InvalidToken)?;

        if claims.token_type != TokenType::Access {
            return Err(AuthError::InvalidToken);
        }

        Ok(AuthUser(claims))
    }
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> axum::response::Response {
        let (status, msg) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "missing authorization header"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "invalid token"),
        };
        (status, Json(json!({ "error": msg }))).into_response()
    }
}
