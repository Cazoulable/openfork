pub mod error;
pub mod types;

pub use error::OpenForkError;
pub type Result<T> = std::result::Result<T, OpenForkError>;
