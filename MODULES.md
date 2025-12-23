# AsyncAnticheat Detection Modules

This document describes the detection modules available in AsyncAnticheat, their checks, and configuration.

---

## Overview

AsyncAnticheat uses a modular detection architecture where packet batches are dispatched from the central API to specialized detection modules. Each module focuses on a specific category of cheats.

### Currently Active Modules (Tiered)

| Module | Port | Tier | Description |
|--------|------|------|-------------|
| **Movement Core** | 4030 | Core | Flight ascend, blatant speed, nofall, groundspoof |
| **Movement Advanced** | 4031 | Advanced | Y-prediction, hover, timer, step, noslow |
| **Combat Core** | 4032 | Core | CPS, critical reach, multi-target, noswing |
| **Combat Advanced** | 4033 | Advanced | Aim stats, autoclicker stats, reach accumulation |
| **Player Core** | 4034 | Core | BadPackets, critical fastplace/break, airborne scaffold |
| **Player Advanced** | 4035 | Advanced | Inventory, interact angles, scaffold sprint |

---

## Movement Module

Detects movement-related cheats including flight, speed hacks, and physics violations.

### Flight Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Y Prediction** | `flight_yprediction` | Detects when Y movement doesn't follow gravity physics. Based on Alpha Flight A/B. |
| **Sustained Ascend** | `flight_ascend` | Detects upward movement lasting longer than a normal jump (~8 ticks). Based on Alpha Flight C. |
| **Hover** | `flight_hover` | Detects staying at the same Y level in air for too long. Based on Alpha Flight E. |
| **Glide** | `flight_glide` | Detects slow falling without proper conditions (elytra, slow falling effect). Based on Alpha Flight D. |
| **Sustained Air** | `flight_air` | Detects being in air for impossibly long (>25 ticks normal jump is ~12-15). |
| **Ground Spoof** | `flight_groundspoof` | Detects claiming `on_ground=true` while clearly falling. Based on Alpha GroundSpoof. |
| **Constant Motion** | `flight_constant` | Detects repeated identical Y delta values (sign of flight bypass). Based on Alpha Motion A. |
| **Invalid Jump** | `flight_jump` | Detects invalid jump velocity (expected ~0.42). Based on Alpha Jump A/B. |

### Speed Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Horizontal Speed** | `speed_horizontal` | Excessive horizontal movement speed |
| **Sprint Speed** | `speed_sprint` | Moving too fast while sprinting |
| **Sneak Speed** | `speed_sneak` | Moving too fast while sneaking |

### Other Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **NoFall** | `nofall_ground`, `nofall_damage` | Invalid ground claims, fake fall damage |
| **GroundSpoof** | `groundspoof_falling`, `groundspoof_ascending` | Claiming ground while falling/ascending |
| **Timer** | `timer_fast`, `timer_slow` | Game speed manipulation |
| **Step** | `step_height`, `step_noground` | Invalid step height |
| **Velocity** | `velocity_ignored`, `velocity_partial` | Ignoring knockback |
| **NoSlow** | `noslow_item`, `noslow_sneak` | Moving full speed while using items/sneaking |

### Configuration

```rust
FlightConfig {
    enabled: true,
    max_y_gain: 0.42,              // Jump velocity
    max_ascend_ticks: 8,           // Normal jump peaks at ~8 ticks
    max_hover_ticks: 6,            // Max ticks at same Y level
    max_air_ticks: 25,             // Normal jump is ~12-15 ticks
    max_glide_ticks: 8,            // Slow falling threshold
    max_constant_ticks: 5,         // Identical Y delta threshold
    hover_threshold: 0.005,        // Y delta considered "hovering"
    y_prediction_tolerance: 0.03,  // Gravity deviation tolerance
    jump_velocity_tolerance: 0.1,  // Jump velocity deviation tolerance
}
```

---

## Combat Module

Detects combat-related cheats including KillAura, reach, and auto-clicker.

### KillAura Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Multi Aura** | `killaura_multi` | Attacking multiple entities impossibly fast |
| **Rotation** | `killaura_rotation` | Suspicious rotation patterns during combat |
| **Frequency** | `killaura_frequency` | Attack frequency anomalies |

### Reach Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Distance** | `reach_distance` | Hitting from too far away (>3.0 blocks) |

### Aim Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Snap** | `aim_snap` | Sudden rotation snaps toward targets |
| **Smooth** | `aim_smooth` | Unnaturally smooth rotation patterns |
| **Invalid** | `aim_invalid` | Impossible rotation changes |

### AutoClicker Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **CPS** | `autoclicker_cps` | Clicks per second exceeding human limits |
| **Pattern** | `autoclicker_pattern` | Suspicious click timing patterns |
| **Consistency** | `autoclicker_consistency` | Too consistent click delays |

### Other Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **NoSwing** | `noswing` | Attacking without arm animation |

---

## Player Module

Detects player-related cheats including scaffold, fast break/place, and protocol violations.

