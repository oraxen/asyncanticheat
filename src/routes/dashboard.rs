use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::ApiError, AppState};

// ============================================================================
// Dashboard API Routes
// ============================================================================
// These endpoints serve the asyncanticheat.com dashboard frontend.
// ============================================================================

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_findings: i64,
    pub active_modules: i64,
    pub players_monitored: i64,
    pub findings_today: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardStatsResponse {
    pub ok: bool,
    pub stats: DashboardStats,
}

/// GET /dashboard/:server_id/stats
///
/// Returns aggregate stats for the dashboard homepage.
pub async fn get_stats(
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<DashboardStatsResponse>, ApiError> {
    // Total findings for this server
    let total_findings: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM public.findings WHERE server_id = $1")
            .bind(&server_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));

    // Active modules for this server
    let active_modules: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM public.server_modules WHERE server_id = $1 AND enabled = true",
    )
    .bind(&server_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    // Unique players with findings on this server
    let players_monitored: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT player_uuid) FROM public.findings WHERE server_id = $1 AND player_uuid IS NOT NULL",
    )
    .bind(&server_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    // Findings in the last 24 hours
    let findings_today: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM public.findings WHERE server_id = $1 AND created_at > NOW() - INTERVAL '24 hours'",
    )
    .bind(&server_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    Ok(Json(DashboardStatsResponse {
        ok: true,
        stats: DashboardStats {
            total_findings: total_findings.0,
            active_modules: active_modules.0,
            players_monitored: players_monitored.0,
            findings_today: findings_today.0,
        },
    }))
}

#[derive(Debug, Deserialize)]
pub struct FindingsQuery {
    pub severity: Option<String>,
    pub player: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct FindingItem {
    pub id: Uuid,
    pub player_uuid: Option<Uuid>,
    pub player_name: Option<String>,
    pub detector_name: String,
    pub severity: String,
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct FindingsResponse {
    pub ok: bool,
    pub findings: Vec<FindingItem>,
    pub total: i64,
}

/// GET /dashboard/:server_id/findings
///
/// Returns paginated findings for the findings page.
pub async fn get_findings(
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(params): Query<FindingsQuery>,
) -> Result<Json<FindingsResponse>, ApiError> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    // Build dynamic query based on filters
    let mut conditions = vec!["f.server_id = $1"];
    let mut bind_idx = 2;

    if params.severity.is_some() {
        conditions.push("f.severity = $2");
        bind_idx = 3;
    }

    let where_clause = conditions.join(" AND ");

    let base_query = format!(
        r#"
        SELECT 
            f.id, 
            f.player_uuid, 
            p.username as player_name,
            f.detector_name, 
            f.severity, 
            f.title, 
            f.description,
            f.created_at
        FROM public.findings f
        LEFT JOIN public.players p ON f.player_uuid = p.uuid
        WHERE {}
        ORDER BY f.created_at DESC
        LIMIT ${} OFFSET ${}
        "#,
        where_clause,
        bind_idx,
        bind_idx + 1
    );

    let count_query = format!(
        "SELECT COUNT(*) FROM public.findings f WHERE {}",
        where_clause
    );

    let findings: Vec<(
        Uuid,
        Option<Uuid>,
        Option<String>,
        String,
        String,
        String,
        Option<String>,
        chrono::DateTime<chrono::Utc>,
    )>;
    let total: (i64,);

    if let Some(ref severity) = params.severity {
        findings = sqlx::query_as(&base_query)
            .bind(&server_id)
            .bind(severity)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("get findings failed: {:?}", e);
                ApiError::Internal
            })?;

        total = sqlx::query_as(&count_query)
            .bind(&server_id)
            .bind(severity)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));
    } else {
        // No severity filter - adjust query
        let base_query = r#"
            SELECT 
                f.id, 
                f.player_uuid, 
                p.username as player_name,
                f.detector_name, 
                f.severity, 
                f.title, 
                f.description,
                f.created_at
            FROM public.findings f
            LEFT JOIN public.players p ON f.player_uuid = p.uuid
            WHERE f.server_id = $1
            ORDER BY f.created_at DESC
            LIMIT $2 OFFSET $3
        "#;

        findings = sqlx::query_as(base_query)
            .bind(&server_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("get findings failed: {:?}", e);
                ApiError::Internal
            })?;

        total = sqlx::query_as("SELECT COUNT(*) FROM public.findings WHERE server_id = $1")
            .bind(&server_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));
    }

    let items: Vec<FindingItem> = findings
        .into_iter()
        .map(
            |(
                id,
                player_uuid,
                player_name,
                detector_name,
                severity,
                title,
                description,
                created_at,
            )| {
                FindingItem {
                    id,
                    player_uuid,
                    player_name,
                    detector_name,
                    severity,
                    title,
                    description,
                    created_at: created_at.to_rfc3339(),
                }
            },
        )
        .collect();

    Ok(Json(FindingsResponse {
        ok: true,
        findings: items,
        total: total.0,
    }))
}

