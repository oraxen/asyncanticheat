# NoCheatPlus (NCP) — Check Catalogue, Defaults, and Implementation Logic (No Code)

This document is a **code-informed** description of NoCheatPlus’ checks and their default configuration values, based on the `./NoCheatPlus` source tree (primarily `NCPCore`). It is intentionally **implementation-level** (how each check works internally), but it **does not quote or include code**.

## Scope and reader assumptions

- **Scope**: checks under `NCPCore/src/main/java/fr/neatmonster/nocheatplus/checks/**` and defaults in `NCPCore/src/main/java/fr/neatmonster/nocheatplus/config/DefaultConfig.java` + configuration paths in `.../config/ConfPaths.java`.
- **Not covered**: Bukkit event wiring details, permissions, and compatibility layers beyond what affects check logic.
- **Goal**: serve as a spec for re-implementing a subset of NCP logic in our packet-batch approach.

## NCP architecture at a glance (how checks are structured)

### Check taxonomy (`CheckType`)

NCP organizes checks in a tree of types (groups and leaf checks). The top-level check groups are:

- **BLOCKBREAK**: `direction`, `fastbreak`, `frequency`, `noswing`, `reach`, `wrongblock`
- **BLOCKINTERACT**: `direction`, `reach`, `speed`, `visible`
- **BLOCKPLACE**: `against`, `autosign`, `direction`, `fastplace`, `noswing`, `reach`, `speed`
- **CHAT**: `captcha`, `color`, `commands`, `text`, `logins`, `relog`
- **COMBINED**: `bedleave`, `improbable`, `munchhausen` (plus yaw-rate and invulnerable helpers)
- **FIGHT**: `angle`, `critical`, `direction`, `fastheal`, `godmode`, `noswing`, `reach`, `selfhit`, `speed`, `wrongturn`
- **INVENTORY**: `drop`, `fastclick`, `fastconsume`, `gutenberg`, `instantbow`, `instanteat`, `items`, `open`
- **MOVING**: `creativefly`, `morepackets`, `nofall`, `passable`, `survivalfly`, **vehicle** (`morepackets`, `envelope`)
- **NET**: `attackfrequency`, `flyingfrequency`, `keepalivefrequency`, `packetfrequency`, `sounddistance`

### Configuration mechanics (paths and defaults)

- **Configuration keys** are defined as constants in `ConfPaths`. For example, `checks.fight.reach.survivaldistance`.
- **Default values** are assigned in `DefaultConfig` via `set(path, value, buildNumber)`.
- Many checks are “enabled by default” using the string `"default"` under `...active` paths. This indicates NCP supports per-world profiles and policy-driven enabling; the details aren’t critical for re-implementing check logic, but do matter for compatibility.

### Violation model (VL) and action execution

Most checks compute a **violation amount** (often called “added VL” or “change”) per event, then:

- accumulate into a **per-player violation level** (`VL`) for that check
- optionally **decay** VL on passes (common patterns: multiply by `0.8`, `0.9`, `0.95`, `0.98`)
- execute an **action list** based on VL thresholds

#### Action list grammar (important for understanding defaults)

Action definitions are strings that look like:

- `cancel`
- `cmd:kickname`
- `log:tag:delay:repeat:flags`
- `vl>10 ... vl>50 ...` (threshold sections)

Key details:

- **Threshold segmentation**: The string is split on `vl>`; the first section applies at threshold `0` (base actions). Each subsequent section begins with an integer threshold and then the action list for that threshold.
  - Example shape: `cancel vl>10 log:xxx:0:5:if cancel`
- **Log actions**: `log:<name>:<delay>:<repeat>:<flags>`
  - `<flags>` controls destinations:
    - `c` = console
    - `f` = file
    - `i` = in-game notify stream (chat)
  - Example: `log:angle:3:5:f` means “log tag=angle, delay=3, repeat=5, to file only”.
- **Command actions**:
  - `cmd:<name>:<delay>:<repeat>` (executes a configured command template)
  - `cmdc:` variant exists to **replace** color codes before executing.
- **Cancellation**:
  - `cancel` means “cancel the underlying event/move/packet” (where applicable).
  - Many defaults are “cancel early, then escalate to log/kick”.
- **Probabilistic cancellation (exists, not common in defaults)**:
  - NCP supports actions like `"<probability>%cancel"` (e.g., `"50%cancel"`), which means “cancel with probability p%”.

### Lag adaptation (why some checks don’t add VL during lag)

Several checks query a “lag factor” and scale computations:

- Typical pattern: compute a violation, then divide or scale by a lag estimate, and only act if still above threshold.
- Many checks refuse to increase VL if lag exceeds a heuristic threshold (often `1.5`).

## What translates to our packet-batch approach (high-level)

When re-implementing NCP checks from captured packets:

- Checks that depend mainly on **timing and counts** (packets per second, clicks per window, attacks per second) translate well.
- Checks that require the **server’s world collision** and block/material data (passable, block direction/visibility) do not translate directly unless we augment batches with **server-side world probes** or approximate with heuristics.
- Checks that depend on **server-side combat resolution details** (damage immunity windows, actual applied knockback) need careful adaptation.

This document still documents *all checks* in NCP, but later we’ll explicitly select what is feasible for our pipeline.

---

## BLOCKBREAK checks

### BLOCKBREAK_DIRECTION

**Intent**: prevent breaking blocks that are not reasonably in the player’s interaction direction (anti “break behind walls / through angles”).

**How it works**:
- Uses the player’s look direction and block geometry to verify the breaking action is aligned with where the player is facing.
- This is a “geometry + look” check: it uses player position, yaw/pitch, and target block face relation.

**Default config**
- **enabled**: `checks.blockbreak.direction.active = "default"`
- **actions**: `checks.blockbreak.direction.actions = "cancel vl>10 log:bdirection:0:3:if cancel"`

