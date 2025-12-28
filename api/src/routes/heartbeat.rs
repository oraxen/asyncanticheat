//! Heartbeat endpoint for plugin liveness checks.
//!
//! The plugin calls POST /heartbeat every 30 seconds to update last_seen_at,
//! allowing the dashboard to show accurate "Plugin Status" even when idle.

use axum::{extract::State, http::HeaderMap, Json};
use serde::Serialize;

use crate::{auth, error::ApiError, AppState};

#[derive(Serialize)]
pub struct HeartbeatResponse {
    pub ok: bool,
}

/// POST /heartbeat
///
/// Lightweight endpoint for plugin liveness. Updates last_seen_at without
/// requiring a full batch upload. Called every 30 seconds by the plugin.
///
/// Headers:
/// - Authorization: Bearer <token>
/// - X-Server-Id: <server_id>
pub async fn heartbeat(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<HeartbeatResponse>, ApiError> {
    // Extract server_id from header
    let server_id = headers
        .get("x-server-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim()
        .to_string();

    if server_id.is_empty() {
        return Err(ApiError::BadRequest(
            "X-Server-Id header is required".to_string(),
        ));
    }

    // Extract and validate token
    let token = auth::parse_bearer_token(&headers)
        .ok_or_else(|| ApiError::BadRequest("Authorization header is required".to_string()))?;

    if token.is_empty() {
        return Err(ApiError::Unauthorized);
    }

    let token_hash = auth::sha256_hex(&token);

    // Fetch stored token hash for constant-time comparison
    let stored_hash: Option<(Option<String>,)> =
        sqlx::query_as("SELECT auth_token_hash FROM public.servers WHERE id = $1")
            .bind(&server_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("heartbeat token lookup failed: {:?}", e);
                ApiError::Internal
            })?;

    // Verify token using constant-time comparison
    match stored_hash {
        None => {
            // Server doesn't exist
            return Err(ApiError::Unauthorized);
        }
        Some((None,)) => {
            // Server exists but has no token stored - reject
            return Err(ApiError::Unauthorized);
        }
        Some((Some(stored),)) => {
            if !auth::validate_token_hash(&token_hash, &stored) {
                return Err(ApiError::Unauthorized);
            }
        }
    }

    // Update last_seen_at
    sqlx::query("UPDATE public.servers SET last_seen_at = NOW() WHERE id = $1")
        .bind(&server_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("heartbeat update failed: {:?}", e);
            ApiError::Internal
        })?;

    tracing::debug!(server_id = %server_id, "heartbeat received");

    Ok(Json(HeartbeatResponse { ok: true }))
}
