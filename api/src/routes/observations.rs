use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth, error::ApiError, AppState};

#[derive(Debug, Deserialize)]
pub struct CreateObservation {
    pub observation_type: String,
    pub player_uuid: Uuid,
    pub player_name: Option<String>,
    pub cheat_type: Option<String>,
    pub label: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub recorded_by_uuid: Option<Uuid>,
    pub recorded_by_name: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Serialize)]
pub struct CreateObservationResponse {
    pub ok: bool,
    pub observation_id: Uuid,
}

/// POST /observations
///
/// Creates a new cheat observation (recording) from the plugin.
/// Authenticated via per-server token (same as ingest).
pub async fn create_observation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateObservation>,
) -> Result<(StatusCode, Json<CreateObservationResponse>), ApiError> {
    // --- Extract server_id from header ---
    let server_id = headers
        .get("x-server-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim()
        .to_string();

    if server_id.is_empty() {
        return Err(ApiError::BadRequest(
            "missing X-Server-Id header".to_string(),
        ));
    }

    // --- Auth (per-server token) ---
    let token = auth::parse_bearer_token(&headers).ok_or(ApiError::Unauthorized)?;
    let token_hash = auth::sha256_hex(&token);

    // --- Validate server is registered and token matches ---
    let row: Option<(Option<String>, Option<Uuid>, Option<DateTime<Utc>>)> = sqlx::query_as(
        r#"
        SELECT auth_token_hash, owner_user_id, registered_at
        FROM public.servers
        WHERE id = $1
        "#,
    )
    .bind(&server_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("observation server lookup failed: {:?}", e);
        ApiError::Internal
    })?;

    match row {
        None => {
            return Err(ApiError::BadRequest(format!(
                "server {} not found",
                server_id
            )));
        }
        Some((stored_hash_opt, owner_user_id, registered_at)) => {
            // Token must match (using constant-time comparison to prevent timing attacks)
            if let Some(stored_hash) = stored_hash_opt {
                if !auth::validate_token_hash(&token_hash, &stored_hash) {
                    return Err(ApiError::Unauthorized);
                }
            } else {
                return Err(ApiError::Unauthorized);
            }

            // Server must be registered
            let is_registered = owner_user_id.is_some() && registered_at.is_some();
            if !is_registered {
                return Err(ApiError::BadRequest(
                    "server not registered - please link it in the dashboard first".to_string(),
                ));
            }
        }
    }

    // --- Validate observation_type ---
    let observation_type = payload.observation_type.to_lowercase();
    if !["recording", "undetected", "false_positive"].contains(&observation_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "invalid observation_type: {} (must be 'recording', 'undetected', or 'false_positive')",
            observation_type
        )));
    }

    // --- Insert the observation ---
    let observation_id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO public.cheat_observations (
            id,
            server_id,
            observation_type,
            source,
            player_uuid,
            player_name,
            cheat_type,
            label,
            started_at,
            ended_at,
            session_id,
            recorded_by_uuid,
            recorded_by_name,
            status,
            created_at,
            updated_at
        ) VALUES (
            $1, $2, $3, 'ingame', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', $13, $13
        )
        "#,
    )
    .bind(observation_id)
    .bind(&server_id)
    .bind(&observation_type)
    .bind(payload.player_uuid)
    .bind(&payload.player_name)
    .bind(&payload.cheat_type)
    .bind(&payload.label)
    .bind(payload.started_at)
    .bind(payload.ended_at)
    .bind(&payload.session_id)
    .bind(payload.recorded_by_uuid)
    .bind(&payload.recorded_by_name)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert observation: {:?}", e);
        ApiError::Internal
    })?;

    tracing::info!(
        observation_id = %observation_id,
        server_id = %server_id,
        observation_type = %observation_type,
        player_uuid = %payload.player_uuid,
        cheat_type = ?payload.cheat_type,
        "observation created"
    );

    Ok((
        StatusCode::CREATED,
        Json(CreateObservationResponse {
            ok: true,
            observation_id,
        }),
    ))
}
