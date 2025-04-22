use axum::{routing::get, Router};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

use async_anticheat_api::{config::Config, db, module_pipeline, routes, s3::ObjectStore, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cfg = Config::from_env();
    if cfg.database_url.is_empty() {
        tracing::warn!("DATABASE_URL is empty; the service will fail when ingesting.");
    }
    if cfg.ingest_token.is_empty() {
        tracing::warn!("INGEST_TOKEN is empty; all ingest requests will be rejected.");
    }
    if cfg.s3_bucket.is_empty() {
        tracing::warn!(
            "S3_BUCKET is empty; using LOCAL_STORE_DIR={} for raw batch storage.",
            cfg.local_store_dir
        );
    }
    if cfg.module_callback_token.is_empty() {
        tracing::warn!("MODULE_CALLBACK_TOKEN is empty; module callbacks will be rejected.");
    }

    let db = db::connect(&cfg.database_url).await?;
    let object_store = ObjectStore::from_config(&cfg).expect("Failed to initialize object store");
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to build HTTP client");

    let state = AppState {
        db,
        object_store,
        ingest_token: cfg.ingest_token,
        module_callback_token: cfg.module_callback_token,
        http,
        max_body_bytes: cfg.max_body_bytes,
    };

    // Background: module health checks ("check modules" system)
    {
        let health_state = state.clone();
        let interval_seconds = cfg.module_healthcheck_interval_seconds.max(1);
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_seconds));
            loop {
                ticker.tick().await;
                module_pipeline::healthcheck_tick(health_state.clone()).await;
            }
        });
    }

    let app = Router::new()
        .route("/health", get(routes::health::health))
        .route("/ingest", axum::routing::post(routes::ingest::ingest))
        .route(
            "/servers/:server_id/modules",
            axum::routing::post(routes::modules::upsert_module)
                .get(routes::modules::list_modules),
        )
        .route(
            "/callbacks/findings",
            axum::routing::post(routes::callbacks::post_findings),
        )
        // Module state persistence endpoints
        .route(
            "/callbacks/player-state",
            axum::routing::get(routes::callbacks::get_player_state)
                .post(routes::callbacks::set_player_state),
        )
        .route(
            "/callbacks/player-states/batch-get",
            axum::routing::post(routes::callbacks::batch_get_player_states),
        )
        .route(
            "/callbacks/player-states/batch-set",
            axum::routing::post(routes::callbacks::batch_set_player_states),
        )
        // Dashboard API endpoints
        .route(
            "/dashboard/servers",
            get(routes::dashboard::get_servers),
        )
        .route(
            "/dashboard/:server_id/stats",
            get(routes::dashboard::get_stats),
        )
        .route(
            "/dashboard/:server_id/findings",
            get(routes::dashboard::get_findings),
        )
        .route(
            "/dashboard/:server_id/players",
            get(routes::dashboard::get_players),
        )
        .route(
            "/dashboard/:server_id/modules",
            get(routes::dashboard::get_modules),
        )
        .route(
            "/dashboard/:server_id/modules/:module_id/toggle",
            axum::routing::post(routes::dashboard::toggle_module),
        )
        .route(
            "/dashboard/:server_id/status",
            get(routes::dashboard::get_status),
        )
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = format!("{}:{}", cfg.host, cfg.port).parse()?;
    tracing::info!("async_anticheat_api listening on {}", addr);

    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}