**Suggested values (for packet-only)**:
- Feasible only if batches include reliable **block target** and **player look** at time of break; otherwise keep disabled or replace with reach/interaction-rate checks.

### BLOCKBREAK_FASTBREAK

**Intent**: detect blocks being broken faster than physically possible (client-side instant-break, fastbreak hacks, or desync abuse).

**How it works (core logic)**:
- Computes an **expected break duration** for the block type given:
  - block hardness / tool suitability
  - potion effects (e.g., haste)
  - whether strict timing is used
  - a survival interval modifier
- Measures **elapsed time** between:
  - either first damage → break (strict mode)
  - or break → break (non-strict)
- If `elapsed + delay < expected`, it computes a **missing time** and pushes it into a **penalty bucket accumulator**.
- Only triggers VL once bucket score exceeds a **grace** threshold (helps absorb jitter, delay, contention).
- Adds VL proportional to missing time in seconds; decays VL on passes.

**Default config**
- `checks.blockbreak.fastbreak.active = "default"`
- `checks.blockbreak.fastbreak.strict = true`
- `checks.blockbreak.fastbreak.delay = 100` (ms)
- `checks.blockbreak.fastbreak.intervalsurvival = 100` (percent scaling of expected duration)
- `checks.blockbreak.fastbreak.grace = 2000` (penalty score threshold)
- `checks.blockbreak.fastbreak.actions = "cancel vl>0 log:fastbreak:3:5:cif cancel"`

**Suggested values (for packet-only)**:
- This is hard without server-side block hardness/tool context; if we implement, do it as a **rate-of-break** check per player and per block-type class, not a full physics break-time model.

### BLOCKBREAK_FREQUENCY

**Intent**: limit how many blocks can be broken over time (anti nuker / macro).

**How it works**:
- Uses a **bucketed frequency counter** (time buckets) with weights.
- Computes:
  - a “full-period” score over `bucketDuration * bucketCount`
  - a “short-term” burst counter over a small number of ticks
- Applies lag adjustment; chooses the max of full and short-term violation.
- Adds VL by `violation / 1000`; decays VL if the observed score drops sufficiently.

**Default config**
- `checks.blockbreak.frequency.active = "default"`
- `checks.blockbreak.frequency.intervalcreative = 95` (ms per event used for scoring)
- `checks.blockbreak.frequency.intervalsurvival = 45`
- `checks.blockbreak.frequency.shortterm.ticks = 5`
- `checks.blockbreak.frequency.shortterm.limit = 7`
- `checks.blockbreak.frequency.actions = "cancel vl>5 log:bbfrequency:3:5:if cancel vl>60 log:bbfrequency:0:5:cif cancel cmd:kickfrequency"`

**Suggested values (packet-only)**:
- Fully feasible: count break-related actions in a sliding window. Keep defaults as a starting point.

### BLOCKBREAK_NOSWING

**Intent**: detect breaking without arm swing animation.

**How it works**:
- Tracks whether a swing animation precedes a block break within a reasonable window; missing swing increments VL.
- Typically decays on passes; exact decay is implementation dependent.

**Default config**
- `checks.blockbreak.noswing.active = "default"`
- `checks.blockbreak.noswing.actions = "cancel vl>10 log:noswing:0:5:if cancel"`

**Suggested values (packet-only)**:
- Feasible if we capture `ANIMATION` and block-dig/break intent packets. Beware of out-of-order timestamps; use monotonic guards.

### BLOCKBREAK_REACH

**Intent**: block breaking too far away (reach hacks).

**How it works**:
- Computes distance from **player eye position** to **center of target block**, then subtracts a fixed mode-based limit.
  - survival limit: 5.2 blocks
  - creative limit: 5.6 blocks
- If distance exceeds limit, adds that excess to VL and runs actions; decays on pass.

**Default config**
- `checks.blockbreak.reach.active = "default"`
- `checks.blockbreak.reach.actions = "cancel vl>5 log:breach:0:2:if cancel"`

**Suggested values (packet-only)**:
- Requires reliable player position/look and target block position at break time. Without target block, can’t implement faithfully.

### BLOCKBREAK_WRONGBLOCK

**Intent**: detect breaking the “wrong” block relative to what the player is aiming at / expected target tracking.

**How it works**:
- Tracks expected target block and compares subsequent dig/break actions; mismatches accumulate VL.

**Default config**
- `checks.blockbreak.wrongblock.active = "default"`
- `checks.blockbreak.wrongblock.level = 10`
- `checks.blockbreak.wrongblock.actions = "cancel vl>10 log:bwrong:0:5:if cancel vl>30 log:bwrong:0:5:cif cancel cmd:kickwb"`

**Suggested values (packet-only)**:
- Needs block-target data (or server-side ray trace); otherwise not feasible directly.

---

## BLOCKINTERACT checks

### BLOCKINTERACT_DIRECTION

Same conceptual goal as blockbreak direction but applied to interactions (right-click use).

**Default config**
- `checks.blockinteract.direction.active = "default"`
- `checks.blockinteract.direction.actions = "cancel vl>10 log:bdirection:0:3:if cancel"`

### BLOCKINTERACT_REACH

**Default config**
- `checks.blockinteract.reach.active = "default"`
- `checks.blockinteract.reach.actions = "cancel vl>5 log:breach:0:2:if cancel"`

### BLOCKINTERACT_SPEED

**Intent**: limit interaction spam (use/activate too quickly).

**How it works**
- Counts interactions over a time window (`interval`) and compares to a `limit`.
- Accumulates VL on sustained violation and triggers actions with escalation.

**Default config**
- `checks.blockinteract.speed.active = "default"`
- `checks.blockinteract.speed.interval = 2000` (ms)
- `checks.blockinteract.speed.limit = 60`
- `checks.blockinteract.speed.actions = "cancel vl>200 log:bspeed:0:2:if cancel vl>1000 cancel log:bspeed:0:2:icf cmd:kickbspeed"`

### BLOCKINTERACT_VISIBLE