#[derive(Debug, Serialize)]
pub struct PlayerItem {
    pub uuid: Uuid,
    pub username: String,
    pub findings_count: i64,
    pub highest_severity: String,
    pub last_seen: String,
    pub detectors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PlayersResponse {
    pub ok: bool,
    pub players: Vec<PlayerItem>,
}

/// GET /dashboard/:server_id/players
///
/// Returns players with their findings summary for the dashboard.
pub async fn get_players(
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<PlayersResponse>, ApiError> {
    // Get players with aggregated stats
    let rows: Vec<(Uuid, String, i64, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        r#"
        SELECT 
            p.uuid,
            p.username,
            COUNT(f.id) as findings_count,
            MAX(f.created_at) as last_finding
        FROM public.players p
        INNER JOIN public.findings f ON p.uuid = f.player_uuid
        WHERE f.server_id = $1
        GROUP BY p.uuid, p.username
        ORDER BY COUNT(f.id) DESC
        LIMIT 50
        "#,
    )
    .bind(&server_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("get players failed: {:?}", e);
        ApiError::Internal
    })?;

    let mut players = Vec::new();
    for (uuid, username, findings_count, last_finding) in rows {
        // Get highest severity for this player
        let severity: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT severity FROM public.findings 
            WHERE player_uuid = $1 AND server_id = $2
            ORDER BY 
                CASE severity 
                    WHEN 'critical' THEN 4 
                    WHEN 'high' THEN 3 
                    WHEN 'medium' THEN 2 
                    WHEN 'low' THEN 1 
                    ELSE 0 
                END DESC
            LIMIT 1
            "#,
        )
        .bind(uuid)
        .bind(&server_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        // Get unique detectors for this player
        let detectors: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT DISTINCT detector_name 
            FROM public.findings 
            WHERE player_uuid = $1 AND server_id = $2
            "#,
        )
        .bind(uuid)
        .bind(&server_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

        players.push(PlayerItem {
            uuid,
            username,
            findings_count,
            highest_severity: severity.map(|s| s.0).unwrap_or_else(|| "info".to_string()),
            last_seen: last_finding.to_rfc3339(),
            detectors: detectors.into_iter().map(|d| d.0).collect(),
        });
    }

    Ok(Json(PlayersResponse { ok: true, players }))
}

#[derive(Debug, Serialize)]
pub struct ModuleItem {
    pub id: Uuid,
    pub name: String,
    pub base_url: String,
    pub enabled: bool,
    pub healthy: bool,
    pub last_error: Option<String>,
    pub detections: i64,
}

#[derive(Debug, Serialize)]
pub struct ModulesResponse {
    pub ok: bool,
    pub modules: Vec<ModuleItem>,
}

/// GET /dashboard/:server_id/modules
///
/// Returns modules for the modules page.
pub async fn get_modules(
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<ModulesResponse>, ApiError> {
    let rows: Vec<(Uuid, String, String, bool, Option<bool>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT 
            id,
            name,
            base_url,
            enabled,
            last_healthcheck_ok,
            last_error
        FROM public.server_modules
        WHERE server_id = $1
        ORDER BY name
        "#,
    )
    .bind(&server_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("get modules failed: {:?}", e);
        ApiError::Internal
    })?;

    let mut modules = Vec::new();
    for (id, name, base_url, enabled, last_healthcheck_ok, last_error) in rows {
        // Get detection count for this module (approximation based on detector_name pattern)
        let detections: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM public.findings 
            WHERE server_id = $1 AND detector_name LIKE $2
            "#,
        )
        .bind(&server_id)
        .bind(format!("{}%", name.to_lowercase().replace(" ", "_")))
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

        modules.push(ModuleItem {
            id,
            name,
            base_url,
            enabled,
            healthy: last_healthcheck_ok.unwrap_or(true),
            last_error,
            detections: detections.0,
        });
    }

    Ok(Json(ModulesResponse { ok: true, modules }))
}

#[derive(Debug, Deserialize)]
pub struct ToggleModuleRequest {
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct ToggleModuleResponse {
    pub ok: bool,
}

/// POST /dashboard/:server_id/modules/:module_id/toggle
///
/// Toggles a module's enabled state.
pub async fn toggle_module(
    State(state): State<AppState>,
    Path((server_id, module_id)): Path<(String, Uuid)>,
    Json(req): Json<ToggleModuleRequest>,
) -> Result<Json<ToggleModuleResponse>, ApiError> {
    sqlx::query(
        "UPDATE public.server_modules SET enabled = $1, updated_at = NOW() WHERE id = $2 AND server_id = $3",
    )
    .bind(req.enabled)
    .bind(module_id)
    .bind(&server_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("toggle module failed: {:?}", e);
        ApiError::Internal
    })?;

    Ok(Json(ToggleModuleResponse { ok: true }))
}

#[derive(Debug, Serialize)]
pub struct ServerInfo {
    pub id: String,
    pub name: Option<String>,
    pub platform: Option<String>,
    pub last_seen_at: String,
}

#[derive(Debug, Serialize)]
pub struct ServersResponse {
    pub ok: bool,
    pub servers: Vec<ServerInfo>,
}

/// GET /dashboard/servers
///
/// Returns all registered servers.
pub async fn get_servers(State(state): State<AppState>) -> Result<Json<ServersResponse>, ApiError> {
    let rows: Vec<(
        String,
        Option<String>,
        Option<String>,
        chrono::DateTime<chrono::Utc>,
    )> = sqlx::query_as(
        "SELECT id, name, platform, last_seen_at FROM public.servers ORDER BY last_seen_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("get servers failed: {:?}", e);
        ApiError::Internal
    })?;

    let servers = rows
        .into_iter()
        .map(|(id, name, platform, last_seen_at)| ServerInfo {
            id,
            name,
            platform,
            last_seen_at: last_seen_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(ServersResponse { ok: true, servers }))
}
