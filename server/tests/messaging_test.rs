mod common;

use serde_json::json;

#[tokio::test]
async fn test_channels_and_messages() {
    let server = common::TestServer::start().await;

    let auth = server.register_user("msg@example.com", "Msg User", "password123").await;
    let token = auth["access_token"].as_str().unwrap();

    // Create channel
    let res = server.client
        .post(format!("{}/api/channels", server.base_url))
        .bearer_auth(token)
        .json(&json!({
            "name": "General",
            "slug": "general",
            "description": "General discussion"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);
    let channel: serde_json::Value = res.json().await.unwrap();
    let channel_id = channel["id"].as_str().unwrap();

    // List channels
    let res = server.client
        .get(format!("{}/api/channels", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let channels: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(channels.len(), 1);

    // Send message
    let res = server.client
        .post(format!("{}/api/channels/{channel_id}/messages", server.base_url))
        .bearer_auth(token)
        .json(&json!({ "body": "Hello, world!" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);
    let message: serde_json::Value = res.json().await.unwrap();
    let message_id = message["id"].as_str().unwrap();
    assert_eq!(message["body"], "Hello, world!");

    // List messages
    let res = server.client
        .get(format!("{}/api/channels/{channel_id}/messages", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let messages: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(messages.len(), 1);

    // Thread reply
    let res = server.client
        .post(format!("{}/api/channels/{channel_id}/messages", server.base_url))
        .bearer_auth(token)
        .json(&json!({ "body": "Thread reply", "thread_id": message_id }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);

    // Get thread
    let res = server.client
        .get(format!("{}/api/messages/{message_id}/thread", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let thread: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(thread.len(), 2);

    // Add reaction
    let res = server.client
        .post(format!("{}/api/messages/{message_id}/reactions", server.base_url))
        .bearer_auth(token)
        .json(&json!({ "emoji": "👍" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);

    // Update message
    let res = server.client
        .put(format!("{}/api/messages/{message_id}", server.base_url))
        .bearer_auth(token)
        .json(&json!({ "body": "Hello, updated!" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let updated: serde_json::Value = res.json().await.unwrap();
    assert_eq!(updated["body"], "Hello, updated!");

    // Delete channel
    let res = server.client
        .delete(format!("{}/api/channels/{channel_id}", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 204);
}

#[tokio::test]
async fn test_direct_messages() {
    let server = common::TestServer::start().await;

    let auth1 = server.register_user("dm1@example.com", "DM User 1", "password123").await;
    let token1 = auth1["access_token"].as_str().unwrap();
    let _user1_id = auth1["user"]["id"].as_str().unwrap();

    let auth2 = server.register_user("dm2@example.com", "DM User 2", "password123").await;
    let user2_id = auth2["user"]["id"].as_str().unwrap();

    // Create DM group
    let res = server.client
        .post(format!("{}/api/dm", server.base_url))
        .bearer_auth(token1)
        .json(&json!({ "user_ids": [user2_id] }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);
    let group: serde_json::Value = res.json().await.unwrap();
    let group_id = group["id"].as_str().unwrap();

    // Send DM
    let res = server.client
        .post(format!("{}/api/dm/{group_id}/messages", server.base_url))
        .bearer_auth(token1)
        .json(&json!({ "body": "Hey there!" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);

    // List DMs
    let res = server.client
        .get(format!("{}/api/dm/{group_id}/messages", server.base_url))
        .bearer_auth(token1)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let dms: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(dms.len(), 1);
    assert_eq!(dms[0]["body"], "Hey there!");

    // List DM groups for user
    let res = server.client
        .get(format!("{}/api/dm", server.base_url))
        .bearer_auth(token1)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let groups: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(groups.len(), 1);
}