**Intent**: prevent interacting with blocks through walls / when not visible.

**How it works**
- Uses server-side line-of-sight / block occlusion logic to determine visibility.

**Default config**
- `checks.blockinteract.visible.active = "default"`
- `checks.blockinteract.visible.actions = "cancel vl>100 log:bvisible:0:10:if cancel"`

**Packet-only feasibility**: not without world state.

---

## BLOCKPLACE checks

### BLOCKPLACE_AGAINST

**Intent**: prevent placing blocks “against” invalid surfaces / illegal placements.

**Default config**
- `checks.blockplace.against.active = "default"`
- `checks.blockplace.against.actions = "cancel"`

### BLOCKPLACE_AUTOSIGN

**Intent**: detect automated sign editing/spam patterns.

**Default config**
- `checks.blockplace.autosign.active = "default"`
- `checks.blockplace.autosign.skipempty = false`
- `checks.blockplace.autosign.actions = "cancel vl>10 log:bautosign:0:3:if cancel"`

### BLOCKPLACE_DIRECTION

**Default config**
- `checks.blockplace.direction.active = "default"`
- `checks.blockplace.direction.actions = "cancel vl>10 log:bdirection:0:3:if cancel"`

### BLOCKPLACE_FASTPLACE

**Intent**: limit place rate (scaffold/autoplace).

**How it works**
- Maintains both:
  - a “full window” bucket score (longer horizon), compared against `limit`
  - a tick-based short-term counter compared against `shortterm.limit`
- Uses lag heuristics:
  - if lag is high, short-term counting may reset rather than continuously increment
  - the long-window bucket score can be divided by a lag factor before comparing to limit
- Violation amount is `max(fullViolation, shortTermViolation)` and is added directly to VL.
- VL decays when activity drops well below the long-window limit.

**Default config**
- `checks.blockplace.fastplace.active = "default"`
- `checks.blockplace.fastplace.limit = 22`
- `checks.blockplace.fastplace.shortterm.ticks = 10`
- `checks.blockplace.fastplace.shortterm.limit = 6`
- `checks.blockplace.fastplace.actions = "cancel vl>100 log:fastplace:3:5:cif cancel"`

### BLOCKPLACE_NOSWING

**Default config**
- `checks.blockplace.noswing.active = "default"`
- `checks.blockplace.noswing.exceptions = ["WATER_LILY", "LILY_PAD", "FLINT_AND_STEEL"]`
- `checks.blockplace.noswing.actions = "cancel vl>10 log:noswing:0:5:if cancel"`

### BLOCKPLACE_REACH

**Default config**
- `checks.blockplace.reach.active = "default"`
- `checks.blockplace.reach.actions = "cancel vl>5 log:breach:0:2:if cancel"`

### BLOCKPLACE_SPEED

**Default config**
- `checks.blockplace.speed.active = "default"`
- `checks.blockplace.speed.interval = 45` (ms)
- `checks.blockplace.speed.actions = "cancel vl>150 log:bpspeed:3:5:if cancel vl>1000 log:bpspeed:3:5:cif cancel"`

**How it works (core logic)**
- Tracks a per-player `lastTime` and a boolean “last refused”.
- If the time since last action is below `interval`:
  - on the first fast attempt, it only marks “refused”
  - on subsequent fast attempts, it adds `difference = interval - dt` to VL and executes actions
- If the time since last action is above interval, it clears the refused flag and decays VL (multiply by ~0.9).

---

## CHAT checks

NCP’s chat system is unusually rich. It combines:
- per-player short-term frequency controls
- text analysis (letter/word similarity)
- captcha gating
- login/relog throttling

### CHAT_CAPTCHA

**Intent**: challenge-response for suspected spam bots.

**Default config**
- `checks.chat.captcha.active = "default"`
- `checks.chat.captcha.skip_commands = false`
- `checks.chat.captcha.characters = "abcdefghjkmnpqrtuvwxyzABCDEFGHJKMNPQRTUVWXYZ2346789"`
- `checks.chat.captcha.length = 6`
- `checks.chat.captcha.tries = 3`
- `checks.chat.captcha.actions = "cancel cmd:kickcaptcha vl>4 log:captcha:2:5:cf cancel cmd:kickcaptcha"`

### CHAT_COLOR

**Intent**: restrict or log chat color usage.

**Default config**
- `checks.chat.color.active = "default"`
- `checks.chat.color.actions = "log:color:0:1:if cancel"`

### CHAT_COMMANDS

**Intent**: limit command spam and allow exclusions.

**Default config**
- `checks.chat.commands.active = "default"`
- exclusions: `[]`
- handle-as-chat: `["me"]`
- level: `10`
- shortterm ticks: `18`
- shortterm level: `3`
- actions: `log:commands:0:5:cf cancel cmd:kickcommands vl>20 log:commands:0:5:cf cancel cmd:tempkick1`

### CHAT_TEXT

**Intent**: message frequency + content analysis (anti spam, repeated messages, similarity).

**Default config (selected highlights)**
- `checks.chat.text.active = "default"`
- allow VL reset: `true`
- frequency (normal): min `0.0`, factor `0.9`, weight `6`, level `160`, actions include `tellchatnormal` and escalation kicks
- frequency (shortterm): min `2.0`, factor `0.7`, weight `3.0`, level `20.0`, actions include `kickchatfast` escalation
- message heuristics weights:
  - lettercount: `1.0`
  - uppercase: `1.0`
  - afterjoin: `1.5`
  - nomoving: `1.5`
  - repeatself: `1.5`
  - and others as listed under `checks.chat.text.msg.*`
- global analysis toggles (defaults mostly false): words/prefixes/similarity
- per-player analysis toggles (defaults mostly false): words/prefixes/similarity

### CHAT_WARNING (helper)

Not a `CheckType` leaf, but contributes to user-facing warnings when spam levels rise.

