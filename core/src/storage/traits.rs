use sqlx::PgPool;
use fred::clients::Client as RedisClient;

/// Relational storage handle — wraps a Postgres connection pool.
/// Modules receive this and run their own queries against it.
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

/// What storage a module needs. Declared by each module.
#[derive(Debug, Clone, Default)]
pub struct StorageRequirements {
    pub relational: bool,
    pub cache: bool,
}
