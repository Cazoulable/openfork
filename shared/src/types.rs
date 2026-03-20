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
