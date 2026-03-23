# OpenFork Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the OpenFork core platform with plugin system, storage abstraction, auth, event bus, and two MVP apps (project tracking + messaging).

**Architecture:** Cargo workspace with separate crates for core, shared, proto, server, and each app. Core exposes traits (App, RelationalStore, CacheStore, EventBus). Apps are consumers. Server binary wires everything together. REST externally, gRPC internally.

**Tech Stack:** Rust 1.92, Tokio, Axum 0.8, Tonic 0.13, SQLx 0.8 (Postgres), fred (Redis), jsonwebtoken, argon2, serde, tracing.

---

## Phase 1: Project Scaffolding

### Task 1.1: Initialize Git and Cargo Workspace

**Files:**
- Create: `.gitignore`
- Create: `Cargo.toml` (workspace root)
- Create: `shared/Cargo.toml`
- Create: `shared/src/lib.rs`
- Create: `core/Cargo.toml`
- Create: `core/src/lib.rs`
- Create: `proto/Cargo.toml`
- Create: `proto/src/lib.rs`
- Create: `proto/build.rs`
- Create: `apps/project-tracking/Cargo.toml`
- Create: `apps/project-tracking/src/lib.rs`
- Create: `apps/messaging/Cargo.toml`
- Create: `apps/messaging/src/lib.rs`
- Create: `server/Cargo.toml`
- Create: `server/src/main.rs`

**Step 1: Initialize git**

```bash
cd /Users/simoncazals/projects/openfork
git init
```

**Step 2: Create `.gitignore`**

```gitignore
/target
*.swp
*.swo
.env
openfork.toml
```

**Step 3: Create root `Cargo.toml`**

```toml
[workspace]
members = [
    "shared",
    "core",
    "proto",
    "apps/project-tracking",
    "apps/messaging",
    "server",
]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2024"
license = "AGPL-3.0"

[workspace.dependencies]
# Async
tokio = { version = "1", features = ["full"] }

# Web
axum = { version = "0.8", features = ["ws"] }
tower = "0.5"
tower-http = { version = "0.6", features = ["cors", "trace"] }

# gRPC
tonic = "0.13"
prost = "0.13"
prost-types = "0.13"

# Database
sqlx = { version = "0.8", features = ["runtime-tokio", "tls-rustls", "postgres", "uuid", "chrono", "json"] }

# Redis
fred = { version = "10", features = ["subscriber-client"] }

# Auth
jsonwebtoken = "9"
argon2 = "0.5"

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Types
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }

# Error handling
thiserror = "2"
anyhow = "1"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Config
toml = "0.8"

# Testing
testcontainers = "0.23"

# Workspace crates
openfork-shared = { path = "shared" }
openfork-core = { path = "core" }
openfork-proto = { path = "proto" }
openfork-app-project-tracking = { path = "apps/project-tracking" }
openfork-app-messaging = { path = "apps/messaging" }
```

**Step 4: Create each crate's `Cargo.toml` and stub `src/lib.rs` (or `src/main.rs` for server)**

`shared/Cargo.toml`:
```toml
[package]
name = "openfork-shared"
version.workspace = true
edition.workspace = true

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
thiserror = { workspace = true }
```

`core/Cargo.toml`:
```toml
[package]
name = "openfork-core"
version.workspace = true
edition.workspace = true

[dependencies]
openfork-shared = { workspace = true }
tokio = { workspace = true }
axum = { workspace = true }
tower = { workspace = true }
tower-http = { workspace = true }
tonic = { workspace = true }
sqlx = { workspace = true }
fred = { workspace = true }
jsonwebtoken = { workspace = true }
argon2 = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
thiserror = { workspace = true }
anyhow = { workspace = true }
tracing = { workspace = true }
toml = { workspace = true }
```

`proto/Cargo.toml`:
```toml
[package]
name = "openfork-proto"
version.workspace = true
edition.workspace = true

[dependencies]
tonic = { workspace = true }
prost = { workspace = true }
prost-types = { workspace = true }

[build-dependencies]
tonic-build = "0.13"
```

`proto/build.rs`:
```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Will compile .proto files as they are added
    Ok(())
}
```

`apps/project-tracking/Cargo.toml`:
```toml
[package]
name = "openfork-app-project-tracking"
version.workspace = true
edition.workspace = true

[dependencies]
openfork-shared = { workspace = true }
openfork-core = { workspace = true }
openfork-proto = { workspace = true }
axum = { workspace = true }
sqlx = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }
tonic = { workspace = true }
```