**Default config**
- enabled: `true`
- level: `67`
- timeout: `10` seconds
- message configured under `checks.chat.warning.message`

### CHAT_RELOG

**Intent**: punish very fast reconnect behavior.

**Default config**
- active: `"default"`
- timeout: `5000` ms
- warning number: `1`
- warning timeout: `60000` ms
- kick message configured
- actions include logging and tempkick escalation

### CHAT_LOGINS

**Intent**: rate limit logins (anti bot join floods).

**Default config**
- active: `"default"`
- startup delay: `600` seconds
- per-world count: `false`
- seconds window: `10`
- limit: `10`
- kickmessage configured

---

## COMBINED checks

### COMBINED_BEDLEAVE

**Intent**: detect leaving bed in ways that could be used for exploits (historical).

**Default config**
- active: `"default"`
- actions: `cancel log:bedleave:0:5:if cmd:kickbedleave`

### COMBINED_IMPROBABLE

**Intent**: a global “suspicion aggregator” that various checks can feed (a generic anomaly score).

**Default config**
- active: `"default"`
- level: `300`
- actions: `cancel log:improbable:2:8:if`

**How it works (core logic)**
- Other checks “feed” improbable with weighted increments; improbable also has a `check(...)` helper which both feeds and evaluates.
- It evaluates two horizons:
  - **short-term bucket score** vs `improbableLevel / 20`
  - **full-window score** vs `improbableLevel`
- Each horizon is optionally normalized by lag (bucket duration vs full duration).
- If violated:
  - computes a `violation` from the exceeding scores
  - increments `improbableVL` by `violation / 10`
  - executes actions (and can “cancel” whatever operation is calling it)
- Else:
  - decays `improbableVL` by multiplying with `0.95`.

### COMBINED_MUNCHHAUSEN

**Intent**: detects self-inflicted or inconsistent state transitions (often anti exploit / anti desync).

**Default config**
- active: `"default"`
- actions: `cancel vl>100 cancel log:munchhausen:0:60:if`

### COMBINED_ENDERPEARL (configured helper)

**Intent**: enderpearl interaction hardening (anti exploit / anti desync).

**Default config**
- active: `"default"`
- prevent click-block: `true`

**Packet-only feasibility**
- Low, unless we also include server-side enderpearl/interaction context.

### COMBINED_INVULNERABLE (configured helper)

**Intent**: shared “invulnerable window” bookkeeping that other checks can consult.

**Default config**
- enabled: `true` (not a CheckType leaf)
- triggers.always: `false`
- triggers.falldistance: `true`
- initialticks.join: `-1`
- ignore causes: `["FALL"]`
- modifiers: `.all = 0`

### COMBINED_YAWRATE (helper)

Not a `CheckType` leaf in the same way; used as support for rotation anomaly scoring.

**Default config**
- rate: `380` (deg/s)
- penalty factor: `1.0`
- penalty min: `250` ms
- penalty max: `2000` ms
- feeds improbable: `true`

---

## FIGHT checks

### FIGHT_ANGLE

**Intent**: detect “forcefield / killaura style” rapid multi-target attacks with implausible movement/yaw patterns.

**How it works (core logic)**:
- Maintains a sliding list of recent **attack locations** with:
  - attacker position
  - attacker yaw
  - attacked entity UUID
  - distance to previous attack location (squared)
  - yaw delta to previous attack yaw
  - time delta
  - whether target switched and yaw delta was significant
- Over a ~1s horizon, computes averages:
  - **average movement** between attacks (smaller is more suspicious)
  - **average time delta** between attacks (smaller is more suspicious)
  - **average yaw delta** (larger can be suspicious)
  - **average target switching** (especially with yaw changes)
- Computes a composite “violation score” with multiple weighted components and compares against a threshold.
- Adds VL if not in heavy lag; decays slightly on pass.

**Default config**
- active: `"default"`
- threshold: `50`
- actions: `cancel vl>100 log:angle:3:5:f cancel vl>250 log:angle:0:5:cif cancel`

**Suggested values (packet-batch)**
- Feasible if we have per-attack timestamps, attacker yaw, and target changes. Great candidate for packet-derived checks.

### FIGHT_CRITICAL

**Intent**: detect illegitimate critical hits (e.g., crits without falling).

**Default config**
- active: `"default"`
- falldistance threshold: `0.06251`
- actions: `cancel vl>50 log:critical:0:5:cif cancel`

**Packet feasibility**
- Needs vertical motion state; feasible if movement packets are dense enough.

**How it works (core logic)**
- Uses the server-reported fall distance and a “critical context” gate:
  - fall distance > 0
  - not in vehicle
  - not blinded
- Then consults moving state (survival-fly gating):
  - if player is in a “velocity jump phase”, it avoids flagging
  - it treats “low jump” scenarios specially (to avoid false positives from movement anomalies)
  - it checks whether “survival-fly should be checked” for the player at this moment (NCP uses this as a strong signal that the player is in normal survival movement constraints)
- When it decides the critical is likely illegitimate:
  - increments critical VL by 1 and executes actions.

### FIGHT_DIRECTION

**Intent**: detect hitting entities outside of plausible aim direction.

**Default config**
- active: `"default"`
- strict: `false`
- penalty: `500` ms
- actions: (multi-line in defaults; includes cancel/log/penalty behavior)

**Packet feasibility**
- Requires target position or hitbox reference (hard without server entity positions). Often needs server-side entity tracking.

**How it works (core logic)**
- Computes how far the player’s view ray is “off” from the target entity’s effective hit region:
  - builds a direction vector from the attacker’s yaw/pitch at the time of attack
  - uses the target’s width/height (or bounding-box margins when replaying from trace entries)
  - runs a direction test against the target center (optionally a stricter “combined” variant that also considers an angle cap)
- If the “off” result exceeds a small tolerance:
  - it computes an approximate distance-from-ray to target via a cross-product based distance estimate
  - adds that distance to `directionVL`
  - executes actions
  - if cancelling, applies an **attack penalty** (cooldown) for `directionPenalty` ms
