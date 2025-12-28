use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub ingest_token: String,
    pub module_callback_token: String,
    pub dashboard_token: Option<String>,
    pub module_healthcheck_interval_seconds: u64,
    pub max_body_bytes: usize,
    // Object store cleanup (TTL)
    pub object_store_cleanup_enabled: bool,
    pub object_store_cleanup_dry_run: bool,
    pub object_store_cleanup_interval_seconds: u64,
    pub object_store_ttl_days: i64,
    pub object_store_ttl_seconds_override: Option<i64>,
    pub batch_index_ttl_days: i64,
    pub batch_index_ttl_seconds_override: Option<i64>,
    // S3-compatible object storage
    pub s3_bucket: String,
    pub s3_region: String,
    pub s3_endpoint: Option<String>, // For MinIO / Supabase Storage / R2 / etc.
    pub s3_access_key: Option<String>,
    pub s3_secret_key: Option<String>,
    // Local object storage fallback (used when S3_BUCKET is empty)
    pub local_store_dir: String,
    // CORS
    pub cors_allow_origins: Vec<String>,
    /// Explicitly opt-in to permissive CORS (for development only).
    /// SECURITY: Must be explicitly set to true; defaults to false.
    pub cors_permissive_dev: bool,
}

fn parse_bool_env(key: &str, default: bool) -> bool {
    match env::var(key) {
        Ok(v) => match v.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "y" | "on" => true,
            "0" | "false" | "no" | "n" | "off" => false,
            _ => default,
        },
        Err(_) => default,
    }
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
        let dashboard_token = env::var("DASHBOARD_TOKEN")
            .ok()
            .filter(|v| !v.trim().is_empty());

        let module_healthcheck_interval_seconds = env::var("MODULE_HEALTHCHECK_INTERVAL_SECONDS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(10);

        let max_body_bytes = env::var("MAX_BODY_BYTES")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(10 * 1024 * 1024);

        // Object store cleanup settings
        // Defaults are conservative: disabled unless explicitly enabled.
        let object_store_cleanup_enabled = parse_bool_env("OBJECT_STORE_CLEANUP_ENABLED", false);
        let object_store_cleanup_dry_run = parse_bool_env("OBJECT_STORE_CLEANUP_DRY_RUN", true);
        let object_store_cleanup_interval_seconds =
            env::var("OBJECT_STORE_CLEANUP_INTERVAL_SECONDS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(60 * 60); // hourly

        // TTL in days for raw objects and batch_index metadata.
        // If not provided, defaults to 7 days (reasonable for local disk).
        let object_store_ttl_days = env::var("OBJECT_STORE_TTL_DAYS")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(7)
            .max(1);

        // Optional: override TTL with seconds (useful for testing / fine-grained cleanup).
        let object_store_ttl_seconds_override = env::var("OBJECT_STORE_TTL_SECONDS")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .and_then(|v| if v > 0 { Some(v) } else { None });

        let batch_index_ttl_days = env::var("BATCH_INDEX_TTL_DAYS")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(object_store_ttl_days)
            .max(1);

        let batch_index_ttl_seconds_override = env::var("BATCH_INDEX_TTL_SECONDS")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .and_then(|v| if v > 0 { Some(v) } else { None });

        // S3 settings
        // Empty bucket means "use LOCAL_STORE_DIR" (handy for local dev + tests).
        let s3_bucket = env::var("S3_BUCKET").unwrap_or_default();
        let s3_region = env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());
        let s3_endpoint = env::var("S3_ENDPOINT").ok();
        let s3_access_key = env::var("S3_ACCESS_KEY").ok();
        let s3_secret_key = env::var("S3_SECRET_KEY").ok();
        let local_store_dir =
            env::var("LOCAL_STORE_DIR").unwrap_or_else(|_| "./data/object_store".to_string());

        // Comma-separated list of allowed origins.
        let cors_allow_origins = env::var("CORS_ALLOW_ORIGINS")
            .map(|v| {
                v.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        // SECURITY: Permissive CORS must be explicitly enabled. Defaults to false.
        let cors_permissive_dev = parse_bool_env("CORS_PERMISSIVE_DEV", false);

        Self {
            host,
            port,
            database_url,
            ingest_token,
            module_callback_token,
            dashboard_token,
            module_healthcheck_interval_seconds,
            max_body_bytes,
            object_store_cleanup_enabled,
            object_store_cleanup_dry_run,
            object_store_cleanup_interval_seconds,
            object_store_ttl_days,
            object_store_ttl_seconds_override,
            batch_index_ttl_days,
            batch_index_ttl_seconds_override,
            s3_bucket,
            s3_region,
            s3_endpoint,
            s3_access_key,
            s3_secret_key,
            local_store_dir,
            cors_allow_origins,
            cors_permissive_dev,
        }
    }
}
