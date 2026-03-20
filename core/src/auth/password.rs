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