- If the player is sufficiently “on target”, it decays `directionVL` by multiplying with `0.8`.
- Complex multipart entities (e.g., dragon parts) are skipped for safety.

### FIGHT_FASTHEAL

**Intent**: detect healing faster than allowed (regen hacks).

**Default config**
- active: `"default"`
- interval: `4000` ms
- buffer: `1000` ms
- actions: `cancel vl>10 cancel log:fastheal:0:10:i vl>30 cancel log:fastheal:0:10:if`

**How it works (core logic)**
- This is a **legacy client-side regen** check driven by health regain events.
- Maintains:
  - a reference timestamp (`fastHealRefTime`)
  - a buffer (`fastHealBuffer`) that absorbs small timing noise
  - a violation level (`fastHealVL`) that decays slowly on clean periods
- If the time since the last regain is ≥ `interval` (or time wrapped), it treats the event as “normal”:
  - decays `fastHealVL` (multiply by ~0.96)
  - refills the buffer gradually (capped at `fastHealBuffer`)
- If the regain happens earlier than the interval:
  - it computes a lag-adjusted “effective interval” and subtracts the shortfall from the buffer
  - only when the buffer is depleted does it raise VL by a scaled shortfall and execute actions.

### FIGHT_GODMODE

**Intent**: detect invulnerability / “no damage” behavior.

**Default config**
- active: `"default"`
- lag min age: `1100` ms
- lag max age: `5000` ms
- actions: `log:godmode:2:5:if cancel vl>60 log:godmode:2:5:icf cancel`

**How it works (core logic)**
- Tracks per-player damage timing by comparing:
  - server tick progress
  - `noDamageTicks` countdown
  - invulnerable ticks (if available from the server internals)
  - health decreases
- Maintains an accumulator of mismatch between expected tick decay and observed `noDamageTicks` decay.
- Before flagging, it tries to attribute anomalies to **client-side lag** using keepalive timing heuristics:
  - if last keepalive suggests the client is lagging within `[lagMinAge, lagMaxAge]`, it suppresses.
- When mismatch persists beyond a small threshold:
  - increases `godModeVL` and executes actions.

### FIGHT_NOSWING

**Default config**
- active: `"default"`
- actions: `cancel vl>10 log:noswing:0:5:if cancel`

**How it works (core logic)**
- Maintains a boolean “arm swung since last attack”.
- On attack:
  - if arm swung, it clears the flag and decays `noSwingVL` (~0.9)
  - otherwise it increments `noSwingVL` by 1 and executes actions.

### FIGHT_REACH

**Intent**: entity reach hacks, with a dynamic reduction mechanism.

**How it works (core logic)**:
- Computes distance from attacker eye position to an adjusted reference point on the victim (clamps Y to victim’s vertical bounds).
- Checks against a mode-based limit:
  - creative base is fixed higher
  - survival is configurable and can be modified for special entities (e.g., dragon/giant)
- Uses **reachMod** (a dynamic factor) which is adjusted:
  - decreases when player repeatedly attacks near the limit
  - increases back toward 1.0 when attacks are comfortably within limit
- Has two outcomes:
  - **hard violation** (distance beyond absolute limit) → increases VL, executes actions, can apply attack penalty
  - **silent cancel** (within absolute but beyond dynamic adjusted limit) → cancels without increasing VL, applies smaller penalty and feeds improbable
- Uses lag gating for VL increases.

**Default config**
- active: `"default"`
- survivaldistance: `4.4`
- penalty: `500` ms
- reduce: `true`
- reducedistance: `0.9`
- reducestep: `0.15`
- actions: `cancel vl>10 log:freach:2:5:if cancel`

**Suggested values (packet-batch)**
- Implementable only if we can estimate victim position/hitbox. If not, omit or approximate with “attack while not aiming at target” heuristics.

### FIGHT_SELFHIT

**Intent**: detect attacking self via malformed packets or exploit.

**Default config**
- active: `"default"`
- actions: `log:fselfhit:0:5:if cancel vl>10 log:fselfhit:0:5:icf cancel cmd:kickselfhit`

**How it works (core logic)**
- Checks whether the attacker and victim are actually the same player (self-hit).
- If so:
  - it adds 1 to an internal time-based counter (a bucketed frequency structure) and uses the decayed score as VL
  - executes actions using that score.

### FIGHT_SPEED

**Intent**: limit attack rate (APS / CPS for attacks).

**Default config**
- active: `"default"`
- limit: `15`
- shortterm ticks: `7`
- shortterm limit: `6`
- actions: `cancel vl>50 log:fspeed:0:5:if cancel`

**Packet feasibility**
- Excellent candidate: purely timestamp + count based.

**How it works (core logic)**
- Maintains:
  - a bucketed score over a medium horizon, normalized to attacks-per-second (and lag-adjusted)
  - a tick-window short-term count, normalized to attacks-per-second
- Uses `max(shortTermAPS, mediumAPS)` as the current “attack rate”.
- If above limit: increases VL by `(rate - limit)` and executes actions.
- Else: decays VL by multiplying with `0.96`.

### FIGHT_WRONGTURN

**Intent**: detect impossible pitch/yaw (e.g., pitch beyond ±90°).

**Default config**
- active: `"default"`
- actions: `cancel cmd:kick_wrongturn log:log_wrongturn:0:15:fci`

**How it works (core logic)**
- Checks for invalid pitch values: `abs(pitch) > 90°`.
- Adds `+1` to VL each time (no decay) and executes actions.

---

## INVENTORY checks

### INVENTORY_DROP

**Intent**: detect rapid drop spam (macro / client exploit).

**Default config**
- active: `"default"`
- limit: `100`
- timeframe: `20` (ticks)
- actions: `log:drop:0:1:cif cancel cmd:dropkick:0:1`

