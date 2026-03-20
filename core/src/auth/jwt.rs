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
