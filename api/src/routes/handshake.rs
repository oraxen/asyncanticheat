use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Serialize;

use crate::{error::ApiError, AppState};

#[derive(Debug, Serialize)]
pub struct HandshakeResponse {
    pub ok: bool,
    /// "registered" | "waiting_for_registration"
    pub status: String,
    pub server_id: String,
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

/// POST /handshake
///
/// Lightweight "hello" endpoint used by the plugin on startup.
/// - Stores the server_id + token hash the first time we see a server.
/// - Returns `waiting_for_registration` until the server is linked to an account (owner_user_id set).
pub async fn handshake(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(StatusCode, Json<HandshakeResponse>), ApiError> {
    let token = parse_bearer_token(&headers).ok_or(ApiError::Unauthorized)?;

    let server_id = headers
        .get("x-server-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim()
        .to_string();
    if server_id.is_empty() {
        return Err(ApiError::BadRequest("missing X-Server-Id".to_string()));
    }

    let platform = headers
        .get("x-server-platform")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let token_hash = sha256_hex(&token);

    // Load or create server row.
    let row: Option<(
        Option<String>,
        Option<uuid::Uuid>,
        Option<chrono::DateTime<chrono::Utc>>,
    )> = sqlx::query_as(
        r#"
            select auth_token_hash, owner_user_id, registered_at
            from public.servers
            where id = $1
            "#,
    )
    .bind(&server_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("handshake lookup failed: {:?}", e);
        ApiError::Internal
    })?;

    match row {
        None => {
            // New server: insert as "pending registration".
            sqlx::query(
                r#"
                insert into public.servers
                    (id, platform, first_seen_at, last_seen_at, auth_token_hash, auth_token_first_seen_at)
                values
                    ($1, $2, now(), now(), $3, now())
                on conflict (id) do update set
                    platform = coalesce(excluded.platform, servers.platform),
                    last_seen_at = now()
                "#,
            )
            .bind(&server_id)
            .bind(platform.as_deref())
            .bind(&token_hash)
            .execute(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("handshake insert failed: {:?}", e);
                ApiError::Internal
            })?;

            return Ok((
                StatusCode::CONFLICT,
                Json(HandshakeResponse {
                    ok: true,
                    status: "waiting_for_registration".to_string(),
                    server_id,
                }),
            ));
        }
        Some((stored_hash_opt, owner_user_id, registered_at)) => {
            // Always bump last_seen_at for heartbeat.
            let _ = sqlx::query("update public.servers set last_seen_at = now() where id = $1")
                .bind(&server_id)
                .execute(&state.db)
                .await;

            // If hash doesn't match, reject.
            if let Some(stored_hash) = stored_hash_opt {
                if stored_hash != token_hash {
                    return Err(ApiError::Unauthorized);
                }
            } else {
                // First time we see a token for an existing server row.
                let _ = sqlx::query(
                    r#"
                    update public.servers
                    set auth_token_hash = $2,
                        auth_token_first_seen_at = coalesce(auth_token_first_seen_at, now())
                    where id = $1
                    "#,
                )
                .bind(&server_id)
                .bind(&token_hash)
                .execute(&state.db)
                .await;
            }

            let is_registered = owner_user_id.is_some() && registered_at.is_some();
            if !is_registered {
                return Ok((
                    StatusCode::CONFLICT,
                    Json(HandshakeResponse {
                        ok: true,
                        status: "waiting_for_registration".to_string(),
                        server_id,
                    }),
                ));
            }

            Ok((
                StatusCode::OK,
                Json(HandshakeResponse {
                    ok: true,
                    status: "registered".to_string(),
                    server_id,
                }),
            ))
        }
    }
}