**How it works (core logic)**
- Tracks a counter of dropped items inside a rolling time frame:
  - if `now >= lastTime + timeframe`, it resets the counter/VL
  - otherwise increments the counter for each drop
- If the counter exceeds `limit`, it sets `dropVL = (count - limit)` and executes actions.

### INVENTORY_FASTCLICK

**Intent**: prevent inventory-looting macros by limiting click frequency, with special handling for shift-click and certain client behaviors.

**How it works (core logic)**:
- Converts a click into an “amount” score based on action type:
  - certain actions (collect-to-cursor, continuous drop) are weighted differently
  - for shift-click-like patterns, may scale by stack count / cursor amount
- Feeds a bucketed frequency counter with this amount.
- Compares both:
  - short-term bucket score against a short-term limit
  - long-window score against a normal limit
- Applies lag adjustments if above thresholds; uses max(shortTerm, normal) as violation.
- Adds violation to VL; executes actions.

**Default config**
- active: `"default"`
- spare creative: `true`
- tweaks1_5: `true`
- shortterm limit: `4`
- normal limit: `15`
- actions: `cancel vl>50 log:fastclick:3:5:cif cancel`

### INVENTORY_INSTANTBOW

**Intent**: detect shooting bows without adequate charge time.

**Default config**
- active: `"default"`
- strict: `true`
- delay: `130` ms
- improbable feedonly: `false`
- improbable weight: `0.6`
- actions: `cancel vl>15 log:instantbow:2:5:if cancel`

**How it works (core logic)**
- Estimates expected pull duration from shot force using a non-linear curve:
  - weak shots require relatively little time
  - strong shots require close to the maximum pull time
- Subtracts `instantbow.delay` to allow a small grace margin.
- Measures pull duration:
  - strict: `now - lastInteractTimestamp` (requires a valid “interact marker”)
  - non-strict: `now - lastShootTimestamp`
- Applies lag correction for valid pulls (scales duration by a lag factor).
- If corrected duration is still too short:
  - adds a scaled difference to VL and executes actions.

### INVENTORY_INSTANTEAT

**Default config**
- active: `"default"`
- actions: `log:instanteat:2:5:if cancel`

**How it works (core logic)**
- Triggered by **food level changes**, with a guard that the player’s hunger actually increased.
- Uses an “interact timestamp” (and also the last inventory click time) to estimate when eating could plausibly have finished:
  - expected finish time ≈ `max(lastInteract, lastClickTime) + 700ms`
- If hunger rises too early relative to that expected finish time:
  - adds a scaled difference to `instantEatVL` and executes actions.
- Resets the per-eat markers after evaluation.

### INVENTORY_FASTCONSUME

**Default config**
- active: `"default"`
- duration: `0.7` (seconds; consumed too quickly)
- whitelist: `false`
- items: `[]`
- actions: `log:fastconsume:2:5:if cancel`

**Note (this repo snapshot)**
- The config keys for `INVENTORY_FASTCONSUME` exist, but this NoCheatPlus tree does **not** include an implementation class under `checks/inventory/` for fast-consume. Treat it as **config-only** here.

### INVENTORY_GUTENBERG

**Intent**: detect invalid inventory data / click packets (anti crash/invalid data).

**Default config**
- active: `"default"`
- actions: `cancel log:gutenberg:0:10:icf cmd:kickinvaliddata`

**Note (this repo snapshot)**
- The config key `INVENTORY_GUTENBERG_ACTIONS` exists, but this NoCheatPlus tree does **not** include an implementation class under `checks/inventory/` for “Gutenberg”. Treat it as **config-only** here.

### INVENTORY_ITEMS / INVENTORY_OPEN

These are implemented in this tree and their behavior is mostly “hardening” rather than rate limiting.

**INVENTORY_ITEMS (illegal enchantments on books)**
- Looks for `WRITTEN_BOOK` items that have enchantments applied (a legacy illegal-item vector).
- If enabled, it removes all enchantments from the item (checks main-hand and off-hand where supported).
- This is effectively a sanitization step, not a “score and punish” check.

**INVENTORY_OPEN (inventory-open guard)**
- Detects whether the player has an inventory UI open and can optionally:
  - force-close the inventory (`openClose=true`)
  - recommend cancelling other actions while inventory is open (`openCancelOther=true`)
- Also includes an NPC exemption and a reentrancy guard to avoid recursion when closing inventories.

---

## MOVING checks (largest subsystem)

NCP moving is a full movement model with:
- per-move model state (`PlayerMoveData`)
- friction / envelope constraints
- “lost ground” workarounds
- velocity tracking and invalidation rules
- a setback system (teleporting player back on violation)

### MOVING_UNUSEDVELOCITY (debug helper; not a leaf `CheckType`)

**Intent**: diagnose “unused velocity” situations (knockback not applied / blocked movement) and help tune velocity handling.

**How it works (in this codebase)**
- Tracks whether an axis/direction has been “blocked” recently, and records velocity values that were added while not blocked.
- In this snapshot it is **debug-only**: it logs counters and then resets its internal result counters, and does not produce punitive outcomes.

### MOVING_MOREPACKETS

**Intent**: detect speed via sending too many movement packets (packet-timer / packet spam) to bypass physics checks.

**How it works**
- Treats movement packets as a frequency stream and checks:
  - EPS (events/packets per second) relative to ideal and max
  - burst constraints (packets in short windows; “direct” burst; EPM)
- Maintains a special setback location for this check and refreshes it when the player has been “clean” long enough.
- Uses a shared Net/static frequency utility and tags for debug.

**Default config**
- active: `"default"`
- seconds (window): `6`
- eps ideal: `20`
- eps max: `22`
- burst.packets: `40`
- burst.direct: `60`
- burst.epm: `180`
- setback age: `40`
- actions: `cancel vl>10 log:morepackets:0:2:if cancel vl>100 log:morepackets:0:2:if cancel cmd:kickpackets`

### MOVING_NOFALL

