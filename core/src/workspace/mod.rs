pub mod handlers;
pub mod models;

use axum::{routing::{get, post, put, delete}, Router};
use std::sync::Arc;
use handlers::WorkspaceState;

pub fn workspace_routes(state: Arc<WorkspaceState>) -> Router {
    Router::new()
        .route("/api/workspaces", post(handlers::create_workspace))
        .route("/api/workspaces", get(handlers::list_my_workspaces))
        .route("/api/workspaces/{id}", get(handlers::get_workspace))
        .route("/api/workspaces/{id}", put(handlers::update_workspace))
        .route("/api/workspaces/{id}/members", get(handlers::list_members))
        .route("/api/workspaces/{id}/members", post(handlers::invite_member))
        .route("/api/workspaces/{id}/members/{user_id}", delete(handlers::remove_member))
        .with_state(state)
}
