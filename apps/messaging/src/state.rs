use openfork_core::auth::JwtManager;
use openfork_core::events::{Event, EventBus};
use openfork_core::storage::{CacheStore, RelationalStore};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: RelationalStore,
    pub cache: CacheStore,
    pub jwt: Arc<JwtManager>,
    pub events: Arc<EventBus>,
}

impl AppState {
    pub async fn publish_event(&self, topic: &str, payload: serde_json::Value) {
        let event = Event {
            topic: topic.to_string(),
            app: "messaging".to_string(),
            payload,
        };
        if let Err(e) = self.events.publish(event).await {
            tracing::error!("Failed to publish event: {e}");
        }
    }
}