**Intent**: detect no-fall / spoofed onGround state / critical prevention hacks.

**Default config**
- active: `"default"`
- dealdamage: `true`
- skipallowflight: `true`
- resetonvl: `false`
- resetontp: `false`
- resetonvehicle: `true`
- anticriticals: `true`
- actions: `log:nofall:0:5:if cancel vl>30 log:nofall:0:5:icf cancel`

### MOVING_PASSABLE

**Intent**: detect moving through solid blocks / clipping.

**Default config**
- active: `"default"`
- actions: `cancel vl>10 log:passable:0:5:if cancel vl>50 log:passable:0:5:icf cancel`
- plus “untracked teleport/command” escape-hatches:
  - untracked teleport active: `true`
  - untracked cmd active: `true`
  - cmd tryteleport: `true`
  - cmd prefixes list (home/setwarp/back etc.)

**Packet-only feasibility**
- Not directly feasible without world collision state.

**How it works (core logic)**
- Runs an axis-wise swept collision (“passable ray tracing”) between `from` and `to` using the player’s bounding box margins.
- Uses a small reduction factor on margins (to avoid common false positives around tight blocks like doors/fences).
- Tries multiple axis orders:
  - starts with vertical-first ordering
  - if a collision is detected, tries alternate horizontal orderings depending on which axis collided
- Optionally integrates a block-change tracker so recently changed blocks don’t cause immediate false positives.
- If collision remains:
  - increments passable VL and executes actions
  - on cancel, teleports back to stored setback location if available, else back to `from`.

### MOVING_SURVIVALFLY

**Intent**: full survival movement envelope: jump height, speed, mid-air acceleration limits, bunny hop patterns, water/lava, sneaking/sprinting nuances, velocity interactions, and many workarounds.

**Implementation notes (high-level)**
- The check consumes “from/to” locations per move, plus a rich internal state:
  - whether on-ground, touched ground, reset conditions
  - sprint grace handling (e.g., hunger/latency)
  - per-move friction selection
  - “lost ground” recovery (block placement under player, chunk changes)
  - velocity receipt and usage tracking
  - multi-move splitting
  - hover detection and special handling (separate hover subsystem)
- Emits tags for debug to explain which branch triggered.

**Default config (selected)**
- active: `"default"`
- stepheight: `"default"`
- extended vertical acceleration: `true`
- leniency:
  - hbufmax: `1.0`
  - freezecount: `40`
  - freezeinair: `true`
- setback policy:
  - falldamage: `true`
  - voidtovoid: `true`
- actions: a longer default string under `checks.moving.survivalfly.actions` (multi-stage cancel/log/tempkick style)
- hover helper (not a check type):
  - hover.check: `true`
  - hover.step: `5`
  - hover.ticks: `85`
  - hover.loginticks: `60`
  - hover.falldamage: `true`
  - hover.sfviolation: `500`

**Packet-only feasibility**
- A “full NCP survivalfly” requires server collision and block data. In packet-only mode we typically implement a **conservative subset** (airtime/hover heuristics, timer/morepackets, obvious vertical anomalies).

### MOVING_CREATIVEFLY

**Intent**: creative/spectator flight envelope, including special models (elytra, levitation), and optionally ignoring allow-flight.

**Default config (selected)**
- active: `"default"`
- ignoreallowflight: `true`
- ignorecreative: `false`
- model parameters (percent scalars and caps):
  - creative horizontal speed: `100`
  - creative vertical ascend speed: `100`
  - creative vertical maxheight: `128`
  - spectator horizontal speed: `450`
  - spectator vertical ascend speed: `170`
  - spectator maxheight: `128`
  - spectator gravity: `false`, ground: `false`
  - levitation horizontal: `50`, ascend: `10`, gravity: `false`, modifiers: `false`
  - elytra horizontal: `520`, sprint modifier: `1.0`, ascend: `0`, modifiers: `false`
- actions: long multi-stage cancel/log string

**How it works (core logic)**
- Chooses a “flying model” based on game mode and special movement states (creative vs spectator vs levitation vs elytra).
- For each move, computes:
  - horizontal violation: \(h\_dist - h\_limit\) under the selected model and sprint grace
  - vertical violation using separate branches for ascend/descend/keep-altitude
- Applies queued velocity allowances:
  - subtracts “horizontal freedom” from horizontal violation
  - can fully forgive vertical violations when vertical velocity is present
- Scales violations to “percent of a block” and adds them together, adds to `creativeFlyVL`, then executes actions.
- Also enforces a maximum height: if exceeded, it can “silently” set back even with no computed violation.

### MOVING_VEHICLE checks

**MOVING_VEHICLE_MOREPACKETS**
- active: `"default"`
- actions: `cancel vl>10 log:morepackets:0:2:if cancel`

**MOVING_VEHICLE_ENVELOPE**
- active: `"default"`
- actions: `cancel vl>100 cancel log:vehicleenvelope:0:15:icf`

---

## NET checks

### NET_ATTACKFREQUENCY

**Intent**: detect attack packet spam over multiple windows (anti crash/exploit and macro).

**Default config**
- active: `"default"`
- window sizes (seconds): half=10, one=15, two=30, four=60, eight=100
- actions: `cancel vl>30 cancel log:attackfrequency:0:5:if vl>160 cancel log:attackfrequency:0:0:cif cmd:kickattackfrequency`

**How it works (core logic)**
- Maintains a bucketed count of attack events and evaluates multiple horizons.
- For each horizon, it computes `sum - limit` and uses the maximum exceedance as the instantaneous VL.
- Triggers actions immediately when exceeding (this is not primarily a “slowly accumulating” VL check).
- Feeds improbable via a tick-task request so that repeated exceedances raise global suspicion.

### NET_FLYINGFREQUENCY

**Intent**: detect excessive movement “flying” packet rate (crash/exploit).

