mod common;

use serde_json::json;

#[tokio::test]
async fn test_project_crud() {
    let server = common::TestServer::start().await;

    let auth = server.register_user("pt@example.com", "PT User", "password123").await;
    let token = auth["access_token"].as_str().unwrap();

    // Create workspace
    let res = server.client
        .post(format!("{}/api/workspaces", server.base_url))
        .json(&json!({ "name": "My Workspace", "slug": "my-workspace" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);
    let workspace: serde_json::Value = res.json().await.unwrap();
    let workspace_id = workspace["id"].as_str().unwrap();

    // Create project
    let res = server.client
        .post(format!("{}/api/projects", server.base_url))
        .bearer_auth(token)
        .json(&json!({
            "workspace_id": workspace_id,
            "name": "Test Project",
            "slug": "test-project",
            "description": "A test project"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);
    let project: serde_json::Value = res.json().await.unwrap();
    let project_id = project["id"].as_str().unwrap();

    // Get project
    let res = server.client
        .get(format!("{}/api/projects/{project_id}", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body["name"], "Test Project");

    // Update project
    let res = server.client
        .put(format!("{}/api/projects/{project_id}", server.base_url))
        .bearer_auth(token)
        .json(&json!({ "name": "Updated Project" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body["name"], "Updated Project");

    // Create issue
    let res = server.client
        .post(format!("{}/api/projects/{project_id}/issues", server.base_url))
        .bearer_auth(token)
        .json(&json!({
            "title": "Fix bug",
            "description": "There is a bug",
            "priority": "high"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);
    let issue: serde_json::Value = res.json().await.unwrap();
    let issue_id = issue["id"].as_str().unwrap();
    assert_eq!(issue["title"], "Fix bug");
    assert_eq!(issue["priority"], "high");

    // List issues
    let res = server.client
        .get(format!("{}/api/projects/{project_id}/issues", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let issues: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(issues.len(), 1);

    // Create comment
    let res = server.client
        .post(format!("{}/api/issues/{issue_id}/comments", server.base_url))
        .bearer_auth(token)
        .json(&json!({ "body": "Working on it" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 201);

    // List comments
    let res = server.client
        .get(format!("{}/api/issues/{issue_id}/comments", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let comments: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(comments.len(), 1);
    assert_eq!(comments[0]["body"], "Working on it");

    // Delete project (cascading)
    let res = server.client
        .delete(format!("{}/api/projects/{project_id}", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 204);
}
