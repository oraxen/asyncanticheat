pub mod config;
pub mod db;
pub mod error;
pub mod module_pipeline;
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
}


