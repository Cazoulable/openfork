use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub storage: StorageConfig,
    #[serde(default)]
    pub modules: HashMap<String, ModuleConfig>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    #[serde(default = "default_token_expiry")]
    pub token_expiry_seconds: u64,
    #[serde(default = "default_refresh_expiry")]
    pub refresh_expiry_seconds: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StorageConfig {
    pub default: DatabaseConfig,
    pub cache: CacheConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CacheConfig {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ModuleConfig {
    pub storage: Option<DatabaseConfig>,
    pub cache: Option<CacheConfig>,
}

fn default_host() -> String { "0.0.0.0".into() }
fn default_port() -> u16 { 8080 }
fn default_token_expiry() -> u64 { 900 }       // 15 min
fn default_refresh_expiry() -> u64 { 604800 }  // 7 days
fn default_max_connections() -> u32 { 10 }

impl AppConfig {
    /// Load config from file, with env var overrides.
    pub fn load(path: &Path) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let mut config: AppConfig = toml::from_str(&content)?;

        // Apply env overrides for critical fields
        if let Ok(val) = std::env::var("OPENFORK_SERVER_PORT") {
            config.server.port = val.parse()?;
        }
        if let Ok(val) = std::env::var("OPENFORK_AUTH_JWT_SECRET") {
            config.auth.jwt_secret = val;
        }
        if let Ok(val) = std::env::var("OPENFORK_STORAGE_DEFAULT_URL") {
            config.storage.default.url = val;
        }
        if let Ok(val) = std::env::var("OPENFORK_STORAGE_CACHE_URL") {
            config.storage.cache.url = val;
        }

        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_example_config() {
        let content = include_str!("../../openfork.example.toml");
        let config: AppConfig = toml::from_str(content).unwrap();
        assert_eq!(config.server.port, 8080);
        assert_eq!(config.auth.jwt_secret, "CHANGE-ME-in-production");
        assert!(config.modules.is_empty());
    }
}
