use axum::{extract::State, http::HeaderMap, Json};
use chrono::{DateTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::collections::HashSet;
use uuid::Uuid;

use crate::{error::ApiError, webhooks, AppState};

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

    // Per-request minute bucket (best-effort "last minute" window).
    let now: DateTime<Utc> = Utc::now();
    let window_start_at: DateTime<Utc> = now
        .with_second(0)
        .and_then(|t| t.with_nanosecond(0))
        .unwrap_or(now);

    // Ensure players exist (insert if missing, skip if exists).
    // Using DO NOTHING to avoid deadlocks from concurrent upserts.
    // We only need the row to exist for the FK constraint; last_seen_at is updated elsewhere.
    let mut player_uuids: HashSet<Uuid> = HashSet::new();
    for f in &req.findings {
        if let Some(u) = f.player_uuid {
            player_uuids.insert(u);
        }
    }
    for player_uuid in player_uuids {
        sqlx::query(
            r#"
            insert into public.players (uuid, username, first_seen_at, last_seen_at)
            values ($1, 'unknown', now(), now())
            on conflict (uuid) do nothing
            "#,
        )
        .bind(player_uuid)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("ensure player exists failed: {:?}", e);
            ApiError::Internal
        })?;
    }

    let mut inserted = 0usize;
    // Aggregate per (player_uuid, detector_name) per minute.
    #[derive(Debug, Clone)]
    struct Agg {
        count: i32,
        detector_version: Option<String>,
        severity: String,
        title: String,
        description: Option<String>,
        evidence_s3_key: Option<String>,
        evidence_json: Option<Value>,
    }

    fn sev_rank(sev: &str) -> i32 {
        match sev {
            "critical" => 4,
            "high" => 3,
            "medium" => 2,
            "low" => 1,
            _ => 0,
        }
    }

    let mut agg: HashMap<(Uuid, String), Agg> = HashMap::new();
    for f in &req.findings {
        let Some(player_uuid) = f.player_uuid else {
            continue;
        };
        let detector_name = f.detector_name.trim();
        if detector_name.is_empty() || f.title.trim().is_empty() {
            continue;
        }

        let sev = f.severity.as_deref().unwrap_or("info").to_string();
        let key = (player_uuid, detector_name.to_string());
        let entry = agg.entry(key).or_insert_with(|| Agg {
            count: 0,
            detector_version: f.detector_version.clone(),
            severity: sev.clone(),
            title: f.title.trim().to_string(),
            description: f.description.clone(),
            evidence_s3_key: f.evidence_s3_key.clone(),
            evidence_json: f.evidence_json.clone(),
        });

        entry.count += 1;
        entry.detector_version = f
            .detector_version
            .clone()
            .or(entry.detector_version.clone());

        // Keep the "strongest" severity/title/desc in the bucket.
        if sev_rank(&sev) >= sev_rank(&entry.severity) {
            entry.severity = sev;
            entry.title = f.title.trim().to_string();
            entry.description = f.description.clone();
            entry.evidence_s3_key = f.evidence_s3_key.clone();
            entry.evidence_json = f.evidence_json.clone();
        }
    }

    for ((player_uuid, detector_name), a) in &agg {
        let evidence_json = a.evidence_json.as_ref().map(sqlx::types::Json);

        // Upsert minute-bucket row and increment occurrences.
        sqlx::query(
            r#"
            insert into public.findings
                (server_id, player_uuid, session_id, detector_name, detector_version, severity, title, description, evidence_s3_key, evidence_json,
                 occurrences, window_start_at, first_seen_at, last_seen_at)
            values
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 $11, $12, now(), now())
            on conflict (server_id, player_uuid, detector_name, window_start_at)
                where player_uuid is not null
            do update set
                occurrences = public.findings.occurrences + excluded.occurrences,
                last_seen_at = now(),
                detector_version = coalesce(excluded.detector_version, public.findings.detector_version),
                -- keep max severity
                severity = case
                    when (case excluded.severity
                            when 'critical' then 4
                            when 'high' then 3
                            when 'medium' then 2
                            when 'low' then 1
                            else 0 end)
                         >= (case public.findings.severity
                            when 'critical' then 4
                            when 'high' then 3
                            when 'medium' then 2
                            when 'low' then 1
                            else 0 end)
                    then excluded.severity
                    else public.findings.severity
                end,
                title = excluded.title,
                description = excluded.description,
                evidence_s3_key = excluded.evidence_s3_key,
                evidence_json = excluded.evidence_json
            "#,
        )
        .bind(req.server_id.trim())
        .bind(*player_uuid)
        .bind(req.session_id.as_deref())
        .bind(detector_name.as_str())
        .bind(a.detector_version.as_deref())
        .bind(&a.severity)
        .bind(&a.title)
        .bind(a.description.as_deref())
        .bind(a.evidence_s3_key.as_deref())
        .bind(evidence_json)
        .bind(a.count)
        .bind(window_start_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("upsert aggregated finding failed: {:?}", e);
            ApiError::Internal
        })?;
        inserted += 1;
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("commit failed: {:?}", e);
        ApiError::Internal
    })?;

    tracing::info!(
        server_id = %req.server_id.trim(),
        session_id = ?req.session_id.as_deref(),
        batch_id = ?req.batch_id,
        inserted = inserted,
        "callbacks/findings stored"
    );

    // Send webhook notifications (fire-and-forget)
    if inserted > 0 {
        let server_id = req.server_id.trim().to_string();
        if let Some(settings) = webhooks::get_webhook_settings(&state.db, &server_id).await {
            if settings.webhook_enabled {
                if let Some(ref webhook_url) = settings.webhook_url {
                    // Build notifications for findings that match severity filters
                    let notifications: Vec<webhooks::FindingNotification> = agg
                        .iter()
                        .filter(|((_, _), a)| webhooks::should_notify(&settings, &a.severity))
                        .map(|((player_uuid, detector_name), a)| {
                            webhooks::FindingNotification {
                                server_id: server_id.clone(),
                                player_uuid: Some(*player_uuid),
                                player_name: None, // Would need to look up from players table
                                detector_name: detector_name.clone(),
                                severity: a.severity.clone(),
                                title: a.title.clone(),
                                description: a.description.clone(),
                                occurrences: a.count,
                            }
                        })
                        .collect();

                    if !notifications.is_empty() {
                        // Get server name for nicer webhook display
                        let server_name: Option<String> =
                            sqlx::query_scalar("SELECT name FROM public.servers WHERE id = $1")
                                .bind(&server_id)
                                .fetch_optional(&state.db)
                                .await
                                .ok()
                                .flatten();

                        webhooks::spawn_webhook_notifications(
                            state.http.clone(),
                            webhook_url.clone(),
                            notifications,
                            server_name,
                        );
                    }
                }
            }
        }
    }

    Ok(Json(PostFindingsResponse { ok: true, inserted }))
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

    // Ensure player exists (DO NOTHING to avoid deadlocks)
    sqlx::query(
        r#"
        insert into public.players (uuid, username, first_seen_at, last_seen_at)
        values ($1, 'unknown', now(), now())
        on conflict (uuid) do nothing
        "#,
    )
    .bind(req.player_uuid)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("ensure player exists failed: {:?}", e);
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
        // Ensure player exists (DO NOTHING to avoid deadlocks)
        sqlx::query(
            r#"
            insert into public.players (uuid, username, first_seen_at, last_seen_at)
            values ($1, 'unknown', now(), now())
            on conflict (uuid) do nothing
            "#,
        )
        .bind(entry.player_uuid)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("ensure player exists failed: {:?}", e);
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
