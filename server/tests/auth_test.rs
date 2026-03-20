mod common;

use serde_json::json;

#[tokio::test]
async fn test_register_and_login() {
    let server = common::TestServer::start().await;

    // Register
    let auth = server.register_user("test@example.com", "Test User", "password123").await;
    assert!(auth["access_token"].is_string());
    assert!(auth["refresh_token"].is_string());
    assert_eq!(auth["user"]["email"], "test@example.com");
    assert_eq!(auth["user"]["display_name"], "Test User");
    // password_hash should not be in response
    assert!(auth["user"]["password_hash"].is_null());

    // Login
    let auth2 = server.login("test@example.com", "password123").await;
    assert!(auth2["access_token"].is_string());
    assert_eq!(auth2["user"]["email"], "test@example.com");
}

#[tokio::test]
async fn test_duplicate_registration() {
    let server = common::TestServer::start().await;

    server.register_user("dup@example.com", "User 1", "password123").await;

    let res = server.client
        .post(format!("{}/auth/register", server.base_url))
        .json(&json!({
            "email": "dup@example.com",
            "display_name": "User 2",
            "password": "password456",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), 409);
}

#[tokio::test]
async fn test_invalid_login() {
    let server = common::TestServer::start().await;

    server.register_user("auth@example.com", "Auth User", "password123").await;

    let res = server.client
        .post(format!("{}/auth/login", server.base_url))
        .json(&json!({
            "email": "auth@example.com",
            "password": "wrong-password",
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), 401);
}

#[tokio::test]
async fn test_refresh_token() {
    let server = common::TestServer::start().await;

    let auth = server.register_user("refresh@example.com", "Refresh User", "password123").await;
    let refresh_token = auth["refresh_token"].as_str().unwrap();

    let res = server.client
        .post(format!("{}/auth/refresh", server.base_url))
        .json(&json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert!(body["access_token"].is_string());
    assert!(body["refresh_token"].is_string());
}
