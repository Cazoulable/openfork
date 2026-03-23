use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use openfork_core::auth::AuthUser;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::*;
use crate::state::AppState;

/// Helper: fetch members for a list of group IDs and attach them.
async fn enrich_groups(
    pool: &sqlx::PgPool,
    groups: Vec<DirectMessageGroup>,
) -> Result<Vec<DmGroupWithMembers>, (StatusCode, Json<serde_json::Value>)> {
    if groups.is_empty() {
        return Ok(vec![]);
    }

    let group_ids: Vec<Uuid> = groups.iter().map(|g| g.id).collect();

    let members = sqlx::query_as::<_, (Uuid, Uuid, String)>(
        "SELECT m.group_id, m.user_id, u.display_name \
         FROM direct_message_members m \
         JOIN users u ON m.user_id = u.id \
         WHERE m.group_id = ANY($1)"
    )
    .bind(&group_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let mut result = Vec::with_capacity(groups.len());
    for g in groups {
        let group_members: Vec<DmGroupMember> = members
            .iter()
            .filter(|(gid, _, _)| *gid == g.id)
            .map(|(_, uid, name)| DmGroupMember {
                user_id: *uid,
                display_name: name.clone(),
            })
            .collect();

        result.push(DmGroupWithMembers {
            id: g.id,
            created_at: g.created_at,
            members: group_members,
        });
    }

    Ok(result)
}

pub async fn create_dm_group(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(req): Json<CreateDmGroupRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Build the full set of members (current user + requested users)
    let mut all_members: Vec<Uuid> = vec![user.0.sub];
    for uid in &req.user_ids {
        if *uid != user.0.sub {
            all_members.push(*uid);
        }
    }
    all_members.sort();
    let member_count = all_members.len() as i64;

    // Check if a group with exactly these members already exists
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT m.group_id FROM direct_message_members m \
         WHERE m.user_id = ANY($1) \
         GROUP BY m.group_id \
         HAVING COUNT(*) = $2 \
         AND COUNT(*) = (SELECT COUNT(*) FROM direct_message_members WHERE group_id = m.group_id)"
    )
    .bind(&all_members)
    .bind(member_count)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if let Some(existing_id) = existing {
        // Return the existing group with members
        let group = sqlx::query_as::<_, DirectMessageGroup>(
            "SELECT * FROM direct_message_groups WHERE id = $1"
        )
        .bind(existing_id)
        .fetch_one(state.db.pool())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

        let enriched = enrich_groups(state.db.pool(), vec![group]).await?;
        return Ok((StatusCode::OK, Json(enriched.into_iter().next().unwrap())));
    }

    // Create new group
    let id = Uuid::new_v4();

    let mut tx = state.db.pool().begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let group = sqlx::query_as::<_, DirectMessageGroup>(
        "INSERT INTO direct_message_groups (id) VALUES ($1) RETURNING *"
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    for uid in &all_members {
        sqlx::query("INSERT INTO direct_message_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(id)
            .bind(uid)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let enriched = enrich_groups(state.db.pool(), vec![group]).await?;
    Ok((StatusCode::CREATED, Json(enriched.into_iter().next().unwrap())))
}

pub async fn list_dm_groups(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<Json<Vec<DmGroupWithMembers>>, (StatusCode, Json<serde_json::Value>)> {
    let groups = sqlx::query_as::<_, DirectMessageGroup>(
        "SELECT g.* FROM direct_message_groups g \
         JOIN direct_message_members m ON g.id = m.group_id \
         WHERE m.user_id = $1 ORDER BY g.created_at DESC"
    )
    .bind(user.0.sub)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    enrich_groups(state.db.pool(), groups).await.map(Json)
}

pub async fn send_dm(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(group_id): Path<Uuid>,
    Json(req): Json<SendDmRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id = Uuid::new_v4();
    let dm = sqlx::query_as::<_, DirectMessage>(
        "INSERT INTO direct_messages (id, group_id, author_id, body) VALUES ($1, $2, $3, $4) \
         RETURNING *, (SELECT display_name FROM users WHERE id = $3) AS author_name"
    )
    .bind(id)
    .bind(group_id)
    .bind(user.0.sub)
    .bind(&req.body)
    .fetch_one(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    state.publish_event("dm.sent", json!({
        "dm_id": id,
        "group_id": group_id,
        "author_id": user.0.sub,
    })).await;

    Ok((StatusCode::CREATED, Json(dm)))
}

pub async fn list_dms(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(group_id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<DirectMessage>>, (StatusCode, Json<serde_json::Value>)> {
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);

    let messages = sqlx::query_as::<_, DirectMessage>(
        "SELECT dm.*, u.display_name AS author_name \
         FROM direct_messages dm LEFT JOIN users u ON dm.author_id = u.id \
         WHERE dm.group_id = $1 \
         ORDER BY dm.created_at ASC OFFSET $2 LIMIT $3"
    )
    .bind(group_id)
    .bind(offset)
    .bind(limit)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    Ok(Json(messages))
}
