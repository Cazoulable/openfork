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
