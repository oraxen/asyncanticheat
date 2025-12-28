# AsyncAnticheat Monorepo

## Overview

Unified repository containing all AsyncAnticheat components:

| Directory | Tech Stack | Purpose |
|-----------|------------|---------|
| `plugin/` | Java 21, Gradle, PacketEvents | Minecraft plugin - captures packets |
| `api/` | Rust, Axum, PostgreSQL | Ingestion API - stores batches, dispatches to modules |
| `web/` | Next.js 16, React 19, Bun | Website, dashboard, documentation |
| `modules/` | Rust (submodule) | Detection modules - analyze packets |

## Commands

### Plugin
```bash
cd plugin && ./gradlew build
# Output: plugin/build/libs/async-anticheat-<version>.jar
```

### API
```bash
cd api && cargo run
# Requires .env with DATABASE_URL
```

### Web
```bash
cd web && bun install && bun dev
# Runs on http://localhost:3000
```

### Modules (submodule)
```bash
git submodule update --init --recursive
cd modules/<module_name> && cargo build --release
```

## Architecture

```
Player -> Plugin (captures packets)
            |
            v
       API /ingest
            |
            v
    Object Store + batch_index
            |
            v
    Dispatch to Modules /ingest
            |
            v
    Module analyzes packets
            |
            v
    Module -> API /callbacks/findings
            |
            v
    Dashboard displays findings
```

## Environment

- **Secrets**: `~/minecraft/secrets.json` (jq-friendly JSON with all credentials)
- **Plugin config**: Auto-generated `config.yml` in plugin data folder
- **API env**: `api/.env` (copy from `api/env.example`)
- **Web env**: `web/.env.local` (copy from `web/.env.example`)

## Project-Specific Details

### Plugin (`plugin/`)
- **Build**: `./gradlew build`
- **Modules**: `core/` (shared logic), `bukkit/` (Paper/Spigot entry)
- **Version**: Set in `plugin/gradle.properties`
- **PacketEvents**: Shaded into JAR, no separate installation needed

### API (`api/`)
- **Build**: `cargo build --release`
- **Database**: PostgreSQL (schema in `api/schema.sql`)
- **Routes**: `api/src/routes/` - ingest, callbacks, dashboard
- **Deployment**: Dedicated server at 95.216.244.60

### Web (`web/`)
- **Build**: `bun run build`
- **Framework**: Next.js 16 with App Router
- **Auth**: Supabase
- **Docs**: Nextra MDX in `web/content/`
- **Deployment**: Vercel auto-deploy from main

### Modules (`modules/`)
- **Type**: Git submodule from `lfglabs-dev/aac-modules`
- **Contents**: 6 Rust detection modules (movement, combat, player - core & advanced)
- **Ports**: 4030-4035

## AI Agent Guidelines

1. **Scope changes**: Work within one directory when possible
2. **Cross-cutting changes**: Update all affected projects together
3. **Avoid generated dirs**: `**/build/`, `**/target/`, `**/node_modules/`, `**/.next/`
4. **Use correct package manager**: Gradle for plugin, Cargo for api/modules, Bun for web
5. **Never commit secrets**: Always read from environment variables
6. **Submodule changes**: If modifying modules, commit there first, then update submodule ref

## Testing

```bash
# Plugin
cd plugin && ./gradlew build

# API
cd api && cargo check

# Web
cd web && bun install && bun run lint

# Modules
cd modules/movement_core_module && cargo check
```
