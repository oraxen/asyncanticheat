# Detection Modules

AsyncAnticheat uses a **tiered module architecture** with Core and Advanced modules for each category. This follows the Pareto principle: Core modules provide 80% of detection value with 20% of the complexity.

## Module Overview

| Module | Port | Tier | Description |
|--------|------|------|-------------|
| Combat Core | 4021 | Core | High-signal combat cheats (CPS, reach, multi-target, noswing) |
| Movement Core | 4022 | Core | Blatant movement cheats (flight, speed, nofall, groundspoof) |
| Player Core | 4023 | Core | Obvious packet abuse (badpackets, fastplace, scaffold) |
| Combat Advanced | 4024 | Advanced | Statistical combat analysis (aim, autoclicker stats) |
| Movement Advanced | 4025 | Advanced | Subtle movement analysis (Y prediction, timer, velocity) |
| Player Advanced | 4026 | Advanced | Complex interaction analysis (inventory, interact angles) |

---

## Core Modules (Pareto Tier)

Core modules focus on **simple, high-signal checks** that catch blatant cheating with minimal false positives.

### Combat Core Module (Port 4021)

**Checks:**
- **AutoClickerCps**: Clicks per second >20 (humanly impossible)
- **ReachCritical**: Attack distance >4.5 blocks (definite cheat)
- **KillAuraMultiTarget**: Switching attack targets in <50ms
- **NoSwing**: Attacking without arm animation packet

### Movement Core Module (Port 4022)

**Checks:**
- **FlightSustainedAscend**: Ascending for >12 ticks (obvious flight)
- **SpeedBlatant**: Horizontal speed >1.0 b/t (5x normal)
- **NoFallInvalidGround**: Claiming ground while falling fast
- **GroundSpoofFalling**: Ground claim with high downward velocity
- **GroundSpoofAscending**: Ground claim while moving upward

### Player Core Module (Port 4023)

**Checks:**
- **BadPacketsPitch**: Pitch angle outside ±90°
- **BadPacketsNaN**: NaN/Infinity in position or rotation
- **BadPacketsAbilities**: Flying without permission flag
- **BadPacketsSlot**: Invalid hotbar slot (outside 0-8)
- **FastPlaceCritical**: Block placement <25ms apart
- **FastBreakCritical**: Block breaking <25ms apart
- **ScaffoldAirborne**: Placing blocks below while airborne

---

## Advanced Modules

Advanced modules provide **statistical analysis and pattern detection** for subtle cheating that evades simple checks.

### Combat Advanced Module (Port 4024)

**Aim Checks:**
- **AimHeadSnap**: Sudden large rotation changes (>30° in <50ms)
- **AimPitchSpread**: Unnaturally consistent pitch variance
- **AimSensitivity**: GCD mismatch indicating external aim modification
- **AimModulo**: Rotation snapping to specific modulo values
- **AimDirectionSwitch**: Instant direction reversal with large deltas
- **AimRepeatedYaw**: Identical yaw values repeated suspiciously

**AutoClicker Checks:**
- **AutoClickerTiming**: Low standard deviation in click timing
- **AutoClickerVariance**: Low variance in click intervals
- **AutoClickerKurtosis**: Abnormal distribution of click intervals
- **AutoClickerTickAlign**: Clicks aligned to server tick boundaries

**Other Checks:**
- **KillAuraPost**: Attacking multiple times too quickly (<5ms)
- **ReachDistance**: Attack distances exceeding 3.5 blocks (accumulation)

### Movement Advanced Module (Port 4025)

**Flight Checks:**
- **FlightYPrediction**: Y movement doesn't match gravity physics
- **FlightHover**: Hovering in air with near-zero vertical movement

**Speed Checks:**
- **SpeedSprint**: Exceeding sprint speed limit (0.3675 b/t)
- **SpeedSneak**: Exceeding sneak speed limit (0.0663 b/t)

**Timer Checks:**
- **TimerFast**: Client running faster than 22 TPS
- **TimerSlow**: Client running slower than 18 TPS

**Other Checks:**
- **StepHeight**: Stepping more than 0.6 blocks while on ground
- **NoSlowUsingItem**: Moving too fast while using items

### Player Advanced Module (Port 4026)

**Checks:**
- **InteractAngle**: Interaction angle >45° from look direction
- **InteractImpossible**: Interaction angle >90° from target
- **InventoryFastClick**: Rapid inventory clicks <50ms apart
- **FastPlace**: Block placement <50ms apart (accumulation)
- **FastBreak**: Block breaking <50ms apart (accumulation)
- **ScaffoldSprint**: Sprinting while bridging (impossible normally)

---

## Configuration

Each module accepts configuration via environment variables:

```bash
# Common to all modules
HOST=0.0.0.0
PORT=402X                    # See port table above
API_BASE=http://localhost:3002
MODULE_CALLBACK_TOKEN=your_token
MODULE_NAME=module_name
```

---

## Module Protocol

Modules communicate with the API via:

1. **Ingest endpoint**: `POST /ingest` - Receives gzipped NDJSON packet batches
2. **State management**: 
   - `POST /callbacks/player-states/batch-get` - Retrieve player states
   - `POST /callbacks/player-states/batch-set` - Store player states
3. **Findings submission**: `POST /callbacks/findings` - Submit detection results

All callbacks require `Authorization: Bearer <MODULE_CALLBACK_TOKEN>` header.

---

## Running Modules

Build all modules:

```bash
cd modules/combat_core_module && cargo build --release
cd modules/combat_advanced_module && cargo build --release
cd modules/movement_core_module && cargo build --release
cd modules/movement_advanced_module && cargo build --release
cd modules/player_core_module && cargo build --release
cd modules/player_advanced_module && cargo build --release
```

Run modules (example for core tier):

```bash
# Terminal 1: Combat Core
PORT=4021 MODULE_NAME=combat_core ./target/release/combat_core_module

# Terminal 2: Movement Core
PORT=4022 MODULE_NAME=movement_core ./target/release/movement_core_module

# Terminal 3: Player Core
PORT=4023 MODULE_NAME=player_core ./target/release/player_core_module
```

For production, use systemd services or your preferred process manager.

---

## Architecture Decision

### Why Core + Advanced?

1. **Core modules** run fast with minimal CPU/memory, catching ~80% of cheaters
2. **Advanced modules** can be enabled selectively for high-stakes scenarios
3. Servers can start with Core-only and add Advanced as needed
4. Reduces false positives by separating simple checks from statistical analysis
5. Easier to debug and tune individual check categories

### Recommended Deployment

- **All servers**: Enable all Core modules (4021, 4022, 4023)
- **Competitive servers**: Add Advanced modules (4024, 4025, 4026)
- **Development/testing**: Run specific modules as needed
