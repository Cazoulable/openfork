use crate::config::{AppConfig, CacheConfig, DatabaseConfig};
use super::{CacheStore, RelationalStore};
use sqlx::postgres::PgPoolOptions;
use fred::prelude::*;
use anyhow::Result;

/// Create a RelationalStore from a DatabaseConfig.
pub async fn create_relational_store(config: &DatabaseConfig) -> Result<RelationalStore> {
    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .connect(&config.url)
        .await?;
    Ok(RelationalStore::new(pool))
}

/// Create a CacheStore from a CacheConfig.
pub async fn create_cache_store(config: &CacheConfig) -> Result<CacheStore> {
    let redis_config = Config::from_url(&config.url)?;
    let client = Builder::from_config(redis_config).build()?;
    client.init().await?;
    Ok(CacheStore::new(client))
}

/// Resolve the database config for a module: module-specific override or default.
pub fn resolve_db_config<'a>(module_name: &str, app_config: &'a AppConfig) -> &'a DatabaseConfig {
    app_config
        .modules
        .get(module_name)
        .and_then(|m| m.storage.as_ref())
        .unwrap_or(&app_config.storage.default)
}

/// Resolve the cache config for a module: module-specific override or default.
pub fn resolve_cache_config<'a>(module_name: &str, app_config: &'a AppConfig) -> &'a CacheConfig {
    app_config
        .modules
        .get(module_name)
        .and_then(|m| m.cache.as_ref())
        .unwrap_or(&app_config.storage.cache)
}
