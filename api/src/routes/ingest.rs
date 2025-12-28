use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, QueryBuilder};
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use uuid::Uuid;

use crate::module_pipeline;
use crate::{auth, error::ApiError, AppState};

#[derive(Serialize)]
pub struct IngestResponse {
    pub ok: bool,
    pub batch_id: Uuid,
    pub s3_key: String,
}

#[derive(Serialize)]
pub struct WaitingForRegistrationResponse {
    pub ok: bool,
    pub status: String,
    pub server_id: String,
}

/// POST /ingest
///
/// Receives a gzipped NDJSON batch of packet records.
/// 1. Validates auth token
/// 2. Uploads raw payload to S3
/// 3. Upserts server identity in Postgres
/// 4. Inserts batch_index row pointing to S3 object
pub async fn ingest(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // --- Extract required headers early (also needed for auth/registration gate) ---
    let server_id = headers
        .get("x-server-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim()
        .to_string();
    let session_id = headers
        .get("x-session-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim()
        .to_string();
    if server_id.is_empty() || session_id.is_empty() {
        return Err(ApiError::BadRequest(
            "missing X-Server-Id or X-Session-Id".to_string(),
        ));
    }

    // --- Size check ---
    if body.len() > state.max_body_bytes {
        return Err(ApiError::BadRequest(format!(
            "payload too large: {} bytes (max {})",
            body.len(),
            state.max_body_bytes
        )));
    }

    // --- Auth (per-server token) ---
    let token = auth::parse_bearer_token(&headers).ok_or(ApiError::Unauthorized)?;
    let token_hash = auth::sha256_hex(&token);

    // --- Optional metadata from headers ---
    let platform = headers
        .get("x-server-platform")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Extract server address for ping feature (explicit header > forwarded-for > real-ip)
    let server_address = auth::extract_server_address(&headers);

    // --- Registration gate ---
    // We store the server + token hash the first time we see it, but we do not accept payloads
    // until the server is linked to a dashboard account (owner_user_id + registered_at).
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
        tracing::error!("ingest registration lookup failed: {:?}", e);
        ApiError::Internal
    })?;

    match row {
        None => {
            // New server: insert as pending.
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
                tracing::error!("ingest insert pending server failed: {:?}", e);
                ApiError::Internal
            })?;

            let body = WaitingForRegistrationResponse {
                ok: true,
                status: "waiting_for_registration".to_string(),
                server_id,
            };
            return Ok((
                StatusCode::CONFLICT,
                Json(serde_json::to_value(body).unwrap()),
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

            // Token is valid (or no token stored yet) - now update last_seen_at and callback_url.
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

            // First time we see a token for an existing row: store it.
            if stored_hash_opt.is_none() {
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
                let body = WaitingForRegistrationResponse {
                    ok: true,
                    status: "waiting_for_registration".to_string(),
                    server_id,
                };
                return Ok((
                    StatusCode::CONFLICT,
                    Json(serde_json::to_value(body).unwrap()),
                ));
            }
        }
    }

    let batch_id = Uuid::new_v4();
    let payload_bytes: i32 = body.len().try_into().unwrap_or(i32::MAX);

    // Generate the S3 key upfront (deterministic, doesn't require upload)
    // Returns None if server_id or session_id sanitizes to empty (e.g., malicious "../../../")
    let s3_key = crate::s3::ObjectStore::batch_key(&server_id, &session_id, &batch_id)
        .ok_or_else(|| {
            tracing::warn!(
                server_id = %server_id,
                session_id = %session_id,
                "Invalid server_id or session_id: sanitizes to empty string"
            );
            ApiError::BadRequest("Invalid server_id or session_id: sanitizes to empty string".into())
        })?;

    // --- DB operations FIRST to avoid orphaned S3 objects on failure ---
    // Upsert server identity (registered servers only reach this point).
    upsert_server(&state.db, &server_id, platform.as_deref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to upsert server: {:?}", e);
            ApiError::Internal
        })?;

    // Ensure built-in module entries exist for newly-seen servers.
    // Without this, dispatch_batch is a no-op and the dashboard shows no modules/findings.
    ensure_builtin_modules(&state.db, &server_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to ensure builtin modules: {:?}", e);
            ApiError::Internal
        })?;

    // Insert batch_index row (before S3 upload to reserve the slot)
    insert_batch_index(
        &state.db,
        &batch_id,
        &server_id,
        &session_id,
        &s3_key,
        payload_bytes,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert batch_index: {:?}", e);
        ApiError::Internal
    })?;

    // --- Upload to S3 after DB success ---
    // If this fails, we have a batch_index row without data, but that's easier
    // to detect and retry than orphaned S3 objects without DB references
    state
        .object_store
        .put_batch(&server_id, &session_id, &batch_id, body.to_vec())
        .await
        .map_err(|e| {
            tracing::error!("S3 upload failed (batch_index exists): {:?}", e);
            // Note: batch_index row exists but S3 object doesn't - should be retried
            ApiError::Internal
        })?;

    // --- Track players (best-effort, async) ---
    // This allows the dashboard to show "active players" as subtle gray dots even without findings.
    {
        let db = state.db.clone();
        let track_server_id = server_id.clone();
        let gz_body = body.to_vec();
        tokio::spawn(async move {
            if let Err(e) = extract_and_upsert_server_players(&db, &track_server_id, &gz_body).await
            {
                tracing::debug!("server player tracking failed (non-critical): {:?}", e);
            }
        });
    }

    // --- Dispatch to modules (best-effort, async) ---
    {
        let dispatch_state = state.clone();
        let dispatch_server_id = server_id.clone();
        let dispatch_session_id = session_id.clone();
        let dispatch_s3_key = s3_key.clone();
        let dispatch_body = body.to_vec();
        tokio::spawn(async move {
            if let Err(e) = module_pipeline::dispatch_batch(
                dispatch_state,
                dispatch_server_id,
                dispatch_session_id,
                batch_id,
                dispatch_s3_key,
                dispatch_body,
            )
            .await
            {
                tracing::warn!("module dispatch failed: {:?}", e);
            }
        });
    }

    tracing::info!(
        batch_id = %batch_id,
        server_id = %server_id,
        session_id = %session_id,
        s3_key = %s3_key,
        bytes = payload_bytes,
        "batch ingested"
    );

    Ok((
        StatusCode::OK,
        Json(
            serde_json::to_value(IngestResponse {
                ok: true,
                batch_id,
                s3_key,
            })
            .unwrap(),
        ),
    ))
}

