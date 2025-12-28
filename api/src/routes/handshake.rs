use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Serialize;

use crate::{auth, error::ApiError, AppState};

#[derive(Debug, Serialize)]
pub struct HandshakeResponse {
    pub ok: bool,
    /// "registered" | "waiting_for_registration"
    pub status: String,
    pub server_id: String,
}

/// POST /handshake
///
/// Lightweight "hello" endpoint used by the plugin on startup.
/// - Stores the server_id + token hash the first time we see a server.
/// - Returns `waiting_for_registration` until the server is linked to an account (owner_user_id set).
/// - Optionally stores server address for dashboard ping feature (auto-detected or from X-Server-Address header).
pub async fn handshake(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(StatusCode, Json<HandshakeResponse>), ApiError> {
    let token = auth::parse_bearer_token(&headers).ok_or(ApiError::Unauthorized)?;

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

    // Extract server address for ping feature (explicit header > forwarded-for > real-ip)
    let server_address = auth::extract_server_address(&headers);

    let token_hash = auth::sha256_hex(&token);

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
                    (id, platform, first_seen_at, last_seen_at, auth_token_hash, auth_token_first_seen_at, callback_url)
                values
                    ($1, $2, now(), now(), $3, now(), $4)
                on conflict (id) do update set
                    platform = coalesce(excluded.platform, servers.platform),
                    last_seen_at = now(),
                    callback_url = coalesce(excluded.callback_url, servers.callback_url)
                "#,
            )
            .bind(&server_id)
            .bind(platform.as_deref())
            .bind(&token_hash)
            .bind(server_address.as_deref())
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
            // Validate token FIRST before updating any state.
            // This prevents attackers from spoofing last_seen_at with invalid tokens.
            // Uses constant-time comparison to prevent timing attacks.
            if let Some(stored_hash) = &stored_hash_opt {
                if !auth::validate_token_hash(&token_hash, stored_hash) {
                    return Err(ApiError::Unauthorized);
                }
            }

            // Token is valid (or no token stored yet) - now bump last_seen_at and callback_url.
            let _ = sqlx::query(
                r#"
                update public.servers
                set last_seen_at = now(),
                    callback_url = coalesce($2, callback_url)
                where id = $1
                "#,
            )
            .bind(&server_id)
            .bind(server_address.as_deref())
            .execute(&state.db)
            .await;

            // If no token was stored, save this one.
            if stored_hash_opt.is_none() {
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
