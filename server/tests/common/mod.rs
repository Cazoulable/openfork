use std::sync::Arc;

use openfork_core::{
    auth::{handlers::AuthState, JwtManager, auth_routes},
    config::{AppConfig, AuthConfig, CacheConfig, DatabaseConfig, ServerConfig, StorageConfig},
    events::EventBus,
    module::ModuleRegistry,
    storage::factory,
};
use openfork_mod_messaging::MessagingModule;
use openfork_mod_project_tracking::ProjectTrackingModule;
use testcontainers::{core::IntoContainerPort, runners::AsyncRunner, GenericImage, ImageExt};
use tokio::net::TcpListener;

pub struct TestServer {
    pub base_url: String,
    pub client: reqwest::Client,
}

impl TestServer {
    pub async fn start() -> Self {
        // Start Postgres container
        let pg_container = GenericImage::new("postgres", "17")
            .with_env_var("POSTGRES_USER", "openfork")
            .with_env_var("POSTGRES_PASSWORD", "openfork")
            .with_env_var("POSTGRES_DB", "openfork")
            .start()
            .await
            .expect("Failed to start Postgres container");

        let pg_port = pg_container
            .get_host_port_ipv4(5432_u16.tcp())
            .await
            .expect("Failed to get Postgres port");

        // Start Redis container
        let redis_container = GenericImage::new("redis", "7-alpine")
            .start()
            .await
            .expect("Failed to start Redis container");

        let redis_port = redis_container
            .get_host_port_ipv4(6379_u16.tcp())
            .await
            .expect("Failed to get Redis port");

        let db_url = format!("postgres://openfork:openfork@127.0.0.1:{pg_port}/openfork");
        let cache_url = format!("redis://127.0.0.1:{redis_port}");

        let config = AppConfig {
            server: ServerConfig { host: "127.0.0.1".into(), port: 0 },
            auth: AuthConfig {
                jwt_secret: "test-secret-for-integration-tests".into(),
                token_expiry_seconds: 900,
                refresh_expiry_seconds: 604800,
            },
            storage: StorageConfig {
                default: DatabaseConfig { url: db_url, max_connections: 5 },
                cache: CacheConfig { url: cache_url },
            },
            modules: Default::default(),
        };

        // Create storage
        let default_db = factory::create_relational_store(&config.storage.default)
            .await
            .expect("Failed to connect to Postgres");
        let default_cache = factory::create_cache_store(&config.storage.cache)
            .await
            .expect("Failed to connect to Redis");

        // Run migrations
        sqlx::migrate!("../migrations")
            .run(default_db.pool())
            .await
            .expect("Failed to run migrations");

        // Auth
        let jwt = Arc::new(JwtManager::new(
            &config.auth.jwt_secret,
            config.auth.token_expiry_seconds,
            config.auth.refresh_expiry_seconds,
        ));

        // Event bus
        let event_bus = Arc::new(EventBus::new(default_cache.client().clone()));

        // Module registry
        let mut registry = ModuleRegistry::new();
        registry.register(Box::new(ProjectTrackingModule::new()));
        registry.register(Box::new(MessagingModule::new()));
        registry
            .init_all(&config, &default_db, &default_cache, jwt.clone(), event_bus.clone())
            .await
            .expect("Failed to init modules");

        // Build router
        let auth_state = Arc::new(AuthState { db: default_db, jwt: jwt.clone() });
        let app = axum::Router::new()
            .merge(auth_routes(auth_state))
            .merge(registry.routes());

        // Bind to random port
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("Failed to bind");
        let addr = listener.local_addr().unwrap();
        let base_url = format!("http://{addr}");

        // Spawn server - keep containers alive by moving them into the task
        tokio::spawn(async move {
            let _pg = pg_container;
            let _redis = redis_container;
            axum::serve(listener, app).await.unwrap();
        });

        TestServer {
            base_url,
            client: reqwest::Client::new(),
        }
    }

    pub async fn register_user(&self, email: &str, name: &str, password: &str) -> serde_json::Value {
        let res = self.client
            .post(format!("{}/auth/register", self.base_url))
            .json(&serde_json::json!({
                "email": email,
                "display_name": name,
                "password": password,
            }))
            .send()
            .await
            .expect("register request failed");

        assert_eq!(res.status(), 201, "register should return 201");
        res.json().await.expect("failed to parse register response")
    }

    pub async fn login(&self, email: &str, password: &str) -> serde_json::Value {
        let res = self.client
            .post(format!("{}/auth/login", self.base_url))
            .json(&serde_json::json!({
                "email": email,
                "password": password,
            }))
            .send()
            .await
            .expect("login request failed");

        assert_eq!(res.status(), 200, "login should return 200");
        res.json().await.expect("failed to parse login response")
    }
}