**Default config**
- active: `"default"`
- seconds: `5`
- packets per second: `60`
- actions: `cancel`
- redundant sub-check:
  - redundant.active: `true`
  - redundant.seconds: `3`
  - redundant.actions: `cancel`

**How it works (core logic)**
- Counts all incoming “flying” (movement) packets using a bucketed counter and derives packets-per-second:
  - \(pps = score / seconds\)
- If `pps > configuredPPS`, it executes actions using `(pps - configuredPPS)` as the violation amount.
- **Redundant sub-check note**: this source tree contains config and data structures for tracking redundant flying packets, but the enforcement logic is not in the `FlyingFrequency` check class itself (it’s likely handled at the packet/event integration layer). For our reimplementation, we can either:
  - implement only the “all flying packets PPS” limit, or
  - add a second limiter for “redundant packets” once we define “redundant” from our batch fields (e.g., no position change, small look delta).

### NET_KEEPALIVEFREQUENCY

**Intent**: detect abnormal keepalive patterns.

**Default config**
- active: `"default"`
- actions: `cancel vl>10 cancel log:keepalive:0:10:if vl>40 cancel log:keepalive:0:10:icf vl>100 cancel log:keepalive:0:10:icf cmd:kickalive`

**How it works (core logic)**
- Keeps a bucketed count of keepalive packets.
- If the latest bucket contains more than one keepalive, it computes:
  - `vl = max(firstBucketCount - 1, totalCount - numberOfBuckets)`
- Executes actions using that `vl`.

### NET_PACKETFREQUENCY

**Intent**: fallback global packet-per-second limiter (primarily anti crash; coarse).

**How it works**
- Bucketed counter of “all packets” and converts to packets/sec.
- Applies lag scaling over window duration.

**Default config**
- active: `"default"`
- pps: `200`
- seconds: `4`
- actions: `cancel cmd:kickpacketfrequency`

### NET_SOUNDDISTANCE

**Intent**: detect sound packets too far away (anti exploit).

**Default config**
- active: `"default"`
- maxdistance: `320`

---

## Quick feasibility summary (for our upcoming Rust module work)

Great packet-only candidates:
- **MOVING_MOREPACKETS**, **NET_*FREQUENCY**, **FIGHT_SPEED**, **FIGHT_ANGLE** (with some care), **INVENTORY_FASTCLICK**, **BLOCKBREAK_FREQUENCY**, **BLOCKPLACE_FASTPLACE**, **NOSWING** checks (if animation captured)

Needs world/entity state (hard in packet-only):
- Most **direction/visible/passable/reach** checks unless we enrich batches with world probes or server-side entity snapshots.

---

## Implementation Summary (ncp_module)

The `ncp_module` Rust service implements the following NCP-inspired checks using packet-batch data:

### Combat checks (via `combat_events_v1_ndjson_gz` transform)

| Check | Detector Name | Description | Default Threshold |
|-------|---------------|-------------|-------------------|
| **Angle** | `ncp_fight_angle` | Detects aimbot via rapid target switching + low movement + high yaw change | threshold=50 |
| **Speed** | `ncp_fight_speed` | Detects attack rate exceeding limit (attacks per second) | limit_aps=8.0 |
| **Reach** | `ncp_fight_reach` | Detects hits beyond plausible reach distance | limit_blocks=4.4 |
| **Direction** | `ncp_fight_direction` | Detects hits outside field of view (aim_off metric) | threshold=0.1 |
| **WrongTurn** | `ncp_fight_wrongturn` | Detects invalid pitch values (> ±90°) | immediate |
| **NoSwing** | `ncp_fight_noswing` | Detects attacks without preceding arm swing animation | threshold=3 consecutive |

### Movement checks (via `movement_events_v1_ndjson_gz` transform)

| Check | Detector Name | Description | Default Threshold |
|-------|---------------|-------------|-------------------|
| **Speed** | `ncp_moving_speed_basic` | Detects horizontal movement exceeding limit | limit_bps=15.0 |
| **MorePackets** | `ncp_moving_morepackets_basic` | Detects packet intervals below plausible minimum | dt_ms<5.0 |
| **NoFall** | `ncp_moving_nofall_basic` | Detects claiming on_ground=true while falling | dy<-3.0 |
| **Timer** | `ncp_moving_timer` | Detects client timer running faster than server | pps>22 (20*1.1 tolerance) |

### Net-level checks (via flying packet events)

| Check | Detector Name | Description | Default Threshold |
|-------|---------------|-------------|-------------------|
| **FlyingFrequency** | `ncp_net_flyingfrequency` | Detects excessive flying packet rate | max_pps=60 (5s window) |

### Inventory checks (via inventory click events)

| Check | Detector Name | Description | Default Threshold |
|-------|---------------|-------------|-------------------|
| **FastClick** | `ncp_inventory_fastclick` | Detects rapid inventory manipulation | shortterm=4, normal=15 |

### Configuration

All thresholds are configurable via environment variables:

```bash
# Fight config
FIGHT_ANGLE_THRESHOLD=50
FIGHT_SPEED_LIMIT_APS=8.0
FIGHT_REACH_LIMIT_BLOCKS=4.4
FIGHT_DIRECTION_OFF_THRESHOLD=0.1

# Moving config
MOVING_SPEED_LIMIT_BPS=15.0
```

### VL decay

All checks use NCP-style exponential decay (0.9-0.98 multiplier) when the player passes the check, preventing indefinite VL accumulation from occasional anomalies.

---

## Checks NOT implemented (require world/entity state)

The following NCP checks are **not feasible** with packet-batch data alone:

- **MOVING_PASSABLE** - requires world collision data
- **MOVING_SURVIVALFLY** - requires full physics model + world blocks
- **FIGHT_CRITICAL** - requires fall distance from server
- **BLOCKBREAK_DIRECTION/VISIBLE** - requires block positions
- **BLOCKPLACE_AGAINST/DIRECTION** - requires world state

These would require enriching batch data with server-side world snapshots or implementing a lightweight world model.