`apps/messaging/Cargo.toml`:
```toml
[package]
name = "openfork-app-messaging"
version.workspace = true
edition.workspace = true

[dependencies]
openfork-shared = { workspace = true }
openfork-core = { workspace = true }
openfork-proto = { workspace = true }
axum = { workspace = true }
sqlx = { workspace = true }
fred = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }
tonic = { workspace = true }
tokio = { workspace = true }
```

`server/Cargo.toml`:
```toml
[package]
name = "openfork-server"
version.workspace = true
edition.workspace = true

[dependencies]
openfork-shared = { workspace = true }
openfork-core = { workspace = true }
openfork-proto = { workspace = true }
openfork-app-project-tracking = { workspace = true }
openfork-app-messaging = { workspace = true }
tokio = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
anyhow = { workspace = true }
```

All `src/lib.rs` files start empty. `server/src/main.rs`:
```rust
fn main() {
    println!("OpenFork server");
}
```

**Step 5: Verify workspace compiles**

```bash
cargo build
```

Expected: successful build, no errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Cargo workspace with all crates"
```

---

## Phase 2: Shared Types

### Task 2.1: Error Types

**Files:**
- Create: `shared/src/error.rs`
- Modify: `shared/src/lib.rs`

**Step 1: Write error types**

`shared/src/error.rs` — define `OpenForkError` enum with variants: `NotFound`, `Unauthorized`, `Forbidden`, `Validation(String)`, `Database(String)`, `Internal(String)`. Derive `thiserror::Error`. Implement conversion to HTTP status code.

```rust
use axum::http::StatusCode;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum OpenForkError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("unauthorized")]
    Unauthorized,

    #[error("forbidden")]
    Forbidden,

    #[error("validation error: {0}")]
    Validation(String),

    #[error("database error: {0}")]
    Database(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl OpenForkError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::Validation(_) => StatusCode::BAD_REQUEST,
            Self::Database(_) | Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl From<sqlx::Error> for OpenForkError {
    fn from(e: sqlx::Error) -> Self {
        Self::Database(e.to_string())
    }
}
```

Note: `shared/Cargo.toml` needs `axum` and `sqlx` added as dependencies for the status code conversion and sqlx error impl.

**Step 2: Write tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_codes() {
        assert_eq!(OpenForkError::NotFound("x".into()).status_code(), StatusCode::NOT_FOUND);
        assert_eq!(OpenForkError::Unauthorized.status_code(), StatusCode::UNAUTHORIZED);
        assert_eq!(OpenForkError::Forbidden.status_code(), StatusCode::FORBIDDEN);
        assert_eq!(OpenForkError::Validation("x".into()).status_code(), StatusCode::BAD_REQUEST);
        assert_eq!(OpenForkError::Internal("x".into()).status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
```

**Step 3: Run tests**

```bash
cargo test -p openfork-shared
```

Expected: PASS.

**Step 4: Commit**

```bash
git add shared/
git commit -m "feat(shared): add OpenForkError with HTTP status mapping"
```

### Task 2.2: Common ID and Timestamp Types

**Files:**
- Create: `shared/src/types.rs`
- Modify: `shared/src/lib.rs`

**Step 1: Define common types**

`shared/src/types.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type Id = Uuid;
pub type Timestamp = DateTime<Utc>;

pub fn new_id() -> Id {
    Uuid::new_v4()
}

pub fn now() -> Timestamp {
    Utc::now()
}

/// Pagination request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub offset: i64,
    pub limit: i64,
}

impl Default for Pagination {
    fn default() -> Self {
        Self { offset: 0, limit: 50 }
    }
}

/// Paginated response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub offset: i64,
    pub limit: i64,
}
```

**Step 2: Export from lib.rs**

```rust
pub mod error;
pub mod types;

pub use error::OpenForkError;
pub type Result<T> = std::result::Result<T, OpenForkError>;
```

**Step 3: Run tests**

```bash
cargo test -p openfork-shared
```

**Step 4: Commit**

```bash
git add shared/
git commit -m "feat(shared): add common ID, timestamp, and pagination types"
```

---

## Phase 3: Core — Configuration

### Task 3.1: Config Loading

**Files:**
- Create: `core/src/config.rs`
- Create: `openfork.example.toml`
- Modify: `core/src/lib.rs`

**Step 1: Define config structs**

`core/src/config.rs`:
```rust
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub storage: StorageConfig,
    #[serde(default)]
    pub apps: HashMap<String, AppPluginConfig>,
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
pub struct AppPluginConfig {
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
    /// Env vars: OPENFORK_SERVER__PORT=3000, OPENFORK_AUTH__JWT_SECRET=xxx, etc.
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
```

**Step 2: Create `openfork.example.toml`**

```toml
[server]
host = "0.0.0.0"
port = 8080

[auth]
jwt_secret = "CHANGE-ME-in-production"
token_expiry_seconds = 900
refresh_expiry_seconds = 604800

[storage.default]
url = "postgres://openfork:openfork@localhost:5432/openfork"
max_connections = 10

[storage.cache]
url = "redis://localhost:6379"

# Per-app storage overrides (optional)
# [apps.messaging.storage]
# url = "postgres://openfork:openfork@other-host:5432/messaging"
```

**Step 3: Write test for config parsing**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_example_config() {
        let content = include_str!("../../openfork.example.toml");
        let config: AppConfig = toml::from_str(content).unwrap();
        assert_eq!(config.server.port, 8080);
        assert_eq!(config.auth.jwt_secret, "CHANGE-ME-in-production");
        assert!(config.apps.is_empty());
    }
}
```

**Step 4: Run tests**

```bash
cargo test -p openfork-core
```

**Step 5: Commit**

```bash
git add core/ openfork.example.toml
git commit -m "feat(core): add config loading with TOML and env overrides"
```

---

## Phase 4: Core — Storage Abstraction

### Task 4.1: Storage Traits

**Files:**
- Create: `core/src/storage/mod.rs`
- Create: `core/src/storage/traits.rs`
- Modify: `core/src/lib.rs`

**Step 1: Define storage traits**

`core/src/storage/traits.rs`:
```rust
use sqlx::PgPool;
use fred::clients::Client as RedisClient;

