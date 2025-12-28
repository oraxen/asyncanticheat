use chrono::{Duration, Utc};
use std::path::{Path, PathBuf};

use crate::{s3::ObjectStore, AppState};

#[derive(Debug, Default, Clone)]
pub struct CleanupStats {
    pub files_examined: u64,
    pub files_deleted: u64,
    pub bytes_deleted: u64,
    pub dirs_removed: u64,
    pub db_rows_deleted: u64,
}

pub async fn cleanup_tick(state: AppState) {
    if !state.object_store_cleanup_enabled {
        return;
    }

    let now = Utc::now();
    let object_cutoff = now
        - match state.object_store_ttl_seconds_override {
            Some(s) => Duration::seconds(s.max(60)),
            None => Duration::days(state.object_store_ttl_days.max(1)),
        };

    let batch_index_cutoff = now
        - match state.batch_index_ttl_seconds_override {
            Some(s) => Duration::seconds(s.max(60)),
            None => Duration::days(state.batch_index_ttl_days.max(1)),
        };

    // 1) Object store cleanup (raw batches)
    let mut stats = match &state.object_store {
        ObjectStore::Local { root } => {
            cleanup_local_store(
                root.clone(),
                object_cutoff,
                state.object_store_cleanup_dry_run,
            )
            .await
        }
        ObjectStore::S3 { .. } => {
            // For S3/R2/etc. the preferred approach is bucket lifecycle rules.
            tracing::info!(
                dry_run = state.object_store_cleanup_dry_run,
                ttl_days = state.object_store_ttl_days,
                "object store cleanup enabled but backend is S3; skipping object deletion (use bucket lifecycle rules)"
            );
            Ok(CleanupStats::default())
        }
    };

    // 2) DB cleanup (batch_index rows)
    // Keep this aligned with object retention to avoid the DB growing unbounded.
    match cleanup_batch_index(
        &state,
        batch_index_cutoff,
        state.object_store_cleanup_dry_run,
    )
    .await
    {
        Ok(rows) => {
            if let Ok(ref mut s) = stats {
                s.db_rows_deleted = rows;
            }
        }
        Err(e) => {
            tracing::warn!("batch_index cleanup failed: {:?}", e);
        }
    }

    match stats {
        Ok(s) => {
            tracing::info!(
                dry_run = state.object_store_cleanup_dry_run,
                object_ttl_days = state.object_store_ttl_days,
                batch_index_ttl_days = state.batch_index_ttl_days,
                files_examined = s.files_examined,
                files_deleted = s.files_deleted,
                bytes_deleted = s.bytes_deleted,
                dirs_removed = s.dirs_removed,
                db_rows_deleted = s.db_rows_deleted,
                "object store cleanup tick completed"
            );
        }
        Err(e) => {
            tracing::warn!("object store cleanup failed: {:?}", e);
        }
    }
}

async fn cleanup_batch_index(
    state: &AppState,
    cutoff: chrono::DateTime<chrono::Utc>,
    dry_run: bool,
) -> anyhow::Result<u64> {
    if dry_run {
        let (count,): (i64,) =
            sqlx::query_as("select count(*) from public.batch_index where received_at < $1")
                .bind(cutoff)
                .fetch_one(&state.db)
                .await
                .unwrap_or((0,));
        return Ok(count.max(0) as u64);
    }

    let res = sqlx::query("delete from public.batch_index where received_at < $1")
        .bind(cutoff)
        .execute(&state.db)
        .await?;
    Ok(res.rows_affected())
}

async fn cleanup_local_store(
    root: PathBuf,
    cutoff: chrono::DateTime<chrono::Utc>,
    dry_run: bool,
) -> anyhow::Result<CleanupStats> {
    tokio::task::spawn_blocking(move || cleanup_local_store_blocking(&root, cutoff, dry_run))
        .await?
}

fn cleanup_local_store_blocking(
    root: &Path,
    cutoff: chrono::DateTime<chrono::Utc>,
    dry_run: bool,
) -> anyhow::Result<CleanupStats> {
    let mut stats = CleanupStats::default();
    let events_root = root.join("events");
    if !events_root.exists() {
        return Ok(stats);
    }

    fn recurse_dir(
        dir: &Path,
        cutoff: chrono::DateTime<chrono::Utc>,
        dry_run: bool,
        stats: &mut CleanupStats,
    ) -> anyhow::Result<bool> {
        let mut is_empty = true;
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let meta = entry.metadata()?;

            if meta.is_dir() {
                let child_empty = recurse_dir(&path, cutoff, dry_run, stats)?;
                if child_empty && !dry_run {
                    // Best-effort remove empty dir
                    if std::fs::remove_dir(&path).is_ok() {
                        stats.dirs_removed += 1;
                    } else {
                        is_empty = false;
                    }
                } else if !child_empty {
                    is_empty = false;
                }
                continue;
            }

            if meta.is_file() {
                stats.files_examined += 1;
                // If we can't read mtime, use current time so the file is kept (not deleted).
                let modified_dt: chrono::DateTime<chrono::Utc> = meta
                    .modified()
                    .map(|m| chrono::DateTime::<chrono::Utc>::from(m))
                    .unwrap_or_else(|_| chrono::Utc::now());

                if modified_dt < cutoff {
                    let len = meta.len();
                    if !dry_run {
                        if std::fs::remove_file(&path).is_ok() {
                            stats.files_deleted += 1;
                            stats.bytes_deleted += len;
                        } else {
                            is_empty = false;
                        }
                    } else {
                        stats.files_deleted += 1;
                        stats.bytes_deleted += len;
                    }
                } else {
                    is_empty = false;
                }
            }
        }
        Ok(is_empty)
    }

    // Recurse and attempt to prune empty directories.
    let _ = recurse_dir(&events_root, cutoff, dry_run, &mut stats)?;
    Ok(stats)
}
