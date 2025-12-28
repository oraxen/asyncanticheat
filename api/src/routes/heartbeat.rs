//! Heartbeat endpoint for plugin liveness checks.
//!
//! The plugin calls POST /heartbeat every 30 seconds to update last_seen_at,
//! allowing the dashboard to show accurate "Plugin Status" even when idle.

use axum::{extract::State, http::HeaderMap, Json};
use serde::Serialize;

use crate::{error::ApiError, AppState};

#[derive(Serialize)]
pub struct HeartbeatResponse {
    pub ok: bool,
}

fn parse_bearer_token(headers: &HeaderMap) -> Option<String> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim();
    let prefix = "bearer ";
    if auth.len() <= prefix.len() {
        return None;
    }
    if !auth[..prefix.len()].eq_ignore_ascii_case(prefix) {
        return None;
    }
    Some(auth[prefix.len()..].trim().to_string())
}

fn sha256_hex(input: &str) -> String {
    use sha2::Digest;
    let mut h = sha2::Sha256::new();
    h.update(input.as_bytes());
    let out = h.finalize();
    hex::encode(out)
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
        return Err(ApiError::BadRequest("X-Server-Id header is required".to_string()));
    }

    // Extract and validate token
    let token = parse_bearer_token(&headers)
        .ok_or_else(|| ApiError::BadRequest("Authorization header is required".to_string()))?;

    if token.is_empty() {
        return Err(ApiError::Unauthorized);
    }

    let token_hash = sha256_hex(&token);

    // Verify token matches the server's registered token
    let server_exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM public.servers WHERE id = $1 AND auth_token_hash = $2",
    )
    .bind(&server_id)
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("heartbeat token lookup failed: {:?}", e);
        ApiError::Internal
    })?;

    if server_exists.is_none() {
        // Either server doesn't exist or token doesn't match
        return Err(ApiError::Unauthorized);
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
