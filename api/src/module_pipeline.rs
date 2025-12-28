use crate::{error::ApiError, transforms, AppState};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow)]
struct ServerModuleRow {
    id: Uuid,
    server_id: String,
    name: String,
    base_url: String,
    enabled: bool,
    transform: String,
    last_healthcheck_ok: Option<bool>,
    consecutive_failures: i32,
}

pub async fn dispatch_batch(
    state: AppState,
    server_id: String,
    session_id: String,
    batch_id: Uuid,
    s3_key: String,
    raw_gz_ndjson: Vec<u8>,
) -> Result<(), ApiError> {
    let server_id = server_id.trim().to_string();
    let session_id = session_id.trim().to_string();

    let modules = sqlx::query_as::<_, ServerModuleRow>(
        r#"
        select
            id,
            server_id,
            name,
            base_url,
            enabled,
            transform,
            last_healthcheck_ok,
            consecutive_failures
        from public.server_modules
        where server_id = $1 and enabled = true
        order by name asc
        "#,
    )
    .bind(&server_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("dispatch query failed: {:?}", e);
        ApiError::Internal
    })?;

    for m in modules {
        // Skip modules that are known-down.
        if m.last_healthcheck_ok == Some(false) && m.consecutive_failures >= 3 {
            continue;
        }

        // Category modules accept gzipped NDJSON batches via POST /ingest.
        let ingest_url = format!("{}/ingest", m.base_url.trim_end_matches('/'));

        let payload_gz = match transforms::apply_transform(&m.transform, &raw_gz_ndjson) {
            Ok(v) => v,
            Err(e) => {
                let err = format!("transform '{}' failed: {}", m.transform, e);
                tracing::error!("module {} transform failed: {}", m.name, err);
                record_dispatch(
                    &state,
                    batch_id,
                    &m.id,
                    &m.server_id,
                    "failed",
                    None,
                    Some(&err),
                )
                .await;
                mark_module_failure(&state, &m.id, &err).await;
                continue;
            }
        };

        let resp = state
            .http
            .post(ingest_url)
            // Keep these headers consistent with plugin → API ingest.
            .header("content-type", "application/x-ndjson")
            .header("content-encoding", "gzip")
            .header("x-server-id", &server_id)
            .header("x-session-id", &session_id)
            .header("x-batch-id", batch_id.to_string())
            .header("x-s3-key", &s3_key)
            .body(payload_gz)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                record_dispatch(
                    &state,
                    batch_id,
                    &m.id,
                    &m.server_id,
                    "sent",
                    Some(r.status().as_u16() as i32),
                    None,
                )
                .await;
                mark_module_ok(&state, &m.id).await;
            }
            Ok(r) => {
                let err = format!("module returned http {}", r.status());
                record_dispatch(
                    &state,
                    batch_id,
                    &m.id,
                    &m.server_id,
                    "failed",
                    Some(r.status().as_u16() as i32),
                    Some(&err),
                )
                .await;
                mark_module_failure(&state, &m.id, &err).await;
            }
            Err(e) => {
                let err = format!("dispatch error: {}", e);
                record_dispatch(
                    &state,
                    batch_id,
                    &m.id,
                    &m.server_id,
                    "failed",
                    None,
                    Some(&err),
                )
                .await;
                mark_module_failure(&state, &m.id, &err).await;
            }
        }
    }

    Ok(())
}

pub async fn healthcheck_tick(state: AppState) {
    let modules = sqlx::query_as::<_, ServerModuleRow>(
        r#"
        select
            id,
            server_id,
            name,
            base_url,
            enabled,
            transform,
            last_healthcheck_ok,
            consecutive_failures
        from public.server_modules
        where enabled = true
        order by server_id asc, name asc
        "#,
    )
    .fetch_all(&state.db)
    .await;

    let Ok(modules) = modules else {
        return;
    };

    for m in modules {
        let health_url = format!("{}/health", m.base_url.trim_end_matches('/'));
        let ok = state
            .http
            .get(health_url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        if ok {
            mark_health(&state, &m.id, true, None).await;
        } else {
            mark_health(&state, &m.id, false, Some("healthcheck failed")).await;
        }
    }
}

async fn record_dispatch(
    state: &AppState,
    batch_id: Uuid,
    module_id: &Uuid,
    server_id: &str,
    status: &str,
    http_status: Option<i32>,
    error: Option<&str>,
) {
    let _ = sqlx::query(
        r#"
        insert into public.module_dispatches
            (batch_id, server_id, module_id, status, http_status, error)
        values
            ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(batch_id)
    .bind(server_id)
    .bind(module_id)
    .bind(status)
    .bind(http_status)
    .bind(error)
    .execute(&state.db)
    .await;
}

async fn mark_module_ok(state: &AppState, module_id: &Uuid) {
    let _ = sqlx::query(
        r#"
        update public.server_modules
        set
            consecutive_failures = 0,
            last_error = null,
            last_healthcheck_ok = true,
            last_healthcheck_at = now()
        where id = $1
        "#,
    )
    .bind(module_id)
    .execute(&state.db)
    .await;
}

async fn mark_module_failure(state: &AppState, module_id: &Uuid, err: &str) {
    let _ = sqlx::query(
        r#"
        update public.server_modules
        set
            consecutive_failures = consecutive_failures + 1,
            last_error = $2,
            last_healthcheck_ok = false,
            last_healthcheck_at = now()
        where id = $1
        "#,
    )
    .bind(module_id)
    .bind(err)
    .execute(&state.db)
    .await;
}

async fn mark_health(state: &AppState, module_id: &Uuid, ok: bool, err: Option<&str>) {
    if ok {
        mark_module_ok(state, module_id).await;
    } else {
        mark_module_failure(state, module_id, err.unwrap_or("healthcheck failed")).await;
    }
}