/// Relational storage handle — wraps a Postgres connection pool.
/// Apps receive this and run their own queries against it.
#[derive(Clone)]
pub struct RelationalStore {
    pool: PgPool,
}

impl RelationalStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

/// Cache/pubsub storage handle — wraps a Redis client.
#[derive(Clone)]
pub struct CacheStore {
    client: RedisClient,
}

impl CacheStore {
    pub fn new(client: RedisClient) -> Self {
        Self { client }
    }

    pub fn client(&self) -> &RedisClient {
        &self.client
    }
}

/// What storage an app needs. Declared by each app.
#[derive(Debug, Clone, Default)]
pub struct StorageRequirements {
    pub relational: bool,
    pub cache: bool,
}
```

`core/src/storage/mod.rs`:
```rust
pub mod traits;
pub use traits::*;
```

**Step 2: Run check**

```bash
cargo check -p openfork-core
```

**Step 3: Commit**

```bash
git add core/
git commit -m "feat(core): add storage abstraction traits (RelationalStore, CacheStore)"
```

### Task 4.2: Storage Factory (Connect from Config)

**Files:**
- Create: `core/src/storage/factory.rs`
- Modify: `core/src/storage/mod.rs`

**Step 1: Implement factory**

`core/src/storage/factory.rs`:
```rust
use crate::config::{AppConfig, DatabaseConfig, CacheConfig};
use super::{RelationalStore, CacheStore};
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
    let redis_config = RedisConfig::from_url(&config.url)?;
    let client = Builder::from_config(redis_config).build()?;
    client.init().await?;
    Ok(CacheStore::new(client))
}

/// Resolve the database config for an app: app-specific override or default.
pub fn resolve_db_config<'a>(app_name: &str, app_config: &'a AppConfig) -> &'a DatabaseConfig {
    app_config
        .apps
        .get(app_name)
        .and_then(|m| m.storage.as_ref())
        .unwrap_or(&app_config.storage.default)
}

/// Resolve the cache config for an app: app-specific override or default.
pub fn resolve_cache_config<'a>(app_name: &str, app_config: &'a AppConfig) -> &'a CacheConfig {
    app_config
        .apps
        .get(app_name)
        .and_then(|m| m.cache.as_ref())
        .unwrap_or(&app_config.storage.cache)
}
```

**Step 2: Run check**

```bash
cargo check -p openfork-core
```

**Step 3: Commit**

```bash
git add core/
git commit -m "feat(core): add storage factory with per-app config resolution"
```

---

## Phase 5: Core — Auth

### Task 5.1: Password Hashing

**Files:**
- Create: `core/src/auth/mod.rs`
- Create: `core/src/auth/password.rs`

**Step 1: Implement password hashing with argon2**

`core/src/auth/password.rs`:
```rust
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use argon2::password_hash::rand_core::OsRng;
use openfork_shared::OpenForkError;

pub fn hash_password(password: &str) -> Result<String, OpenForkError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| OpenForkError::Internal(format!("password hash failed: {e}")))?;
    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, OpenForkError> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| OpenForkError::Internal(format!("invalid hash: {e}")))?;
    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}
```

**Step 2: Write tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let hash = hash_password("my-secret").unwrap();
        assert!(verify_password("my-secret", &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }
}
```

