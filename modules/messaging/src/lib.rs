pub mod handlers;
pub mod models;
pub mod state;
pub mod websocket;

use axum::{Extension, routing::{delete, get, post, put}, Router};
use openfork_core::module::{Module, ModuleContext};
use openfork_core::storage::StorageRequirements;
use openfork_shared::Result;
use std::sync::Arc;

use state::AppState;

pub struct MessagingModule {
    ctx: Option<ModuleContext>,
}

impl MessagingModule {
    pub fn new() -> Self {
        Self { ctx: None }
    }
}

impl Module for MessagingModule {
    fn name(&self) -> &str { "messaging" }
    fn version(&self) -> &str { "0.1.0" }

    fn storage_requirements(&self) -> StorageRequirements {
        StorageRequirements { relational: true, cache: true }
    }

    fn init(&mut self, ctx: ModuleContext) -> Result<()> {
        self.ctx = Some(ctx);
        Ok(())
    }

    fn routes(&self) -> Router {
        let ctx = self.ctx.as_ref().expect("module not initialized");
        let jwt = ctx.jwt.clone();
        let state = Arc::new(AppState {
            db: ctx.db.clone().expect("messaging requires relational storage"),
            cache: ctx.cache.clone().expect("messaging requires cache storage"),
            jwt: ctx.jwt.clone(),
            events: ctx.events.clone(),
        });

        Router::new()
            // Channels
            .route("/api/channels", post(handlers::channels::create_channel))
            .route("/api/channels", get(handlers::channels::list_channels))
            .route("/api/channels/{id}", get(handlers::channels::get_channel))
            .route("/api/channels/{id}", put(handlers::channels::update_channel))
            .route("/api/channels/{id}", delete(handlers::channels::delete_channel))
            .route("/api/channels/{id}/join", post(handlers::channels::join_channel))
            .route("/api/channels/{id}/leave", post(handlers::channels::leave_channel))
            // Messages
            .route("/api/channels/{channel_id}/messages", post(handlers::messages::send_message))
            .route("/api/channels/{channel_id}/messages", get(handlers::messages::list_messages))
            .route("/api/messages/{id}/thread", get(handlers::messages::get_thread))
            .route("/api/messages/{id}", put(handlers::messages::update_message))
            .route("/api/messages/{id}", delete(handlers::messages::delete_message))
            // Reactions
            .route("/api/messages/{id}/reactions", post(handlers::reactions::add_reaction))
            .route("/api/messages/{id}/reactions/{emoji}", delete(handlers::reactions::remove_reaction))
            // DMs
            .route("/api/dm", post(handlers::dm::create_dm_group))
            .route("/api/dm", get(handlers::dm::list_dm_groups))
            .route("/api/dm/{group_id}/messages", post(handlers::dm::send_dm))
            .route("/api/dm/{group_id}/messages", get(handlers::dm::list_dms))
            // Search
            .route("/api/messages/search", get(handlers::search::search_messages))
            // WebSocket
            .route("/api/ws", get(websocket::ws_handler))
            // Presence
            .route("/api/presence/{user_id}", get(websocket::get_presence))
            .layer(Extension(jwt))
            .with_state(state)
    }
}
