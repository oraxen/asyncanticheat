use crate::{error::ApiError, transforms, AppState};
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use std::io::{BufRead, BufReader};
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

#[derive(Debug, Deserialize)]
struct RawPacketLine {
    ts: i64,
    uuid: String,
    #[serde(default)]
    name: Option<String>,
    pkt: String,
    #[serde(default)]
    fields: Value,
}

#[derive(Debug, Serialize)]
struct ModulePacketRecord {
    timestamp_ms: i64,
    player_uuid: Uuid,
    player_name: Option<String>,
    packet_type: String,
    data: Value,
}

#[derive(Debug, Serialize)]
struct ProcessBatchRequest {
    server_id: String,
    session_id: String,
    batch_id: String,
    packets: Vec<ModulePacketRecord>,
}

fn parse_raw_gz_ndjson_packets(raw_gz_ndjson: &[u8]) -> Vec<ModulePacketRecord> {
    let decoder = GzDecoder::new(raw_gz_ndjson);
    let reader = BufReader::new(decoder);

    let mut packets = Vec::new();
    for (idx, line) in reader.lines().enumerate() {
        let Ok(line) = line else { continue };
        if line.trim().is_empty() {
            continue;
        }
        // First line is metadata
        if idx == 0 {
            continue;
        }
        let parsed: RawPacketLine = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let uuid = match Uuid::parse_str(&parsed.uuid) {
            Ok(u) => u,
            Err(_) => continue,
        };
        packets.push(ModulePacketRecord {
            timestamp_ms: parsed.ts,
            player_uuid: uuid,
            player_name: parsed.name,
            packet_type: parsed.pkt,
            data: parsed.fields,
        });
    }
    packets
}

pub async fn dispatch_batch(
    state: AppState,
    server_id: String,
    session_id: String,
    batch_id: Uuid,
    _s3_key: String,
    raw_gz_ndjson: Vec<u8>,
) -> Result<(), ApiError> {
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
        "#
    )
    .bind(server_id)
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

        // Our built-in modules expose /process and accept a JSON ProcessBatchRequest.
        // (The raw packet batch is gzipped NDJSON as produced by the plugin.)
        let process_url = format!("{}/process", m.base_url.trim_end_matches('/'));

        let payload_gz = transforms::apply_transform(&m.transform, &raw_gz_ndjson)
            .map_err(|e| {
                tracing::error!("transform failed for module {}: {:?}", m.name, e);
                ApiError::Internal
            })?;

        let packets = parse_raw_gz_ndjson_packets(&payload_gz);
        let req = ProcessBatchRequest {
            server_id: m.server_id.clone(),
            session_id: session_id.clone(),
            batch_id: batch_id.to_string(),
            packets,
        };

        let resp = state
            .http
            .post(process_url)
            .json(&req)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                record_dispatch(&state, batch_id, &m.id, &m.server_id, "sent", Some(r.status().as_u16() as i32), None)
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
                record_dispatch(&state, batch_id, &m.id, &m.server_id, "failed", None, Some(&err))
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
        "#
    )
    .fetch_all(&state.db)
    .await;

    let Ok(modules) = modules else { return; };

    for m in modules {
        let health_url = format!("{}/health", m.base_url.trim_end_matches('/'));
        let ok = state.http.get(health_url).send().await.map(|r| r.status().is_success()).unwrap_or(false);
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