**Step 3: Run tests**

```bash
cargo test -p openfork-core -- auth::password
```

**Step 4: Commit**

```bash
git add core/
git commit -m "feat(core): add argon2 password hashing"
```

### Task 5.2: JWT Token Management

**Files:**
- Create: `core/src/auth/jwt.rs`
- Modify: `core/src/auth/mod.rs`

**Step 1: Implement JWT creation and validation**

`core/src/auth/jwt.rs`:
```rust
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use openfork_shared::types::Id;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Id,        // user ID
    pub exp: i64,       // expiry (unix timestamp)
    pub iat: i64,       // issued at
    pub token_type: TokenType,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    Access,
    Refresh,
}

pub struct JwtManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    access_expiry_seconds: u64,
    refresh_expiry_seconds: u64,
}

impl JwtManager {
    pub fn new(secret: &str, access_expiry_seconds: u64, refresh_expiry_seconds: u64) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
            access_expiry_seconds,
            refresh_expiry_seconds,
        }
    }

    pub fn create_access_token(&self, user_id: Id) -> Result<String, jsonwebtoken::errors::Error> {
        let now = Utc::now().timestamp();
        let claims = Claims {
            sub: user_id,
            exp: now + self.access_expiry_seconds as i64,
            iat: now,
            token_type: TokenType::Access,
        };
        encode(&Header::default(), &claims, &self.encoding_key)
    }

    pub fn create_refresh_token(&self, user_id: Id) -> Result<String, jsonwebtoken::errors::Error> {
        let now = Utc::now().timestamp();
        let claims = Claims {
            sub: user_id,
            exp: now + self.refresh_expiry_seconds as i64,
            iat: now,
            token_type: TokenType::Refresh,
        };
        encode(&Header::default(), &claims, &self.encoding_key)
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
        let data = decode::<Claims>(token, &self.decoding_key, &Validation::default())?;
        Ok(data.claims)
    }
}
```

**Step 2: Write tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_access_token_roundtrip() {
        let mgr = JwtManager::new("test-secret", 900, 604800);
        let user_id = Uuid::new_v4();
        let token = mgr.create_access_token(user_id).unwrap();
        let claims = mgr.validate_token(&token).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.token_type, TokenType::Access);
    }

    #[test]
    fn test_refresh_token_roundtrip() {
        let mgr = JwtManager::new("test-secret", 900, 604800);
        let user_id = Uuid::new_v4();
        let token = mgr.create_refresh_token(user_id).unwrap();
        let claims = mgr.validate_token(&token).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.token_type, TokenType::Refresh);
    }

    #[test]
    fn test_invalid_token_rejected() {
        let mgr = JwtManager::new("test-secret", 900, 604800);
        assert!(mgr.validate_token("garbage").is_err());
    }
}
```

**Step 3: Run tests**

```bash
cargo test -p openfork-core -- auth::jwt
```

**Step 4: Commit**

```bash
git add core/
git commit -m "feat(core): add JWT access and refresh token management"
```

### Task 5.3: Auth Middleware for Axum

**Files:**
- Create: `core/src/auth/middleware.rs`
- Modify: `core/src/auth/mod.rs`

**Step 1: Implement Axum auth extractor**

`core/src/auth/middleware.rs`:
```rust
use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
    response::{IntoResponse, Json},
};
use serde_json::json;
use std::sync::Arc;

use super::jwt::{Claims, JwtManager, TokenType};

/// Extractor that validates the JWT and provides the authenticated user's claims.
#[derive(Debug, Clone)]
pub struct AuthUser(pub Claims);

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    Arc<JwtManager>: FromRef<S>,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let jwt_manager = Arc::<JwtManager>::from_ref(state);

        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AuthError::MissingToken)?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or(AuthError::InvalidToken)?;

        let claims = jwt_manager
            .validate_token(token)
            .map_err(|_| AuthError::InvalidToken)?;

        if claims.token_type != TokenType::Access {
            return Err(AuthError::InvalidToken);
        }

        Ok(AuthUser(claims))
    }
}

// Need FromRef trait
use axum::extract::FromRef;

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> axum::response::Response {
        let (status, msg) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "missing authorization header"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "invalid token"),
        };
        (status, Json(json!({ "error": msg }))).into_response()
    }
}
```

**Step 2: Export from auth/mod.rs**

```rust
pub mod jwt;
pub mod middleware;
pub mod password;

