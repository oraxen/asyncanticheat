use axum::{extract::State, http::HeaderMap, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{error::ApiError, AppState};

#[derive(Debug, Deserialize)]
pub struct FindingIn {
    pub player_uuid: Option<Uuid>,
    pub detector_name: String,
    pub detector_version: Option<String>,
    pub severity: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub evidence_s3_key: Option<String>,
    pub evidence_json: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct PostFindingsRequest {
    pub server_id: String,
    pub session_id: Option<String>,
    pub batch_id: Option<Uuid>,
    pub findings: Vec<FindingIn>,
}

#[derive(Debug, Serialize)]
pub struct PostFindingsResponse {
    pub ok: bool,
    pub inserted: usize,
}

fn require_callback_auth(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let expected = format!("Bearer {}", state.module_callback_token);
    if state.module_callback_token.is_empty() || auth != expected {
        return Err(ApiError::Unauthorized);
    }
    Ok(())
}

/// POST /callbacks/findings
///
/// Accepts findings from modules and stores them in Postgres/Supabase.
pub async fn post_findings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PostFindingsRequest>,
) -> Result<Json<PostFindingsResponse>, ApiError> {
    require_callback_auth(&state, &headers)?;

    if req.server_id.trim().is_empty() {
        return Err(ApiError::BadRequest("server_id is required".to_string()));
    }

    let mut tx = state.db.begin().await.map_err(|e| {
        tracing::error!("begin tx failed: {:?}", e);
        ApiError::Internal
    })?;

    let mut inserted = 0usize;
    for f in &req.findings {
        if f.detector_name.trim().is_empty() || f.title.trim().is_empty() {
            continue;
        }

        // Ensure player row exists if a player_uuid is provided (FK constraint).
        if let Some(player_uuid) = f.player_uuid {
            sqlx::query(
                r#"
                insert into public.players (uuid, username, first_seen_at, last_seen_at)
                values ($1, 'unknown', now(), now())
                on conflict (uuid) do update set last_seen_at = now()
                "#,
            )
            .bind(player_uuid)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("upsert player failed: {:?}", e);
                ApiError::Internal
            })?;
        }

        let evidence_json = f.evidence_json.as_ref().map(sqlx::types::Json);
        sqlx::query(
            r#"
            insert into public.findings
                (server_id, player_uuid, session_id, detector_name, detector_version, severity, title, description, evidence_s3_key, evidence_json)
            values
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
        )
        .bind(req.server_id.trim())
        .bind(f.player_uuid)
        .bind(req.session_id.as_deref())
        .bind(f.detector_name.trim())
        .bind(f.detector_version.as_deref())
        .bind(f.severity.as_deref().unwrap_or("info"))
        .bind(f.title.trim())
        .bind(f.description.as_deref())
        .bind(f.evidence_s3_key.as_deref())
        .bind(evidence_json)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("insert finding failed: {:?}", e);
            ApiError::Internal
        })?;
        inserted += 1;
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("commit failed: {:?}", e);
        ApiError::Internal
    })?;

    Ok(Json(PostFindingsResponse {
        ok: true,
        inserted,
    }))
}

// ============================================================================
// Module State Management
// ============================================================================
// These endpoints allow modules to persist state across batch boundaries,
// enabling NCP-style checks that track violation levels, attack patterns, etc.
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct GetPlayerStateRequest {
    pub server_id: String,
    pub player_uuid: Uuid,
    pub module_name: String,
}

#[derive(Debug, Serialize)]
pub struct PlayerStateResponse {
    pub ok: bool,
    pub state: Option<Value>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetPlayerStateRequest {
    pub server_id: String,
    pub player_uuid: Uuid,
    pub module_name: String,
    pub state: Value,
}

#[derive(Debug, Serialize)]
pub struct SetPlayerStateResponse {
    pub ok: bool,
}

#[derive(Debug, Deserialize)]
pub struct BatchGetPlayerStatesRequest {
    pub server_id: String,
    pub player_uuids: Vec<Uuid>,
    pub module_name: String,
}

#[derive(Debug, Serialize)]
pub struct BatchPlayerState {
    pub player_uuid: Uuid,
    pub state: Value,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct BatchGetPlayerStatesResponse {
    pub ok: bool,
    pub states: Vec<BatchPlayerState>,
}

#[derive(Debug, Deserialize)]
pub struct BatchSetPlayerStatesRequest {
    pub server_id: String,
    pub module_name: String,
    pub states: Vec<PlayerStateEntry>,
}

#[derive(Debug, Deserialize)]
pub struct PlayerStateEntry {
    pub player_uuid: Uuid,
    pub state: Value,
}

#[derive(Debug, Serialize)]
pub struct BatchSetPlayerStatesResponse {
    pub ok: bool,
    pub updated: usize,
}

/// GET /callbacks/player-state
///
/// Retrieves persisted state for a single player from a module.
pub async fn get_player_state(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<GetPlayerStateRequest>,
) -> Result<Json<PlayerStateResponse>, ApiError> {
    require_callback_auth(&state, &headers)?;

    let row: Option<(Value, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        r#"
        select state_json, updated_at
        from public.module_player_state
        where server_id = $1 and player_uuid = $2 and module_name = $3
        "#,
    )
    .bind(&req.server_id)
    .bind(req.player_uuid)
    .bind(&req.module_name)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("get player state failed: {:?}", e);
        ApiError::Internal
    })?;