### Scaffold Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Rotation** | `scaffold_rotation` | Invalid rotations while bridging |
| **Speed** | `scaffold_speed` | Bridging too quickly |
| **Placement** | `scaffold_placement` | Invalid block placement patterns |

### FastBreak / FastPlace Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Break Speed** | `fastbreak_speed` | Breaking blocks too quickly |
| **Place Speed** | `fastplace_speed` | Placing blocks too quickly |

### BadPackets Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Invalid Position** | `badpackets_position` | NaN or impossible coordinates |
| **Invalid Rotation** | `badpackets_rotation` | Pitch outside -90 to 90 range |
| **Packet Flood** | `badpackets_flood` | Too many packets per tick |

### Inventory Checks

| Check | Feature ID | Description |
|-------|------------|-------------|
| **Invalid Slot** | `inventory_slot` | Invalid slot numbers |
| **Action Speed** | `inventory_speed` | Inventory actions too fast |

---

## Adding/Enabling Modules

### 1. Register in Database

Modules are registered in the `server_modules` table:

```sql
INSERT INTO server_modules (id, server_id, name, base_url, enabled)
VALUES (
  gen_random_uuid(),
  'your-server-id',
  'Module Name',
  'http://127.0.0.1:PORT',
  true
);
```

### 2. Start the Module

```bash
cd /opt/async_anticheat_api/modules/MODULE_NAME
nohup env HOST=0.0.0.0 PORT=30XX \
  API_BASE=http://127.0.0.1:3002 \
  MODULE_CALLBACK_TOKEN=your_token \
  ./target/release/MODULE_NAME > /var/log/MODULE_NAME.log 2>&1 &
```

### 3. Environment Variables

| Variable | Description |
|----------|-------------|
| `HOST` | Bind address (usually `0.0.0.0`) |
| `PORT` | Module listen port |
| `API_BASE` | URL of the AsyncAnticheat API |
| `MODULE_CALLBACK_TOKEN` | Authentication token for API callbacks |

---

## Module Communication

### Packet Format

All modules receive packets in the following plugin format:

```json
{
  "ts": 1734889081309,
  "uuid": "player-uuid",
  "pkt": "PACKET_TYPE",
  "fields": {
    "field1": "value1",
    "field2": 123
  }
}
```

**Important packet type mappings** (plugin sends → module should accept):

| Plugin Sends | Packet Category |
|--------------|-----------------|
| `PLAYER_POSITION` | Position only |
| `PLAYER_POSITION_AND_ROTATION` | Position + look |
| `PLAYER_ROTATION` | Look only |
| `PLAYER_FLYING` | Flying/ground status |
| `INTERACT_ENTITY` | Combat attacks |
| `ANIMATION` | Arm swing |
| `PLAYER_DIGGING` | Block dig |
| `PLAYER_BLOCK_PLACEMENT` | Block place |
| `HELD_ITEM_CHANGE` | Slot change |
| `CLICK_WINDOW` | Inventory click |
| `ENTITY_ACTION` | Sprint/sneak/etc |
| `PLAYER_ABILITIES` | Flight capabilities |

### API → Module (Ingest)

```
POST /ingest
Authorization: Bearer <token>
Content-Type: application/json

{
  "batch_id": "uuid",
  "server_id": "uuid",
  "packets": [...],
  "player_states": {...}
}
```

### Module → API (Findings)

```
POST /callbacks/findings
Authorization: Bearer <MODULE_CALLBACK_TOKEN>
Content-Type: application/json

{
  "findings": [
    {
      "player_uuid": "uuid",
      "feature_id": "flight_ascend",
      "value": 12.0,
      "vl": 3,
      "max_vl": 10,
      "timestamp_ms": 1234567890,
      "description": "Sustained ascension: 12 ticks",
      "should_mitigate": true
    }
  ]
}
```

### Health Check

```
GET /health

Response:
{
  "ok": true,
  "name": "movement_module",
  "version": "0.2.0"
}
```

---

## Physics Constants

These Minecraft physics values are used across detection modules:

```rust
const GRAVITY: f64 = 0.08;           // Blocks per tick²
const DRAG: f64 = 0.98;              // Air resistance multiplier
const JUMP_VELOCITY: f64 = 0.42;     // Initial jump Y velocity
const MAX_WALK_SPEED: f64 = 0.2873;  // Blocks per tick
const MAX_SPRINT_SPEED: f64 = 0.3675;
const MAX_SNEAK_SPEED: f64 = 0.0663;
const STEP_HEIGHT_LIMIT: f64 = 0.6;
```

---

## Violation Level (VL) System

Each check uses a buffer system with decay:

- **Threshold**: Buffer value needed to increment VL
- **Max VL**: VL level that triggers mitigation
- **Decay**: How fast the buffer decreases on normal behavior

Example buffer configuration:
```rust
CheckBuffer::new(
    2.0,   // threshold - 2 failures to increment VL
    10,    // max_vl - 10 VL triggers punishment
    0.9    // decay - 10% decay per pass
)
```
