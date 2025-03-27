# Async Anticheat API

Rust HTTP ingestion service for `async_anticheat` packet batches.

## Endpoints

- `GET /health`: health check
- `POST /ingest`: ingest a **gzipped NDJSON** batch (raw stored in object storage, metadata in Postgres)
- `POST /servers/:server_id/modules`: register/update module subscription for a server
- `GET /servers/:server_id/modules`: list module subscriptions for a server
- `POST /callbacks/findings`: receive findings from modules (stored in Postgres)

### Auth

`POST /ingest` requires:

- Header: `Authorization: Bearer <INGEST_TOKEN>`
- Header: `X-Server-Id: <uuid-or-string>`
- Header: `X-Session-Id: <uuid-or-string>`

`POST /callbacks/findings` requires:

- Header: `Authorization: Bearer <MODULE_CALLBACK_TOKEN>`

## Setup

1. Copy env file:

```bash
cp env.example .env
```

2. Apply schema (see `schema.sql`) to your Postgres database.

3. Run:

```bash
cargo run
```

## Local end-to-end test

If you have Docker/OrbStack running:

```bash
./scripts/e2e_local.sh
```