pub use jwt::JwtManager;
pub use middleware::AuthUser;
```

**Step 3: Run check**

```bash
cargo check -p openfork-core
```

**Step 4: Commit**

```bash
git add core/
git commit -m "feat(core): add Axum auth middleware with JWT bearer extraction"
```

### Task 5.4: User Model and Auth Endpoints (Register, Login, Refresh)

**Files:**
- Create: `core/src/auth/models.rs`
- Create: `core/src/auth/handlers.rs`
- Create: `core/src/auth/migrations/` (SQL migration files)
- Modify: `core/src/auth/mod.rs`

**Step 1: Create user migration**

`core/migrations/0001_create_users.sql`:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
```

**Step 2: Define user model**

`core/src/auth/models.rs`:
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub display_name: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: User,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
}
```

**Step 3: Implement auth handlers**

`core/src/auth/handlers.rs`:
```rust
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::{
    jwt::JwtManager,
    models::*,
    password::{hash_password, verify_password},
};
use crate::storage::RelationalStore;

pub struct AuthState {
    pub db: RelationalStore,
    pub jwt: Arc<JwtManager>,
}

pub async fn register(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Validate
    if req.email.is_empty() || req.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "invalid email or password (min 8 chars)"}))));
    }

    let password_hash = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let user_id = Uuid::new_v4();
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(user_id)
    .bind(&req.email)
    .bind(&req.display_name)
    .bind(&password_hash)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
            (StatusCode::CONFLICT, Json(json!({"error": "email already registered"})))
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
    })?;

    let access_token = state.jwt.create_access_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok((StatusCode::CREATED, Json(AuthResponse { access_token, refresh_token, user })))
}

pub async fn login(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid credentials"}))))?;

    let valid = verify_password(&req.password, &user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid credentials"}))));
    }

    let access_token = state.jwt.create_access_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(user.id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(AuthResponse { access_token, refresh_token, user }))
}

pub async fn refresh(
    State(state): State<Arc<AuthState>>,
    Json(req): Json<RefreshRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let claims = state.jwt.validate_token(&req.refresh_token)
        .map_err(|_| (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid refresh token"}))))?;

    if claims.token_type != super::jwt::TokenType::Refresh {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "not a refresh token"}))));
    }

    let access_token = state.jwt.create_access_token(claims.sub)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let refresh_token = state.jwt.create_refresh_token(claims.sub)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(TokenResponse { access_token, refresh_token }))
}
```

**Step 4: Wire auth routes**

Add to `core/src/auth/mod.rs` a function that returns an Axum router:

```rust
use axum::{routing::post, Router};
use std::sync::Arc;

pub fn auth_routes(state: Arc<handlers::AuthState>) -> Router {
    Router::new()
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .route("/auth/refresh", post(handlers::refresh))
        .with_state(state)
}
```

**Step 5: Run check**

```bash
cargo check -p openfork-core
```

**Step 6: Commit**

```bash
git add core/
git commit -m "feat(core): add user model, auth handlers (register, login, refresh)"
```

---

## Phase 6: Core — App System

### Task 6.1: App Trait and Context

**Files:**
- Create: `core/src/app/mod.rs`
- Create: `core/src/app/traits.rs`
- Create: `core/src/app/context.rs`
- Create: `core/src/app/registry.rs`
- Modify: `core/src/lib.rs`

**Step 1: Define App trait**

`core/src/app/traits.rs`:
```rust
use axum::Router;
use openfork_shared::Result;
use super::context::AppContext;
use crate::storage::StorageRequirements;

/// Every app must implement this trait.
pub trait App: Send + Sync {
    /// Unique app identifier (e.g., "project-tracking").
    fn name(&self) -> &str;

    /// Semantic version.
    fn version(&self) -> &str;

    /// What storage this app needs.
    fn storage_requirements(&self) -> StorageRequirements;

    /// Initialize the app with its context. Called once at startup.
    fn init(&mut self, ctx: AppContext) -> Result<()>;

    /// Return REST routes for this app. Called after init.
    fn routes(&self) -> Router;

    /// Graceful shutdown.
    fn shutdown(&self) -> Result<()> {
        Ok(())
    }
}
```

**Step 2: Define AppContext**

`core/src/app/context.rs`:
```rust
use crate::auth::JwtManager;
use crate::storage::{CacheStore, RelationalStore};
use std::sync::Arc;

