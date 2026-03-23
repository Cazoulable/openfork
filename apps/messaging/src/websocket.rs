use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use openfork_core::events::Event;
use serde::Deserialize;
use std::sync::Arc;
use tracing::info;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Validate JWT before upgrading
    let jwt = state.jwt.as_ref();
    match jwt.validate_token(&query.token) {
        Ok(claims) => {
            ws.on_upgrade(move |socket| handle_socket(socket, state, claims.sub))
        }
        Err(_) => {
            ws.on_upgrade(|mut socket| async move {
                let _ = socket.send(WsMessage::Close(None)).await;
            })
        }
    }
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, user_id: uuid::Uuid) {
    let (mut sender, mut receiver) = socket.split();
    let mut event_rx = state.events.subscribe();

    info!("WebSocket connected: user={user_id}");

    // Set presence
    let presence_key = format!("openfork:presence:{user_id}");
    let _: Result<(), _> = fred::prelude::KeysInterface::set(
        state.cache.client(),
        &presence_key,
        "online",
        Some(fred::prelude::Expiration::EX(60)),
        None,
        false,
    ).await;

    // Forward events to WebSocket
    let fwd_state = state.clone();
    let fwd_user_id = user_id;
    let send_task = tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            if should_forward_event(&event, fwd_user_id, &fwd_state).await {
                if let Ok(json) = serde_json::to_string(&event) {
                    if sender.send(WsMessage::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Handle incoming WebSocket messages (heartbeats, etc.)
    let recv_state = state.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                WsMessage::Ping(data) => {
                    // Heartbeat - refresh presence
                    let _: Result<(), _> = fred::prelude::KeysInterface::set(
                        recv_state.cache.client(),
                        &presence_key,
                        "online",
                        Some(fred::prelude::Expiration::EX(60)),
                        None,
                        false,
                    ).await;
                    let _ = data; // ping handled automatically by axum
                }
                WsMessage::Close(_) => break,
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    info!("WebSocket disconnected: user={user_id}");
    // Clean up presence
    let _: Result<(), _> = fred::prelude::KeysInterface::del(
        state.cache.client(),
        &format!("openfork:presence:{user_id}"),
    ).await;
}

async fn should_forward_event(event: &Event, _user_id: uuid::Uuid, _state: &AppState) -> bool {
    // Forward all messaging events for now
    // In production, check channel membership
    event.app == "messaging"
}

pub async fn get_presence(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(user_id): axum::extract::Path<uuid::Uuid>,
) -> impl IntoResponse {
    let key = format!("openfork:presence:{user_id}");
    let status: Option<String> = fred::prelude::KeysInterface::get(state.cache.client(), &key)
        .await
        .unwrap_or(None);

    let status = status.unwrap_or_else(|| "offline".to_string());
    axum::Json(serde_json::json!({"user_id": user_id, "status": status}))
}
