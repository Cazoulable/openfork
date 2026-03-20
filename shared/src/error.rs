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
