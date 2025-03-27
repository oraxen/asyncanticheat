use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub ingest_token: String,
    pub module_callback_token: String,
    pub module_healthcheck_interval_seconds: u64,
    pub max_body_bytes: usize,
    // S3-compatible object storage
    pub s3_bucket: String,
    pub s3_region: String,
    pub s3_endpoint: Option<String>, // For MinIO / Supabase Storage / R2 / etc.
    pub s3_access_key: Option<String>,
    pub s3_secret_key: Option<String>,
    // Local object storage fallback (used when S3_BUCKET is empty)
    pub local_store_dir: String,
}

impl Config {
    pub fn from_env() -> Self {
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(3002);

        let database_url = env::var("DATABASE_URL").unwrap_or_default();
        let ingest_token = env::var("INGEST_TOKEN").unwrap_or_default();
        let module_callback_token = env::var("MODULE_CALLBACK_TOKEN").unwrap_or_default();

        let module_healthcheck_interval_seconds = env::var("MODULE_HEALTHCHECK_INTERVAL_SECONDS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(10);

        let max_body_bytes = env::var("MAX_BODY_BYTES")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(10 * 1024 * 1024);

        // S3 settings
        // Empty bucket means "use LOCAL_STORE_DIR" (handy for local dev + tests).
        let s3_bucket = env::var("S3_BUCKET").unwrap_or_default();
        let s3_region = env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());
        let s3_endpoint = env::var("S3_ENDPOINT").ok();
        let s3_access_key = env::var("S3_ACCESS_KEY").ok();
        let s3_secret_key = env::var("S3_SECRET_KEY").ok();
        let local_store_dir =
            env::var("LOCAL_STORE_DIR").unwrap_or_else(|_| "./data/object_store".to_string());

        Self {
            host,
            port,
            database_url,
            ingest_token,
            module_callback_token,
            module_healthcheck_interval_seconds,
            max_body_bytes,
            s3_bucket,
            s3_region,
            s3_endpoint,
            s3_access_key,
            s3_secret_key,
            local_store_dir,
        }
    }
}
