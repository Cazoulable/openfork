use anyhow::Result;
use std::sync::Arc;
use tracing::info;
use tracing_subscriber::EnvFilter;

use openfork_core::{
    auth::{handlers::AuthState, JwtManager, auth_routes},
    config::AppConfig,
    events::EventBus,
    module::ModuleRegistry,
    storage::factory,
};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    // Load config
    let config_path = std::env::var("OPENFORK_CONFIG")
        .unwrap_or_else(|_| "openfork.toml".into());
    let config = AppConfig::load(std::path::Path::new(&config_path))?;
    info!("Config loaded from {config_path}");

    // Create default storage
    let default_db = factory::create_relational_store(&config.storage.default).await?;
    let default_cache = factory::create_cache_store(&config.storage.cache).await?;
    info!("Storage connected");

    // Run core migrations
    sqlx::migrate!("../core/migrations")
        .run(default_db.pool())
        .await?;
    info!("Core migrations applied");

    // Auth
    let jwt = Arc::new(JwtManager::new(
        &config.auth.jwt_secret,
        config.auth.token_expiry_seconds,
        config.auth.refresh_expiry_seconds,
    ));

    // Event bus
    let event_bus = Arc::new(EventBus::new(default_cache.client().clone()));
    let event_bus_listener = event_bus.clone();
    tokio::spawn(async move { event_bus_listener.start_redis_listener().await });

    // Module registry
    let mut registry = ModuleRegistry::new();

    // Register modules here:
    // registry.register(Box::new(ProjectTrackingModule::new()));
    // registry.register(Box::new(MessagingModule::new()));

    registry.init_all(&config, &default_db, &default_cache, jwt.clone(), event_bus.clone()).await?;

    // Build router
    let auth_state = Arc::new(AuthState { db: default_db.clone(), jwt: jwt.clone() });
    let app = axum::Router::new()
        .merge(auth_routes(auth_state))
        .merge(registry.routes());

    let addr = format!("{}:{}", config.server.host, config.server.port);
    info!("OpenFork server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    registry.shutdown_all()?;
    Ok(())
}
