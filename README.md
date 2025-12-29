<p align="center">
  <a href="https://asyncanticheat.com">
    <img src="web/public/icon-512.png" alt="AsyncAnticheat" width="200">
  </a>
</p>

<h1 align="center">AsyncAnticheat</h1>

<p align="center">
  Cloud-based anticheat with zero server performance impact
</p>

<p align="center">
  <a href="https://asyncanticheat.com">Website</a>
  •
  <a href="https://asyncanticheat.com/docs">Documentation</a>
  •
  <a href="https://github.com/oraxen/asyncanticheat/releases">Releases</a>
</p>

---

## Why Async?

Traditional anticheats run detection logic on your game server, consuming CPU cycles that should go to your players. Every tick spent on cheat detection is a tick not spent on gameplay.

AsyncAnticheat takes a different approach: the plugin captures packets and sends them to external infrastructure for analysis. Detection happens asynchronously in the cloud, returning findings to your dashboard without touching your server's TPS.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Game Server    │     │   Ingestion     │     │   Detection     │
│                 │     │   API (Rust)    │     │   Modules       │
│  ┌───────────┐  │     │                 │     │                 │
│  │ AsyncAC   │──┼────▶│  /ingest        │────▶│  Movement       │
│  │ Plugin    │  │     │                 │     │  Combat         │
│  └───────────┘  │     │  Object Store   │     │  Player         │
│                 │     │  + PostgreSQL   │     │                 │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 │    ┌─────────────┐    │
                                 └───▶│  Dashboard  │◀───┘
                                      │  (Next.js)  │
                                      └─────────────┘
```

**Plugin** captures packets using [PacketEvents](https://github.com/retrooper/packetevents) and batches them for transmission.

**API** receives packet batches, stores them, and dispatches to detection modules.

**Modules** analyze packets asynchronously and report findings back to the API.

**Dashboard** displays detections, player history, and server analytics in real-time.

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Plugin | Java 21, PacketEvents | Packet capture, minimal footprint |
| API | Rust, Axum, PostgreSQL | High-throughput ingestion |
| Dashboard | Next.js 15, React 19 | Real-time monitoring |
| Modules | Rust | Detection algorithms |

## Supported Platforms

| Platform | Versions |
|----------|----------|
| Paper | 1.8 - 1.21+ |
| Spigot | 1.8 - 1.21+ |
| Folia | 1.19.4+ |

## Getting Started

1. Download the latest JAR from [Releases](https://github.com/oraxen/asyncanticheat/releases)
2. Place in your server's `plugins/` folder
3. Restart and configure `plugins/AsyncAnticheat/config.yml` with your API key
4. View detections at [asyncanticheat.com/dashboard](https://asyncanticheat.com/dashboard)

Full setup guide: [asyncanticheat.com/docs](https://asyncanticheat.com/docs)

## Repository Structure

```
├── plugin/     # Minecraft plugin (Java, Gradle)
├── api/        # Ingestion API (Rust, Axum)
├── web/        # Website & dashboard (Next.js)
└── modules/    # Detection modules (Git submodule)
```

## Development

```bash
# Plugin
cd plugin && ./gradlew build

# API
cd api && cargo build

# Web
cd web && bun install && bun dev
```

## Contributing

Issues and pull requests welcome. See the documentation for module development guidelines.

## License

[Async Anticheat License](LICENSE.md) - Source available, not open source.

---

<p align="center">
  <a href="https://github.com/oraxen/oraxen">Oraxen</a>
  •
  <a href="https://github.com/oraxen/HackedServer">HackedServer</a>
  •
  <a href="https://github.com/Th0rgal/hephaistos">Hephaistos</a>
  •
  <a href="https://github.com/Th0rgal/sphinx">Sphinx</a>
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/Th0rgal">Th0rgal</a>
</p>
