pub mod handlers;
pub mod jwt;
pub mod middleware;
pub mod models;
pub mod password;

pub use jwt::JwtManager;
pub use middleware::AuthUser;

use axum::{routing::post, Router};
use std::sync::Arc;

pub fn auth_routes(state: Arc<handlers::AuthState>) -> Router {
    Router::new()
        .route("/auth/register", post(handlers::register))
        .route("/auth/register-with-workspace", post(handlers::register_with_workspace))
        .route("/auth/login", post(handlers::login))
        .route("/auth/refresh", post(handlers::refresh))
        .with_state(state)
}
