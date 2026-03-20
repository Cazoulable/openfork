use axum::Router;
use openfork_shared::Result;
use super::context::ModuleContext;
use crate::storage::StorageRequirements;

/// Every module must implement this trait.
pub trait Module: Send + Sync {
    /// Unique module identifier (e.g., "project-tracking").
    fn name(&self) -> &str;

    /// Semantic version.
    fn version(&self) -> &str;

    /// What storage this module needs.
    fn storage_requirements(&self) -> StorageRequirements;

    /// Initialize the module with its context. Called once at startup.
    fn init(&mut self, ctx: ModuleContext) -> Result<()>;

    /// Return REST routes for this module. Called after init.
    fn routes(&self) -> Router;

    /// Graceful shutdown.
    fn shutdown(&self) -> Result<()> {
        Ok(())
    }
}