/// Provided to each app at init time. Contains everything an app needs.
#[derive(Clone)]
pub struct AppContext {
    /// Relational storage (if app requested it).
    pub db: Option<RelationalStore>,
    /// Cache storage (if app requested it).
    pub cache: Option<CacheStore>,
    /// JWT manager for auth utilities.
    pub jwt: Arc<JwtManager>,
}
```

**Step 3: Define Registry**

`core/src/app/registry.rs`:
```rust
use super::traits::App;
use super::context::AppContext;
use crate::config::AppConfig;
use crate::storage::{factory, RelationalStore, CacheStore};
use crate::auth::JwtManager;
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
    ) -> anyhow::Result<()> {
        for app in &mut self.apps {
            let reqs = app.storage_requirements();

            let db = if reqs.relational {
                let db_config = factory::resolve_db_config(app.name(), config);
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
```

`core/src/app/mod.rs`:
```rust
pub mod context;
pub mod registry;
pub mod traits;

pub use context::AppContext;
pub use registry::AppRegistry;
pub use traits::App;
```

**Step 4: Update core/src/lib.rs**

```rust
pub mod app;
pub mod auth;
pub mod config;
pub mod storage;
```

**Step 5: Run check**

```bash
cargo check -p openfork-core
```

**Step 6: Commit**

```bash
git add core/
git commit -m "feat(core): add app trait, context, and registry"
```

---

## Phase 7: Core — Event Bus

### Task 7.1: Event Bus with Redis Pub/Sub

**Files:**
- Create: `core/src/events/mod.rs`
- Create: `core/src/events/bus.rs`
- Modify: `core/src/lib.rs`
- Modify: `core/src/app/context.rs` (add event bus handle)

**Step 1: Define event types and bus**

`core/src/events/bus.rs`:
```rust
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
    redis: fred::clients::Client,
    /// Local broadcast for in-process subscribers (WebSocket manager, etc.)
    local_tx: broadcast::Sender<Event>,
}

impl EventBus {
    pub fn new(redis: fred::clients::Client) -> Self {
        let (local_tx, _) = broadcast::channel(1024);
        Self { redis, local_tx }
    }

    /// Publish an event to Redis and local subscribers.
    pub async fn publish(&self, event: Event) -> anyhow::Result<()> {
        let payload = serde_json::to_string(&event)?;
        let _: () = self.redis.publish("openfork:events", payload.as_str()).await?;
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
        let subscriber = self.redis.clone();
        subscriber.subscribe("openfork:events").await?;

        let mut message_stream = subscriber.message_rx();
        info!("Event bus: listening on Redis channel openfork:events");

        while let Ok(message) = message_stream.recv().await {
            if let Ok(payload) = message.value.as_str() {
                match serde_json::from_str::<Event>(payload) {
                    Ok(event) => { let _ = self.local_tx.send(event); }
                    Err(e) => error!("Failed to parse event: {e}"),
                }
            }
        }
        Ok(())
    }
}
```

`core/src/events/mod.rs`:
```rust
pub mod bus;
pub use bus::{Event, EventBus};
```

**Step 2: Add EventBus to AppContext**

Update `core/src/app/context.rs`:
```rust
use crate::auth::JwtManager;
use crate::events::EventBus;
use crate::storage::{CacheStore, RelationalStore};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppContext {
    pub db: Option<RelationalStore>,
    pub cache: Option<CacheStore>,
    pub jwt: Arc<JwtManager>,
    pub events: Arc<EventBus>,
}
```

Update `AppRegistry::init_all` to accept and pass `Arc<EventBus>`.

**Step 3: Run check**

```bash
cargo check -p openfork-core
```

**Step 4: Commit**

```bash
git add core/
git commit -m "feat(core): add event bus with Redis pub/sub and local broadcast"
```

---

## Phase 8: Server Binary

### Task 8.1: Wire Server

**Files:**
- Modify: `server/src/main.rs`
- Create: `docker-compose.yml`

**Step 1: Implement main.rs**

```rust
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
    sqlx::migrate!("core/migrations")
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
```

Note: `ModuleRegistry::init_all` signature needs updating to also accept `Arc<EventBus>`. Adjust in Task 6.1 registry code.

**Step 2: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: openfork
      POSTGRES_PASSWORD: openfork
      POSTGRES_DB: openfork
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

**Step 3: Start infrastructure and test**

```bash
docker compose up -d
cargo build
cargo run --bin openfork-server
```

Expected: server starts, prints "OpenFork server listening on 0.0.0.0:8080".

**Step 4: Commit**

```bash
git add server/ docker-compose.yml
git commit -m "feat(server): wire main binary with auth, storage, module registry"
```

---

## Phase 9: Module — Project Tracking

### Task 9.1: Data Model and Migrations

**Files:**
- Create: `modules/project-tracking/migrations/0001_create_project_tracking.sql`
- Create: `modules/project-tracking/src/models.rs`

**Step 1: Create migration**

```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, slug)
);

CREATE TYPE issue_status AS ENUM ('backlog', 'todo', 'in_progress', 'done', 'cancelled');
CREATE TYPE issue_priority AS ENUM ('none', 'low', 'medium', 'high', 'urgent');

