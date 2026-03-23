use super::context::AppContext;
use super::traits::App;
use crate::auth::JwtManager;
use crate::config::AppConfig;
use crate::events::EventBus;
use crate::storage::{factory, CacheStore, RelationalStore};
use axum::Router;
use std::sync::Arc;
use tracing::info;

pub struct AppRegistry {
    apps: Vec<Box<dyn App>>,
}

impl AppRegistry {
    pub fn new() -> Self {
        Self { apps: Vec::new() }
    }

    pub fn register(&mut self, app: Box<dyn App>) {
        info!("Registered app: {} v{}", app.name(), app.version());
        self.apps.push(app);
    }

    /// Initialize all apps: create their storage, build their context, call init.
    pub async fn init_all(
        &mut self,
        config: &AppConfig,
        default_db: &RelationalStore,
        default_cache: &CacheStore,
        jwt: Arc<JwtManager>,
        events: Arc<EventBus>,
    ) -> anyhow::Result<()> {
        for app in &mut self.apps {
            let reqs = app.storage_requirements();

            let db = if reqs.relational {
                let db_config = factory::resolve_db_config(app.name(), config);
                if db_config.url == config.storage.default.url {
                    Some(default_db.clone())
                } else {
                    Some(factory::create_relational_store(db_config).await?)
                }
            } else {
                None
            };

            let cache = if reqs.cache {
                let cache_config = factory::resolve_cache_config(app.name(), config);
                if cache_config.url == config.storage.cache.url {
                    Some(default_cache.clone())
                } else {
                    Some(factory::create_cache_store(cache_config).await?)
                }
            } else {
                None
            };

            let ctx = AppContext {
                db,
                cache,
                jwt: jwt.clone(),
                events: events.clone(),
            };

            app.init(ctx)?;
            info!("Initialized app: {}", app.name());
        }
        Ok(())
    }

    /// Merge all app routes into a single router.
    pub fn routes(&self) -> Router {
        let mut router = Router::new();
        for app in &self.apps {
            router = router.merge(app.routes());
        }
        router
    }

    /// Shutdown all apps.
    pub fn shutdown_all(&self) -> anyhow::Result<()> {
        for app in &self.apps {
            app.shutdown()?;
        }
        Ok(())
    }
}
