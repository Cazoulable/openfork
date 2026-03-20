pub mod error;

pub use error::OpenForkError;
pub type Result<T> = std::result::Result<T, OpenForkError>;
