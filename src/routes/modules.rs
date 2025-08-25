use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{error::ApiError, AppState};

#[derive(Debug, Deserialize)]
pub struct UpsertModuleRequest {
    pub name: String,
    pub base_url: String,
    pub enabled: Option<bool>,
    /// e.g. "raw_ndjson_gz" | "movement_events_v1_ndjson_gz"
    pub transform: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ServerModule {
    pub id: Uuid,
    pub server_id: String,
    pub name: String,
    pub base_url: String,
    pub enabled: bool,
    pub transform: String,
    pub last_healthcheck_ok: Option<bool>,
    pub last_error: Option<String>,
}

fn require_ingest_auth(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let expected = format!("Bearer {}", state.ingest_token);
    if state.ingest_token.is_empty() || auth != expected {
        return Err(ApiError::Unauthorized);
    }
    Ok(())
}

/// POST /servers/:server_id/modules
///
/// Register or update a module subscription for a server.
pub async fn upsert_module(
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    headers: HeaderMap,
    Json(req): Json<UpsertModuleRequest>,
) -> Result<Json<ServerModule>, ApiError> {
    require_ingest_auth(&state, &headers)?;

    // Ensure the server exists so FK constraints don't block module registration.
    sqlx::query(
        r#"
        insert into public.servers (id, first_seen_at, last_seen_at)
        values ($1, now(), now())
        on conflict (id) do update set last_seen_at = now()
        "#,
    )
    .bind(server_id.trim())
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("upsert server for module registration failed: {:?}", e);
        ApiError::Internal
    })?;

    if req.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".to_string()));
    }
    if req.base_url.trim().is_empty() {
        return Err(ApiError::BadRequest("base_url is required".to_string()));
    }

    let enabled = req.enabled.unwrap_or(true);
    let transform = req
        .transform
        .unwrap_or_else(|| "raw_ndjson_gz".to_string());

    let rec = sqlx::query_as::<_, ServerModule>(
        r#"
        insert into public.server_modules
            (server_id, name, base_url, enabled, transform, updated_at)
        values
            ($1, $2, $3, $4, $5, now())
        on conflict (server_id, name) do update set
            base_url = excluded.base_url,
            enabled = excluded.enabled,
            transform = excluded.transform,
            updated_at = now()
        returning
            id,
            server_id,
            name,
            base_url,
            enabled,
            transform,
            last_healthcheck_ok,
            last_error
        "#
    )
    .bind(server_id)
    .bind(req.name.trim())
    .bind(req.base_url.trim())
    .bind(enabled)
    .bind(transform)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("upsert_module failed: {:?}", e);
        ApiError::Internal
    })?;

    Ok(Json(rec))
}

/// GET /servers/:server_id/modules
pub async fn list_modules(
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Vec<ServerModule>>, ApiError> {
    require_ingest_auth(&state, &headers)?;

    let recs = sqlx::query_as::<_, ServerModule>(
        r#"
        select
            id,
            server_id,
            name,
            base_url,
            enabled,
            transform,
            last_healthcheck_ok,
            last_error
        from public.server_modules
        where server_id = $1
        order by name asc
        "#
    )
    .bind(server_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("list_modules failed: {:?}", e);
        ApiError::Internal
    })?;

    Ok(Json(recs))
}


