use crate::auth::JwtManager;
use crate::events::EventBus;
use crate::storage::{CacheStore, RelationalStore};
use std::sync::Arc;

/// Provided to each module at init time. Contains everything a module needs.
#[derive(Clone)]
pub struct ModuleContext {
    /// Relational storage (if module requested it).
    pub db: Option<RelationalStore>,
    /// Cache storage (if module requested it).
    pub cache: Option<CacheStore>,
    /// JWT manager for auth utilities.
    pub jwt: Arc<JwtManager>,
    /// Event bus for publishing/subscribing to events.
    pub events: Arc<EventBus>,
}
