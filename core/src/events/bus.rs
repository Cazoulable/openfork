use fred::prelude::*;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use std::sync::Arc;
use tracing::{info, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub topic: String,
    pub app: String,
    pub payload: serde_json::Value,
}

#[derive(Clone)]
pub struct EventBus {
    /// Dedicated client for PUBLISH commands (must NOT enter subscribe mode).
    publisher: fred::clients::Client,
    /// Dedicated client for SUBSCRIBE (enters sub-only mode).
    subscriber: fred::clients::Client,
    /// Local broadcast for in-process subscribers (WebSocket manager, etc.)
    local_tx: broadcast::Sender<Event>,
}

impl EventBus {
    pub fn new(publisher: fred::clients::Client, subscriber: fred::clients::Client) -> Self {
        let (local_tx, _) = broadcast::channel(1024);
        Self { publisher, subscriber, local_tx }
    }

    /// Publish an event to Redis and local subscribers.
    pub async fn publish(&self, event: Event) -> anyhow::Result<()> {
        let payload = serde_json::to_string(&event)?;
        let _: () = self.publisher.publish("openfork:events", payload.as_str()).await?;
        let _ = self.local_tx.send(event); // ignore error if no receivers
        Ok(())
    }

    /// Subscribe to the local broadcast channel (for WebSocket manager, etc.)
    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.local_tx.subscribe()
    }

    /// Start listening to Redis pub/sub and forward to local broadcast.
    /// Run this as a background task.
    pub async fn start_redis_listener(self: Arc<Self>) -> anyhow::Result<()> {
        self.subscriber.subscribe("openfork:events").await?;

        let mut message_stream = self.subscriber.message_rx();
        info!("Event bus: listening on Redis channel openfork:events");

        while let Ok(message) = message_stream.recv().await {
            if let Ok(payload) = message.value.convert::<String>() {
                match serde_json::from_str::<Event>(&payload) {
                    Ok(event) => { let _ = self.local_tx.send(event); }
                    Err(e) => error!("Failed to parse event: {e}"),
                }
            }
        }
        Ok(())
    }
}