/// Upsert a server record (update last_seen_at if exists).
async fn upsert_server(
    db: &PgPool,
    server_id: &str,
    platform: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        insert into public.servers (id, platform, first_seen_at, last_seen_at)
        values ($1, $2, now(), now())
        on conflict (id) do update set
            platform = coalesce(excluded.platform, servers.platform),
            last_seen_at = now()
        "#,
    )
    .bind(server_id)
    .bind(platform)
    .execute(db)
    .await?;
    Ok(())
}

/// Ensure a server has at least the built-in module entries configured.
///
/// New servers won't have any `server_modules` rows by default, which prevents analysis and
/// results in empty dashboard data.
///
/// We also perform a small best-effort migration away from the legacy default modules
/// (pre category split) so older servers don't keep showing outdated module names in the dashboard.
async fn ensure_builtin_modules(db: &PgPool, server_id: &str) -> Result<(), sqlx::Error> {
    // Built-in tiered modules (Core + Advanced).
    //
    // IMPORTANT:
    // - These entries are only defaults so newly-registered servers have something to dispatch to.
    // - They must NOT recreate deprecated/legacy module names, otherwise the dashboard will keep
    //   re-showing them forever as long as ingest happens.
    let mut tx = db.begin().await?;
    let now = chrono::Utc::now();

    // Legacy defaults (pre category split) used local ports 4011/4012.
    // Intermediate tiered modules used ports 4021-4026.
    // Remove them so the dashboard doesn't show outdated legacy module entries forever.
    // (If you intentionally run custom modules on these ports, re-register them under a new name.)
    sqlx::query(
        r#"
        delete from public.server_modules
        where server_id = $1
          and (
            (base_url like 'http://127.0.0.1:4011%' or base_url like 'http://localhost:4011%')
            or (base_url like 'http://127.0.0.1:4012%' or base_url like 'http://localhost:4012%')
            or (base_url like 'http://127.0.0.1:4021%' or base_url like 'http://localhost:4021%')
            or (base_url like 'http://127.0.0.1:4022%' or base_url like 'http://localhost:4022%')
            or (base_url like 'http://127.0.0.1:4023%' or base_url like 'http://localhost:4023%')
            or (base_url like 'http://127.0.0.1:4024%' or base_url like 'http://localhost:4024%')
            or (base_url like 'http://127.0.0.1:4025%' or base_url like 'http://localhost:4025%')
            or (base_url like 'http://127.0.0.1:4026%' or base_url like 'http://localhost:4026%')
          )
        "#,
    )
    .bind(server_id)
    .execute(&mut *tx)
    .await?;

    // Deprecated "legacy/combined" modules (ports 4021-4023).
    // We delete them to prevent ingest from reintroducing them for every batch.
    // Only delete if they're pointing to the legacy localhost ports, not custom hosts.
    sqlx::query(
        r#"
        delete from public.server_modules
        where server_id = $1
          and name in ('Combat Module', 'Movement Module', 'Player Module')
          and (
            base_url like 'http://127.0.0.1:402%'
            or base_url like 'http://localhost:402%'
          )
        "#,
    )
    .bind(server_id)
    .execute(&mut *tx)
    .await?;

    {
        let builtins = crate::builtin_modules::BUILTIN_MODULES;
        let mut qb = QueryBuilder::new(
            "insert into public.server_modules (server_id, name, base_url, enabled, transform, created_at, updated_at) ",
        );
        qb.push_values(builtins, |mut b, m| {
            b.push_bind(server_id)
                .push_bind(m.name)
                .push_bind(crate::builtin_modules::default_base_url(m.default_port))
                .push_bind(true)
                .push_bind("raw_ndjson_gz")
                .push_bind(now)
                .push_bind(now);
        });
        qb.push(" on conflict (server_id, name) do nothing");
        qb.build().execute(&mut *tx).await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Insert a batch_index row pointing to the S3 object.
async fn insert_batch_index(
    db: &PgPool,
    batch_id: &Uuid,
    server_id: &str,
    session_id: &str,
    s3_key: &str,
    payload_bytes: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        insert into public.batch_index
            (id, server_id, session_id, s3_key, payload_bytes)
        values
            ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(batch_id)
    .bind(server_id)
    .bind(session_id)
    .bind(s3_key)
    .bind(payload_bytes)
    .execute(db)
    .await?;
    Ok(())
}

/// Minimal packet record for player extraction (only uuid and name)
#[derive(Debug, Deserialize)]
struct PacketRecordPartial {
    #[serde(default)]
    uuid: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

async fn extract_and_upsert_server_players(
    db: &PgPool,
    server_id: &str,
    gz_body: &[u8],
) -> anyhow::Result<()> {
    const MAX_LINES: usize = 2000;

    let decoder = GzDecoder::new(gz_body);
    let reader = BufReader::new(decoder);

    let mut seen: HashSet<(Uuid, String)> = HashSet::new();

    for (i, line_result) in reader.lines().enumerate() {
        if i >= MAX_LINES {
            break;
        }
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };
        if line.is_empty() {
            continue;
        }

        let record: PacketRecordPartial = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let (Some(uuid_str), Some(name)) = (record.uuid, record.name) else {
            continue;
        };

        if name.is_empty() {
            continue;
        }

        let Ok(uuid) = uuid_str.parse::<Uuid>() else {
            continue;
        };

        seen.insert((uuid, name));
    }

    if seen.is_empty() {
        return Ok(());
    }

    for (uuid, username) in seen {
        // Upsert into global players
        let _ = sqlx::query(
            r#"
            insert into public.players (uuid, username, first_seen_at, last_seen_at)
            values ($1, $2, now(), now())
            on conflict (uuid) do update set
                username = excluded.username,
                last_seen_at = now()
            "#,
        )
        .bind(uuid)
        .bind(&username)
        .execute(db)
        .await;

        // Upsert per-server last seen
        let _ = sqlx::query(
            r#"
            insert into public.server_players (server_id, player_uuid, player_name, first_seen_at, last_seen_at)
            values ($1, $2, $3, now(), now())
            on conflict (server_id, player_uuid) do update set
                player_name = excluded.player_name,
                last_seen_at = now()
            "#,
        )
        .bind(server_id)
        .bind(uuid)
        .bind(&username)
        .execute(db)
        .await;
    }

    Ok(())
}
