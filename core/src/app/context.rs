use crate::auth::JwtManager;
use crate::events::EventBus;
use crate::storage::{CacheStore, RelationalStore};
use std::sync::Arc;

/// Provided to each app at init time. Contains everything an app needs.
#[derive(Clone)]
pub struct AppContext {
    /// Relational storage (if app requested it).
    pub db: Option<RelationalStore>,
    /// Cache storage (if app requested it).
    pub cache: Option<CacheStore>,
    /// JWT manager for auth utilities.
    pub jwt: Arc<JwtManager>,
    /// Event bus for publishing/subscribing to events.
    pub events: Arc<EventBus>,
}
