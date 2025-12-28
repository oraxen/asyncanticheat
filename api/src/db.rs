use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(10))
        .connect(database_url)
        .await
}

/// Best-effort schema migrations that keep the service runnable against an older DB.
///
/// This repo doesn't use a full migration framework yet, so we do minimal `ALTER TABLE ... IF NOT EXISTS`
/// at startup to add the columns required for registration/ownership.
pub async fn migrate(db: &PgPool) -> Result<(), sqlx::Error> {
    // Servers: registration / ownership.
    sqlx::query(
        r#"
        alter table public.servers
            add column if not exists auth_token_hash text;
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        alter table public.servers
            add column if not exists auth_token_first_seen_at timestamptz;
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        alter table public.servers
            add column if not exists owner_user_id uuid;
        "#,
    )
    .execute(db)
    .await?;

    sqlx::query(
        r#"
        alter table public.servers
            add column if not exists registered_at timestamptz;
        "#,
    )
    .execute(db)
    .await?;

    Ok(())
}
