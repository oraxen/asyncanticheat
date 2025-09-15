# Detection Modules

AsyncAnticheat uses a category-based module architecture for cheat detection. Each module focuses on a specific type of cheating behavior.

## Module Overview

| Module | Port | Description |
|--------|------|-------------|
| Combat Module | 4021 | Detects combat-related cheats (aimbots, autoclickers, killaura) |
| Movement Module | 4022 | Detects movement-related cheats (fly, speed, timer) |
| Player Module | 4023 | Detects packet abuse and action cheats (scaffold, fast break) |

---

## Combat Module (Port 4021)

Located in `modules/combat_module/`

### Checks

#### KillAura
Detects automated combat targeting.
- **KillAuraMultiTarget**: Switching attack targets faster than humanly possible (<50ms)
- **KillAuraPost**: Attacking multiple times in rapid succession (<5ms apart)

#### Aim
Detects aim modifications and aimbots.
- **AimHeadSnap**: Sudden large rotation changes (>30° in <50ms)
- **AimPitchSpread**: Unnaturally consistent pitch variance (aimbot maintains constant pitch)
- **AimSensitivity**: GCD mismatch indicating external aim modification
- **AimModulo**: Rotation snapping to specific modulo values (0.25, 0.1)
- **AimDirectionSwitch**: Instant direction reversal with large deltas (>30°)
- **AimRepeatedYaw**: Identical yaw values repeated suspiciously

#### AutoClicker
Detects automated clicking.
- **AutoClickerCps**: Clicks per second exceeding limits (>20 CPS)
- **AutoClickerTiming**: Low standard deviation in click timing
- **AutoClickerVariance**: Low variance in click intervals
- **AutoClickerKurtosis**: Abnormal distribution of click intervals
- **AutoClickerTickAlign**: Clicks aligned to server tick boundaries (50ms)

#### Reach
Detects attack distance exploitation.
- **ReachDistance**: Attacking beyond vanilla limits (>3.5 blocks)
- **ReachCritical**: Definite reach violation (>4.5 blocks)

#### NoSwing
Detects attacks without arm animation.
- **NoSwing**: Multiple attacks without arm swing packet

---

## Movement Module (Port 4022)

Located in `modules/movement_module/`

### Checks

#### Flight
Detects flying without creative mode.
- **FlightYPrediction**: Y movement doesn't match gravity physics
- **FlightSustainedAscend**: Ascending for multiple ticks without jump
- **FlightHover**: Hovering in air with near-zero vertical movement

#### Speed
Detects horizontal speed modifications.
- **SpeedHorizontal**: Exceeding walk speed limit (0.2873 b/t)
- **SpeedSprint**: Exceeding sprint speed limit (0.3675 b/t)
- **SpeedSneak**: Exceeding sneak speed limit (0.0663 b/t)

#### NoFall
Detects fall damage avoidance.
- **NoFallInvalidGround**: Claiming ground while Y position is invalid
- **NoFallFakeDamage**: Ground claim during high-velocity fall

#### Timer
Detects client timer manipulation.
- **TimerFast**: Client running faster than 20 TPS
- **TimerSlow**: Client running slower than expected (rare)

#### Step
Detects step height modification.
- **StepHeight**: Stepping more than 0.6 blocks while staying on ground
- **StepNoGround**: Invalid step without proper ground transitions

#### GroundSpoof
Detects ground status spoofing.
- **GroundSpoofFalling**: Claiming ground while falling fast (>0.31 velocity)
- **GroundSpoofAscending**: Claiming ground while ascending

#### Velocity
Detects knockback/velocity ignoring.
- **VelocityIgnored**: Not taking received velocity at all
- **VelocityPartial**: Taking less than 50% of received velocity

#### NoSlow
Detects slowdown bypass.
- **NoSlowUsingItem**: Moving too fast while using items (should be 0.2x speed)
- **NoSlowSneaking**: Moving too fast while sneaking (should be 0.3x speed)

---

## Player Module (Port 4023)

Located in `modules/player_module/`

### Checks

#### BadPackets
Detects invalid packet data.
- **BadPacketsPitch**: Pitch outside valid range (>±90°)
- **BadPacketsNaN**: NaN values in position packets
- **BadPacketsAbilities**: Flying without permission flag
- **BadPacketsSlot**: Invalid hotbar slot (outside 0-8)
- **BadPacketsFlyingFlood**: Excessive flying packets per second

#### Scaffold
Detects bridging cheats.
- **ScaffoldAirborne**: Placing block on bottom face while airborne
- **ScaffoldSprint**: Sprinting while bridging (impossible normally)

#### FastPlace
Detects fast block placement.
- **FastPlace**: Block placement under 50ms interval
- **FastPlaceCritical**: Block placement under 25ms interval

#### FastBreak
Detects fast block breaking.
- **FastBreak**: Block breaking under 50ms interval
- **FastBreakCritical**: Block breaking under 25ms interval

#### Interact
Detects invalid interaction angles.
- **InteractAngle**: Interaction angle >45° from look direction
- **InteractImpossible**: Interaction angle >90° from target block

#### Inventory
Detects inventory manipulation speed.
- **InventoryFastClick**: Rapid inventory clicks within short window

---

## Configuration

Each module accepts configuration via environment variables:

```bash
# Common to all modules
HOST=0.0.0.0
PORT=402X                    # 4021/4022/4023
API_BASE=http://localhost:3002
MODULE_CALLBACK_TOKEN=your_token
MODULE_NAME=module_name

# Combat Module specific
# (uses defaults, configurable in code)

# Movement Module specific
# (uses defaults, configurable in code)

# Player Module specific
# (uses defaults, configurable in code)
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

## Building

```bash
# Build all modules
cd modules/combat_module && cargo build --release
cd modules/movement_module && cargo build --release
cd modules/player_module && cargo build --release
```

## Running

Each module runs as a separate HTTP service:

```bash
# Combat Module
cd modules/combat_module && cargo run

# Movement Module  
cd modules/movement_module && cargo run

# Player Module
cd modules/player_module && cargo run
```

For production, use systemd services (see deployment documentation).
