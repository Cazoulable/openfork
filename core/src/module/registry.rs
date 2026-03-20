use super::context::ModuleContext;
use super::traits::Module;
use crate::auth::JwtManager;
use crate::config::AppConfig;
use crate::events::EventBus;
use crate::storage::{factory, CacheStore, RelationalStore};
use axum::Router;
use std::sync::Arc;
use tracing::info;

pub struct ModuleRegistry {
    modules: Vec<Box<dyn Module>>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self { modules: Vec::new() }
    }

    pub fn register(&mut self, module: Box<dyn Module>) {
        info!("Registered module: {} v{}", module.name(), module.version());
        self.modules.push(module);
    }

    /// Initialize all modules: create their storage, build their context, call init.
    pub async fn init_all(
        &mut self,
        config: &AppConfig,
        default_db: &RelationalStore,
        default_cache: &CacheStore,
        jwt: Arc<JwtManager>,
        events: Arc<EventBus>,
    ) -> anyhow::Result<()> {
        for module in &mut self.modules {
            let reqs = module.storage_requirements();

            let db = if reqs.relational {
                let db_config = factory::resolve_db_config(module.name(), config);
                // If same URL as default, reuse the pool
                if db_config.url == config.storage.default.url {
                    Some(default_db.clone())
                } else {
                    Some(factory::create_relational_store(db_config).await?)
                }
            } else {
                None
            };

            let cache = if reqs.cache {
                let cache_config = factory::resolve_cache_config(module.name(), config);
                if cache_config.url == config.storage.cache.url {
                    Some(default_cache.clone())
                } else {
                    Some(factory::create_cache_store(cache_config).await?)
                }
            } else {
                None
            };

            let ctx = ModuleContext {
                db,
                cache,
                jwt: jwt.clone(),
                events: events.clone(),
            };

            module.init(ctx)?;
            info!("Initialized module: {}", module.name());
        }
        Ok(())
    }

    /// Merge all module routes into a single router.
    pub fn routes(&self) -> Router {
        let mut router = Router::new();
        for module in &self.modules {
            router = router.merge(module.routes());
        }
        router
    }

    /// Shutdown all modules.
    pub fn shutdown_all(&self) -> anyhow::Result<()> {
        for module in &self.modules {
            module.shutdown()?;
        }
        Ok(())
    }
}
