# Async Anticheat API

Rust HTTP ingestion service for `async_anticheat` packet batches with modular cheat detection.

## Architecture

The API receives packet batches from Minecraft servers and dispatches them to tiered detection modules (Core + Advanced):

```
Minecraft Server → Plugin → API → [Core/Advanced Modules] → Findings → Dashboard
```

## Detection Modules

Six tiered modules provide comprehensive cheat detection:

| Module | Port | Tier | Checks |
|--------|------|------|--------|
| **Movement Core** | 4030 | Core | Flight (ascend), Speed (blatant), NoFall, GroundSpoof |
| **Movement Advanced** | 4031 | Advanced | Flight (Y prediction, hover), Speed, Timer, Step, NoSlow |
| **Combat Core** | 4032 | Core | AutoClicker (CPS), Reach (critical), KillAura (multi-target), NoSwing |
| **Combat Advanced** | 4033 | Advanced | Aim analysis, AutoClicker statistics, KillAura (post), Reach accumulation |
| **Player Core** | 4034 | Core | BadPackets, FastPlace/Break (critical), Scaffold (airborne) |
| **Player Advanced** | 4035 | Advanced | Inventory, Interact angles, FastPlace/Break (accumulation), Scaffold (sprint) |

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

This repo includes module implementations under `modules/`.
By default, the API will auto-create `server_modules` entries for the tiered modules above (4030-4035) when it first sees a server.


## Local end-to-end test

If you have Docker/OrbStack running:

```bash
./scripts/e2e_local.sh
```