CREATE TABLE issues (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status issue_status NOT NULL DEFAULT 'backlog',
    priority issue_priority NOT NULL DEFAULT 'none',
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    issue_number SERIAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE labels (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    UNIQUE(project_id, name)
);

CREATE TABLE issue_labels (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE comments (
    id UUID PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_assignee ON issues(assignee_id);
CREATE INDEX idx_comments_issue ON comments(issue_id);
```

**Step 2: Define Rust models**

`modules/project-tracking/src/models.rs` — structs for `Workspace`, `Project`, `Issue`, `Label`, `Comment` with `sqlx::FromRow` and `Serialize`. Request/response types for CRUD operations.

**Step 3: Commit**

```bash
git add modules/project-tracking/
git commit -m "feat(project-tracking): add data model and migrations"
```

### Task 9.2: CRUD Handlers

**Files:**
- Create: `modules/project-tracking/src/handlers/mod.rs`
- Create: `modules/project-tracking/src/handlers/projects.rs`
- Create: `modules/project-tracking/src/handlers/issues.rs`
- Create: `modules/project-tracking/src/handlers/comments.rs`

Implement standard CRUD endpoints:

**Projects:** `POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`

**Issues:** `POST /api/projects/:project_id/issues`, `GET /api/projects/:project_id/issues` (with filtering by status, priority, assignee, label), `GET /api/issues/:id`, `PUT /api/issues/:id`, `DELETE /api/issues/:id`

**Comments:** `POST /api/issues/:issue_id/comments`, `GET /api/issues/:issue_id/comments`, `PUT /api/comments/:id`, `DELETE /api/comments/:id`

**Labels:** `POST /api/projects/:project_id/labels`, `GET /api/projects/:project_id/labels`, `PUT /api/issues/:issue_id/labels` (set labels on issue)

All handlers use `AuthUser` extractor from core. All mutations publish events via EventBus.

**Step: Commit after each handler group is implemented and tested.**

### Task 9.3: Implement Module Trait

**Files:**
- Modify: `modules/project-tracking/src/lib.rs`

Wire `ProjectTrackingModule` struct implementing `Module` trait. Return all routes from `routes()`. Apply migrations in `init()`.

```rust
pub struct ProjectTrackingModule {
    ctx: Option<ModuleContext>,
}

impl Module for ProjectTrackingModule {
    fn name(&self) -> &str { "project-tracking" }
    fn version(&self) -> &str { "0.1.0" }
    fn storage_requirements(&self) -> StorageRequirements {
        StorageRequirements { relational: true, cache: false }
    }
    fn init(&mut self, ctx: ModuleContext) -> Result<()> {
        self.ctx = Some(ctx);
        Ok(())
    }
    fn routes(&self) -> Router { /* ... */ }
}
```

**Commit:**

```bash
git add modules/project-tracking/ server/
git commit -m "feat(project-tracking): complete MVP module with CRUD endpoints"
```

---

## Phase 10: Module — Messaging

### Task 10.1: Data Model and Migrations

**Files:**
- Create: `modules/messaging/migrations/0001_create_messaging.sql`
- Create: `modules/messaging/src/models.rs`

**Migration:**

```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT false,
    creator_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE channel_members (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    thread_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reactions (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE direct_message_groups (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE direct_message_members (
    group_id UUID NOT NULL REFERENCES direct_message_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE direct_messages (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES direct_message_groups(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_direct_messages_group ON direct_messages(group_id, created_at);
CREATE INDEX idx_messages_body_search ON messages USING gin(to_tsvector('english', body));
```

**Commit:**

```bash
git add modules/messaging/
git commit -m "feat(messaging): add data model and migrations"
```

### Task 10.2: Channel and Message REST Handlers

**Files:**
- Create: `modules/messaging/src/handlers/mod.rs`
- Create: `modules/messaging/src/handlers/channels.rs`
- Create: `modules/messaging/src/handlers/messages.rs`
- Create: `modules/messaging/src/handlers/reactions.rs`
- Create: `modules/messaging/src/handlers/dm.rs`

**Endpoints:**

**Channels:** `POST /api/channels`, `GET /api/channels`, `GET /api/channels/:id`, `PUT /api/channels/:id`, `DELETE /api/channels/:id`, `POST /api/channels/:id/join`, `POST /api/channels/:id/leave`

**Messages:** `POST /api/channels/:channel_id/messages`, `GET /api/channels/:channel_id/messages` (paginated), `GET /api/messages/:id/thread` (thread replies), `PUT /api/messages/:id`, `DELETE /api/messages/:id`

**Reactions:** `POST /api/messages/:id/reactions`, `DELETE /api/messages/:id/reactions/:emoji`

**DMs:** `POST /api/dm` (create/get group), `GET /api/dm`, `POST /api/dm/:group_id/messages`, `GET /api/dm/:group_id/messages`

**Search:** `GET /api/messages/search?q=...` (uses Postgres full-text search)

**Commit after each handler group.**

### Task 10.3: WebSocket Real-Time Layer

**Files:**
- Create: `modules/messaging/src/websocket.rs`
- Modify: `modules/messaging/src/lib.rs`

**Step 1: Implement WebSocket handler**

Use Axum's WebSocket support. On connection:
1. Validate JWT from query param or first message
2. Subscribe to EventBus
3. Forward relevant events (messages in user's channels) to the WebSocket
4. Accept incoming WebSocket messages for sending chat messages (alternative to REST POST)

**Step 2: Implement presence**

Use Redis to track online/offline/away status:
- `SET openfork:presence:<user_id> <status>` with TTL (heartbeat-based)
- `GET /api/presence/:user_id` REST endpoint
- Presence changes published as events

**Commit:**

```bash
git add modules/messaging/
git commit -m "feat(messaging): add WebSocket real-time and presence"
```

### Task 10.4: Implement Module Trait

Wire `MessagingModule` struct implementing `Module` trait. Requests both relational and cache storage.

```rust
fn storage_requirements(&self) -> StorageRequirements {
    StorageRequirements { relational: true, cache: true }
}
```

**Commit:**

```bash
git add modules/messaging/ server/
git commit -m "feat(messaging): complete MVP module with channels, DMs, WebSocket"
```

---

## Phase 11: Server Integration and Docker

### Task 11.1: Register Modules in Server

**Files:**
- Modify: `server/src/main.rs`

Uncomment module registration. Import and instantiate both modules.

```rust
use openfork_mod_project_tracking::ProjectTrackingModule;
use openfork_mod_messaging::MessagingModule;

registry.register(Box::new(ProjectTrackingModule::new()));
registry.register(Box::new(MessagingModule::new()));
```

**Step: Full integration test**

```bash
docker compose up -d
cargo run --bin openfork-server
# In another terminal:
curl -X POST http://localhost:8080/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","display_name":"Test User","password":"password123"}'
```

Expected: 201 with access_token, refresh_token, user.

**Commit:**

```bash
git add server/
git commit -m "feat(server): register project-tracking and messaging modules"
```

### Task 11.2: Dockerfile

**Files:**
- Create: `Dockerfile`

Multi-stage build: build with `rust:1.92` image, run with `debian:bookworm-slim`.

```dockerfile
FROM rust:1.92 AS builder
WORKDIR /app
COPY . .
RUN cargo build --release --bin openfork-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/openfork-server /usr/local/bin/
CMD ["openfork-server"]
```

Update `docker-compose.yml` to include the server service.

**Commit:**

```bash
git add Dockerfile docker-compose.yml
git commit -m "chore: add Dockerfile and update docker-compose for full stack"
```

---

## Phase 12: Integration Tests

### Task 12.1: Test Harness with Testcontainers

**Files:**
- Create: `server/tests/common/mod.rs` — spin up Postgres + Redis via testcontainers, run migrations, return a configured HTTP client
- Create: `server/tests/auth_test.rs` — test register, login, refresh, protected endpoint
- Create: `server/tests/project_tracking_test.rs` — test full CRUD cycle
- Create: `server/tests/messaging_test.rs` — test channels, messages, basic WebSocket

Each test file uses the common harness. Tests run against real Postgres and Redis instances.

**Run:**

```bash
cargo test --test auth_test --test project_tracking_test --test messaging_test
```

**Commit:**

```bash
git add server/tests/
git commit -m "test: add integration tests for auth, project-tracking, and messaging"
```

---

## Execution Order Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 | 1.1 | Compiling workspace skeleton |
| 2 | 2.1–2.2 | Shared error and type foundations |
| 3 | 3.1 | Config loading from TOML + env |
| 4 | 4.1–4.2 | Storage abstraction with Postgres/Redis adapters |
| 5 | 5.1–5.4 | Auth: passwords, JWT, middleware, endpoints |
| 6 | 6.1 | Module trait, context, registry |
| 7 | 7.1 | Event bus with Redis Pub/Sub |
| 8 | 8.1 | Running server binary with Docker Compose |
| 9 | 9.1–9.3 | Project tracking module (complete) |
| 10 | 10.1–10.4 | Messaging module (complete) |
| 11 | 11.1–11.2 | Full stack Docker deployment |
| 12 | 12.1 | Integration tests |
