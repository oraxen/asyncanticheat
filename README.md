# Async Anticheat API

Rust HTTP ingestion service for `async_anticheat` packet batches with modular cheat detection.

## Architecture

The API receives packet batches from Minecraft servers and dispatches them to category-based detection modules:

```
Minecraft Server → Plugin → API → [Combat/Movement/Player Modules] → Findings → Dashboard
```

## Detection Modules

Three category-based modules provide comprehensive cheat detection:

| Module | Port | Checks |
|--------|------|--------|
| **Combat Module** | 4021 | KillAura, Aim, AutoClicker, Reach, NoSwing |
| **Movement Module** | 4022 | Flight, Speed, NoFall, Timer, Step, GroundSpoof, Velocity, NoSlow |
| **Player Module** | 4023 | BadPackets, Scaffold, FastPlace, FastBreak, Interact, Inventory |

See `docs/MODULES.md` for the module protocol and default ports.

## API Endpoints

- `GET /health`: health check
- `POST /ingest`: ingest a **gzipped NDJSON** batch (raw stored in object storage, metadata in Postgres)
- `POST /servers/:server_id/modules`: register/update module subscription for a server
- `GET /servers/:server_id/modules`: list module subscriptions for a server
- `POST /callbacks/findings`: receive findings from modules (stored in Postgres)
- `POST /callbacks/player-states/batch-get`: retrieve player states for modules
- `POST /callbacks/player-states/batch-set`: store player states from modules

### Auth

`POST /ingest` requires:

- Header: `Authorization: Bearer <INGEST_TOKEN>`
- Header: `X-Server-Id: <uuid-or-string>`
- Header: `X-Session-Id: <uuid-or-string>`

`POST /callbacks/*` requires:

- Header: `Authorization: Bearer <MODULE_CALLBACK_TOKEN>`

## Setup

1. Copy env file:

```bash
cp env.example .env
```

2. Apply schema (see `schema.sql`) to your Postgres database.

3. Run the API:

```bash
cargo run
```

4. Run detection modules (separate services):

This repo intentionally does not version the module implementations under `modules/`.
Point your `server_modules` entries at your module services (defaults: 4021/4022/4023).


## Local end-to-end test

If you have Docker/OrbStack running:

```bash
./scripts/e2e_local.sh
```


