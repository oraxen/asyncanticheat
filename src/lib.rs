pub mod config;
pub mod builtin_modules;
pub mod db;
pub mod error;
pub mod module_pipeline;
pub mod object_store_cleanup;
pub mod routes;
pub mod s3;
pub mod transforms;

use sqlx::PgPool;

use crate::s3::ObjectStore;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub object_store: ObjectStore,
    pub ingest_token: String,
    pub module_callback_token: String,
    pub http: reqwest::Client,
    pub max_body_bytes: usize,
    // Cleanup config
    pub object_store_cleanup_enabled: bool,
    pub object_store_cleanup_dry_run: bool,
    pub object_store_cleanup_interval_seconds: u64,
    pub object_store_ttl_days: i64,
    pub object_store_ttl_seconds_override: Option<i64>,
    pub batch_index_ttl_days: i64,
    pub batch_index_ttl_seconds_override: Option<i64>,
}


