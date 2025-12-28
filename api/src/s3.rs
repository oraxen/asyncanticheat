//! S3-compatible object storage client for storing raw packet batches.
//!
//! Batches are stored with the following key structure:
//!   events/{server_id}/{date}/{session_id}/{batch_id}.ndjson.gz
//!
//! This layout enables:
//! - Easy per-server lifecycle rules (e.g. delete after 30 days)
//! - Efficient prefix listing for a server's events in a time range
//! - Session-level grouping for replay/debugging

use chrono::Utc;
use s3::creds::Credentials;
use s3::region::Region;
use s3::Bucket;
use std::path::PathBuf;

use crate::config::Config;

/// Object storage backend for raw batches.
#[derive(Clone)]
pub enum ObjectStore {
    S3 { bucket: Box<Bucket> },
    Local { root: PathBuf },
}

impl ObjectStore {
    /// Build an ObjectStore from environment config.
    pub fn from_config(cfg: &Config) -> anyhow::Result<Self> {
        if cfg.s3_bucket.trim().is_empty() {
            return Ok(Self::Local {
                root: PathBuf::from(cfg.local_store_dir.clone()),
            });
        }

        let use_path_style = cfg.s3_endpoint.is_some(); // Only use path-style for custom endpoints (MinIO, etc.)
        
        let region = if let Some(ref endpoint) = cfg.s3_endpoint {
            Region::Custom {
                region: cfg.s3_region.clone(),
                endpoint: endpoint.clone(),
            }
        } else {
            cfg.s3_region.parse().unwrap_or(Region::UsEast1)
        };

        let credentials = if let (Some(ref access_key), Some(ref secret_key)) =
            (&cfg.s3_access_key, &cfg.s3_secret_key)
        {
            Credentials::new(Some(access_key), Some(secret_key), None, None, None)?
        } else {
            // Try to load from environment / instance metadata
            Credentials::default()?
        };

        let bucket = Bucket::new(&cfg.s3_bucket, region, credentials)?;
        // Only use path-style addressing for custom endpoints (like MinIO)
        // AWS S3 prefers virtual-hosted style
        let bucket = if use_path_style {
            bucket.with_path_style()
        } else {
            bucket
        };
        Ok(Self::S3 { bucket })
    }

    /// Generate the S3 object key for a batch.
    ///
    /// Format: `events/{server_id}/{YYYY-MM-DD}/{session_id}/{batch_id}.ndjson.gz`
    pub fn batch_key(server_id: &str, session_id: &str, batch_id: &uuid::Uuid) -> String {
        let date = Utc::now().format("%Y-%m-%d");
        format!(
            "events/{}/{}/{}/{}.ndjson.gz",
            server_id, date, session_id, batch_id
        )
    }

    /// Upload a gzipped NDJSON batch to object storage.
    ///
    /// Returns the object key on success.
    pub async fn put_batch(
        &self,
        server_id: &str,
        session_id: &str,
        batch_id: &uuid::Uuid,
        data: Vec<u8>,
    ) -> anyhow::Result<String> {
        let key = Self::batch_key(server_id, session_id, batch_id);

        match self {
            ObjectStore::S3 { bucket } => {
                bucket
                    .put_object_with_content_type(&key, &data, "application/x-ndjson")
                    .await?;
                Ok(key)
            }
            ObjectStore::Local { root } => {
                let full_path = root.join(&key);
                if let Some(parent) = full_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                tokio::fs::write(&full_path, data).await?;
                Ok(key)
            }
        }
    }

    /// Retrieve a batch from object storage (for replay/debugging).
    #[allow(dead_code)]
    pub async fn get_batch(&self, key: &str) -> anyhow::Result<Vec<u8>> {
        match self {
            ObjectStore::S3 { bucket } => {
                let response = bucket.get_object(key).await?;
                Ok(response.to_vec())
            }
            ObjectStore::Local { root } => {
                let full_path = root.join(key);
                let bytes = tokio::fs::read(&full_path).await?;
                Ok(bytes)
            }
        }
    }
}
