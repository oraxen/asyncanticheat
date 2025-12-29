# AsyncAnticheat Monorepo

## Overview

Unified repository containing all AsyncAnticheat components:

| Directory | Tech Stack | Purpose |
|-----------|------------|---------|
| `plugin/` | Java 21, Gradle, PacketEvents, Hopper | Minecraft plugin - captures packets |
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
- **Web env**: `web/.env.local` - sync from Vercel (see below)

### Vercel Environment Sync (Web)

The `web/` app is linked to Vercel project `lfglabs/asyncanticheat.com`. To sync environment variables:

```bash
cd web

# Link to project (if not already linked)
vercel link --project asyncanticheat.com --yes

# Pull development env vars
vercel env pull .env.local

# Pull production env vars
vercel env pull .env.production.local --environment production --yes
```

Requires being logged in as `th0rgal` or having access to the `lfglabs` scope.

## Project-Specific Details

### Plugin (`plugin/`)
- **Build**: `./gradlew build`
- **Modules**: `core/` (shared logic), `bukkit/` (Paper/Spigot entry)
- **Version**: Set in `plugin/gradle.properties`
- **PacketEvents**: Downloaded automatically at runtime via [Hopper](https://github.com/oraxen/hopper)
- **Hopper**: Runtime dependency downloader (shaded into JAR, relocated)
- **Note**: First server start downloads PacketEvents and may require a restart

### API (`api/`)
- **Database**: PostgreSQL (schema in `api/schema.sql`)
- **Routes**: `api/src/routes/` - ingest, callbacks, dashboard
- **Deployment**: Dedicated server at 95.216.244.60

#### Build Profiles

| Profile | Command | Time | Use Case |
|---------|---------|------|----------|
| `dev-release` | `cargo build --profile dev-release` | ~30s | Testing, iteration, quick fixes |
| `release` | `cargo build --release` | ~5min | Production, final deployment |

**When to use each:**
- **dev-release**: Use for all development testing, debugging, and iteration. The performance difference is minimal for most workloads.
- **release**: Use only for final production deployments or performance-critical testing.

#### Deployment Commands

```bash
cd api

# Fast deploy for testing (dev-release profile)
make deploy

# Production deploy (full optimization, ~5 min build)
make deploy-prod

# Other useful commands
make restart    # Restart the service without rebuilding
make logs       # Follow live logs
make status     # Check service status
```

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

## Contributing

### Monorepo Components (plugin/, api/, web/)

Changes to `plugin/`, `api/`, or `web/` are committed directly to this repository:

```bash
# Make changes
git add plugin/... api/... web/...
git commit -m "feat: your changes"
git push origin your-branch
# Create PR against master on oraxen/asyncanticheat
```

### Detection Modules (modules/ submodule)

The `modules/` directory is a **git submodule** pointing to `lfglabs-dev/aac-modules`.
Changes must be made in the submodule first, then the reference updated:

```bash
# 1. Enter the submodule
cd modules

# 2. Create a branch and make changes
git checkout -b feat/your-feature
# ... make changes ...
git add .
git commit -m "feat: your module changes"

# 3. Push to the modules repo
git push origin feat/your-feature
# Create PR against master on lfglabs-dev/aac-modules

# 4. After PR is merged, update the submodule reference in the parent
cd ..  # back to monorepo root
git pull --recurse-submodules
git add modules
git commit -m "chore: update modules submodule"
git push
```

### Repository Links

| Component | Repository | PR Target |
|-----------|------------|-----------|
| plugin/, api/, web/ | `oraxen/asyncanticheat` | `master` |
| modules/ | `lfglabs-dev/aac-modules` | `master` |

## AI Agent Guidelines

1. **Scope changes**: Work within one directory when possible
2. **Cross-cutting changes**: Update all affected projects together
3. **Avoid generated dirs**: `**/build/`, `**/target/`, `**/node_modules/`, `**/.next/`
4. **Use correct package manager**: Gradle for plugin, Cargo for api/modules, Bun for web
5. **Never commit secrets**: Always read from environment variables
6. **Submodule workflow**: If modifying modules, commit in submodule first, push to `lfglabs-dev/aac-modules`, then update submodule ref in parent

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
