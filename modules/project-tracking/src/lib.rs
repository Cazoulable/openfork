pub mod handlers;
pub mod models;
pub mod state;

use axum::{Extension, routing::{delete, get, post, put}, Router};
use openfork_core::module::{Module, ModuleContext};
use openfork_core::storage::StorageRequirements;
use openfork_shared::Result;
use std::sync::Arc;

use state::AppState;

pub struct ProjectTrackingModule {
    ctx: Option<ModuleContext>,
}

impl ProjectTrackingModule {
    pub fn new() -> Self {
        Self { ctx: None }
    }
}

impl Module for ProjectTrackingModule {
    fn name(&self) -> &str { "project-tracking" }
    fn version(&self) -> &str { "0.1.0" }

    fn storage_requirements(&self) -> StorageRequirements {
        StorageRequirements { relational: true, cache: false }
    }

    fn init(&mut self, ctx: ModuleContext) -> Result<()> {
        self.ctx = Some(ctx);
        Ok(())
    }

    fn routes(&self) -> Router {
        let ctx = self.ctx.as_ref().expect("module not initialized");
        let jwt = ctx.jwt.clone();
        let state = Arc::new(AppState {
            db: ctx.db.clone().expect("project-tracking requires relational storage"),
            events: ctx.events.clone(),
        });

        Router::new()
            // Workspaces
            .route("/api/workspaces", post(handlers::workspaces::create_workspace))
            .route("/api/workspaces", get(handlers::workspaces::list_workspaces))
            .route("/api/workspaces/{id}", get(handlers::workspaces::get_workspace))
            // Projects
            .route("/api/projects", post(handlers::projects::create_project))
            .route("/api/projects", get(handlers::projects::list_projects))
            .route("/api/projects/{id}", get(handlers::projects::get_project))
            .route("/api/projects/{id}", put(handlers::projects::update_project))
            .route("/api/projects/{id}", delete(handlers::projects::delete_project))
            // Issues
            .route("/api/projects/{project_id}/issues", post(handlers::issues::create_issue))
            .route("/api/projects/{project_id}/issues", get(handlers::issues::list_issues))
            .route("/api/issues/{id}", get(handlers::issues::get_issue))
            .route("/api/issues/{id}", put(handlers::issues::update_issue))
            .route("/api/issues/{id}", delete(handlers::issues::delete_issue))
            // Comments
            .route("/api/issues/{issue_id}/comments", post(handlers::comments::create_comment))
            .route("/api/issues/{issue_id}/comments", get(handlers::comments::list_comments))
            .route("/api/comments/{id}", put(handlers::comments::update_comment))
            .route("/api/comments/{id}", delete(handlers::comments::delete_comment))
            // Labels
            .route("/api/projects/{project_id}/labels", post(handlers::labels::create_label))
            .route("/api/projects/{project_id}/labels", get(handlers::labels::list_labels))
            .route("/api/issues/{issue_id}/labels", put(handlers::labels::set_issue_labels))
            .layer(Extension(jwt))
            .with_state(state)
    }
}