    Ok(Json(PlayerStateResponse {
        ok: true,
        state: row.as_ref().map(|(s, _)| s.clone()),
        updated_at: row.map(|(_, t)| t.to_rfc3339()),
    }))
}

/// POST /callbacks/player-state
///
/// Sets/updates persisted state for a single player from a module.
pub async fn set_player_state(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<SetPlayerStateRequest>,
) -> Result<Json<SetPlayerStateResponse>, ApiError> {
    require_callback_auth(&state, &headers)?;

    // Ensure player exists
    sqlx::query(
        r#"
        insert into public.players (uuid, username, first_seen_at, last_seen_at)
        values ($1, 'unknown', now(), now())
        on conflict (uuid) do update set last_seen_at = now()
        "#,
    )
    .bind(req.player_uuid)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("upsert player failed: {:?}", e);
        ApiError::Internal
    })?;

    sqlx::query(
        r#"
        insert into public.module_player_state (server_id, player_uuid, module_name, state_json, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (server_id, player_uuid, module_name)
        do update set state_json = excluded.state_json, updated_at = now()
        "#,
    )
    .bind(&req.server_id)
    .bind(req.player_uuid)
    .bind(&req.module_name)
    .bind(sqlx::types::Json(&req.state))
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("set player state failed: {:?}", e);
        ApiError::Internal
    })?;

    Ok(Json(SetPlayerStateResponse { ok: true }))
}

/// POST /callbacks/player-states/batch-get
///
/// Retrieves persisted state for multiple players in a single request.
/// Useful when processing a batch with many players.
pub async fn batch_get_player_states(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<BatchGetPlayerStatesRequest>,
) -> Result<Json<BatchGetPlayerStatesResponse>, ApiError> {
    require_callback_auth(&state, &headers)?;

    if req.player_uuids.is_empty() {
        return Ok(Json(BatchGetPlayerStatesResponse {
            ok: true,
            states: vec![],
        }));
    }

    let rows: Vec<(Uuid, Value, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        r#"
        select player_uuid, state_json, updated_at
        from public.module_player_state
        where server_id = $1 and module_name = $2 and player_uuid = any($3)
        "#,
    )
    .bind(&req.server_id)
    .bind(&req.module_name)
    .bind(&req.player_uuids)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("batch get player states failed: {:?}", e);
        ApiError::Internal
    })?;

    let states = rows
        .into_iter()
        .map(|(uuid, state, updated_at)| BatchPlayerState {
            player_uuid: uuid,
            state,
            updated_at: updated_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(BatchGetPlayerStatesResponse { ok: true, states }))
}

/// POST /callbacks/player-states/batch-set
///
/// Sets/updates persisted state for multiple players in a single request.
/// Useful when processing a batch with many players.
pub async fn batch_set_player_states(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<BatchSetPlayerStatesRequest>,
) -> Result<Json<BatchSetPlayerStatesResponse>, ApiError> {
    require_callback_auth(&state, &headers)?;

    if req.states.is_empty() {
        return Ok(Json(BatchSetPlayerStatesResponse {
            ok: true,
            updated: 0,
        }));
    }

    let mut tx = state.db.begin().await.map_err(|e| {
        tracing::error!("begin tx failed: {:?}", e);
        ApiError::Internal
    })?;

    let mut updated = 0usize;
    for entry in &req.states {
        // Ensure player exists
        sqlx::query(
            r#"
            insert into public.players (uuid, username, first_seen_at, last_seen_at)
            values ($1, 'unknown', now(), now())
            on conflict (uuid) do update set last_seen_at = now()
            "#,
        )
        .bind(entry.player_uuid)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("upsert player failed: {:?}", e);
            ApiError::Internal
        })?;

        sqlx::query(
            r#"
            insert into public.module_player_state (server_id, player_uuid, module_name, state_json, updated_at)
            values ($1, $2, $3, $4, now())
            on conflict (server_id, player_uuid, module_name)
            do update set state_json = excluded.state_json, updated_at = now()
            "#,
        )
        .bind(&req.server_id)
        .bind(entry.player_uuid)
        .bind(&req.module_name)
        .bind(sqlx::types::Json(&entry.state))
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("set player state failed: {:?}", e);
            ApiError::Internal
        })?;

        updated += 1;
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("commit failed: {:?}", e);
        ApiError::Internal
    })?;

    Ok(Json(BatchSetPlayerStatesResponse { ok: true, updated }))
}

