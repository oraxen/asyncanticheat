# AsyncAnticheat

Multi-platform Minecraft anticheat with cloud-based async analysis.

## Repository Structure

```
asyncanticheat/
├── plugin/     # Java Minecraft plugin (Paper/Spigot)
├── api/        # Rust ingestion API (Axum)
├── web/        # Next.js website/dashboard/docs
└── modules/    # Detection modules (git submodule)
```

## Quick Start

### Plugin Development

```bash
cd plugin
./gradlew build
# Output: plugin/build/libs/async-anticheat-<version>.jar
```

**Requirements:** Java 21

### API Development

```bash
cd api
cp env.example .env
# Configure DATABASE_URL in .env
cargo run
```

**Requirements:** Rust toolchain, PostgreSQL

### Web Development

```bash
cd web
cp .env.example .env.local
# Configure Supabase keys in .env.local
bun install
bun dev
# Open http://localhost:3000
```

**Requirements:** Bun

### Detection Modules

```bash
# Initialize submodule
git submodule update --init

# Build a module
cd modules/movement_core_module
cargo build --release
```

## Configuration

Copy `secrets.json.example` to `~/minecraft/secrets.json` and configure values.
Each project has its own environment template - copy and configure as needed.

## Documentation

- **User docs:** [asyncanticheat.com/docs](https://asyncanticheat.com/docs)
- **API reference:** `api/docs/`
- **Module development:** `modules/README.md`

## Architecture

```
Player → Plugin (captures packets)
           ↓
       API /ingest
           ↓
    Object Store + batch_index
           ↓
    Dispatch to Detection Modules
           ↓
    Module analyzes packets
           ↓
    Module → API /callbacks/findings
           ↓
    Dashboard displays findings
```

## Deployment

| Component | Method |
|-----------|--------|
| Plugin | GitHub Releases |
| Web | Vercel (auto-deploy from main) |
| API | Dedicated server |
| Modules | Dedicated server |

## License

Proprietary - See LICENSE.md
