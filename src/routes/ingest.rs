use axum::{
    body::Bytes,
    extract::State,
    http::HeaderMap,
    Json,
};
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use uuid::Uuid;

use crate::{error::ApiError, AppState};
use crate::module_pipeline;

#[derive(Serialize)]
pub struct IngestResponse {
    pub ok: bool,
    pub batch_id: Uuid,
    pub s3_key: String,
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
) -> Result<Json<IngestResponse>, ApiError> {
    // --- Size check ---
    if body.len() > state.max_body_bytes {
        return Err(ApiError::BadRequest(format!(
            "payload too large: {} bytes (max {})",
            body.len(),
            state.max_body_bytes
        )));
    }

    // --- Auth ---
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let expected = format!("Bearer {}", state.ingest_token);
    if state.ingest_token.is_empty() || auth != expected {
        return Err(ApiError::Unauthorized);
    }

    // --- Extract required headers ---
    let server_id = headers
        .get("x-server-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let session_id = headers
        .get("x-session-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if server_id.is_empty() || session_id.is_empty() {
        return Err(ApiError::BadRequest(
            "missing X-Server-Id or X-Session-Id".to_string(),
        ));
    }

    // --- Optional metadata from headers ---
    let platform = headers
        .get("x-server-platform")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let batch_id = Uuid::new_v4();
    let payload_bytes: i32 = body.len().try_into().unwrap_or(i32::MAX);
    
    // Generate the S3 key upfront (deterministic, doesn't require upload)
    let s3_key = crate::s3::ObjectStore::batch_key(&server_id, &session_id, &batch_id);

    // --- DB operations FIRST to avoid orphaned S3 objects on failure ---
    // Upsert server identity
    upsert_server(&state.db, &server_id, platform.as_deref())
        .await
        .map_err(|e| {
            tracing::error!("Failed to upsert server: {:?}", e);
            ApiError::Internal
        })?;

    // Ensure default modules exist for newly-seen servers.
    // Without this, dispatch_batch is a no-op and the dashboard shows no modules/findings.
    ensure_default_modules(&state.db, &server_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to ensure default modules: {:?}", e);
            ApiError::Internal
        })?;

    // Insert batch_index row (before S3 upload to reserve the slot)
    insert_batch_index(&state.db, &batch_id, &server_id, &session_id, &s3_key, payload_bytes)
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

    Ok(Json(IngestResponse {
        ok: true,
        batch_id,
        s3_key,
    }))
}

/// Upsert a server record (update last_seen_at if exists).
async fn upsert_server(db: &PgPool, server_id: &str, platform: Option<&str>) -> Result<(), sqlx::Error> {
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
/// results in empty dashboard data. We add the built-in default module entries on first ingest.
async fn ensure_default_modules(db: &PgPool, server_id: &str) -> Result<(), sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as("select count(*) from public.server_modules where server_id = $1")
        .bind(server_id)
        .fetch_one(db)
        .await
        .unwrap_or((0,));

    if count > 0 {
        return Ok(());
    }

    // Legacy default modules (ports 4011/4012).
    // These are deployed on the same host and exposed as local HTTP services.
    let mut tx = db.begin().await?;

    sqlx::query(
        r#"
        insert into public.server_modules (server_id, name, base_url, enabled, transform, created_at, updated_at)
        values
            ($1, 'Legacy Module (4011)', 'http://127.0.0.1:4011', true, 'raw_ndjson_gz', now(), now()),
            ($1, 'Legacy Module (4012)', 'http://127.0.0.1:4012', true, 'raw_ndjson_gz', now(), now())
        "#,
    )
    .bind(server_id)
    .execute(&mut *tx)
    .await?;

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
