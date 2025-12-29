<p align="center">
  <a href="https://asyncanticheat.com">
    <img src="web/public/icon-512.png" alt="AsyncAnticheat" width="200">
  </a>
</p>

<h1 align="center">AsyncAnticheat</h1>

<p align="center">
  Cloud-based anticheat engineered for zero in-server performance impact
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

Traditional anticheats run on the game server and compete with gameplay for CPU time. Each tick spent on detection is a tick not spent on players.

AsyncAnticheat keeps detection off-server: the plugin captures packets and streams them to the ingestion API for analysis. Detections run asynchronously in the cloud and feed results back to the dashboard without impacting TPS.

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

**Plugin** captures packets with [PacketEvents](https://github.com/retrooper/packetevents) and batches them for transmission.

**API** receives packet batches, stores them, and dispatches them to detection modules.

**Modules** analyze packets asynchronously and report findings back to the API.

**Dashboard** displays detections, player history, and server analytics in real-time.

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Plugin | Java 21, PacketEvents, Hopper | Packet capture, minimal footprint |
| API | Rust, Axum, PostgreSQL | High-throughput ingestion and storage |
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
3. Start the server - [PacketEvents](https://github.com/retrooper/packetevents) will be downloaded automatically via [Hopper](https://github.com/oraxen/hopper)
4. Restart if prompted (only on first install when PacketEvents is downloaded)
5. Configure `plugins/AsyncAnticheat/config.yml` with your API key
6. View detections at [asyncanticheat.com/dashboard](https://asyncanticheat.com/dashboard)

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

[Async Anticheat License](LICENSE.md) - Source-available under the Async Anticheat License.

---

<p align="center">
  <a href="https://github.com/oraxen/oraxen">Oraxen</a>
  •
  <a href="https://github.com/oraxen/HackedServer">HackedServer</a>
  •
  <a href="https://mcserverjars.com/">MCServerJars</a>
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/Th0rgal">Th0rgal</a>
</p>
