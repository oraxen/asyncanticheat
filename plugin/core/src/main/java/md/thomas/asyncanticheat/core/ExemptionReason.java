package md.thomas.asyncanticheat.core;

/**
 * Reasons why a player might be exempted from packet capture.
 * 
 * <p>
 * Based on analysis of NoCheatPlus, established AC, and reference anticheat exemption systems:
 * <ul>
 * <li>NCP: MovingListener early returns,
 * MovingUtil.shouldCheckSurvivalFly()</li>
 * <li>established AC: iS exemption manager (creative, spectator, sleeping, dead,
 * floodgate)</li>
 * <li>reference anticheat: Global ignore rules, grace windows, Floodgate/Geyser
 * detection</li>
 * </ul>
 * 
 * <p>
 * Note: NPC checks are omitted because NPCs don't send packets.
 */
public enum ExemptionReason {

    // ============= GAMEMODE EXEMPTIONS =============
    // All three anticheats handle these specially
    // established AC: iS.r (creative), iS.l (spectator)
    // NCP: MovingUtil.shouldCheckSurvivalFly() checks gamemode

    /**
     * Player is in Spectator mode.
     * Spectators can fly through blocks and have no collision.
     * All major anticheats exempt this mode.
     */
    SPECTATOR_MODE,

    /**
     * Player is in Creative mode.
     * Creative players have different physics (instant break, flight).
     * established AC/NCP exempt; useful to still capture but label differently.
     */
    CREATIVE_MODE,

    // ============= PLAYER STATE EXEMPTIONS =============
    // established AC: iS.i (sleeping), iS.b (dead)
    // NCP: MovingListener.onPlayerMove() early returns

    /**
     * Player is dead.
     * No useful movement data - player cannot move.
     */
    DEAD,

    /**
     * Player is sleeping in a bed.
     * Player is immobilized - no useful movement data.
     */
    SLEEPING,

    /**
     * Player is inside a vehicle.
     * Vehicle movement uses completely different physics.
     * NCP uses separate VehicleChecks for this.
     */
    IN_VEHICLE,

    // ============= FLIGHT EXEMPTIONS =============
    // established AC: checks.move.check_flying config toggle
    // NCP: player.isFlying(), player.getAllowFlight()
    // reference anticheat: flight_cooldown (40 ticks after /fly)

    /**
     * Player is currently flying (creative flight or plugin-granted).
     * Uses different movement rules than survival movement.
     */
    FLYING,

    /**
     * Player is gliding with an elytra.
     * Elytra flight has completely different physics.
     */
    ELYTRA_GLIDING,

    // ============= BEDROCK/GEYSER EXEMPTIONS =============
    // established AC: iS.g (Floodgate detection on init)
    // reference anticheat: ignore-floodgate, ignore-geyser-uuids, ignore-geyser-prefixes
    // This is CRITICAL - Bedrock has fundamentally different movement physics

    /**
     * Player is a Bedrock client (via Floodgate/Geyser).
     * Bedrock has different movement physics that would cause false positives.
     * Both established AC and reference anticheat exempt these players by default.
     */
    BEDROCK_CLIENT,

    // ============= GRACE PERIOD EXEMPTIONS =============
    // NCP: Various grace periods for unreliable data
    // reference anticheat: join-check-wait-time (2500ms), min-ticks-existed (3)
    // reference anticheat: max-velocity-ticks (50), flight-cooldown (40)

    /**
     * Player just joined the server.
     * Initial position data may be unreliable.
     * reference anticheat uses 2500ms grace period.
     */
    JUST_JOINED,

    /**
     * Player just respawned.
     * Position resets - data during transition is unreliable.
     */
    JUST_RESPAWNED,

    /**
     * Player just teleported.
     * Awaiting client position confirmation - data is unreliable.
     */
    JUST_TELEPORTED,

    /**
     * Player just changed worlds.
     * World transition resets movement state.
     */
    WORLD_CHANGE,

    /**
     * Player recently received external velocity (knockback, explosion, etc.).
     * Movement during this window is unpredictable.
     * reference anticheat uses 50 ticks (2.5 seconds) grace.
     */
    VELOCITY_GRACE,

    /**
     * Player recently stopped flying.
     * Transition period from flight to survival movement.
     * reference anticheat uses 40 ticks (2 seconds) cooldown.
     */
    FLIGHT_COOLDOWN,

    // ============= POTION EFFECT EXEMPTIONS =============
    // NCP: Bridge1_9.getLevitationAmplifier() checks
    // These significantly alter movement physics

    /**
     * Player has Levitation potion effect.
     * Dramatically alters vertical movement physics.
     */
    LEVITATION_EFFECT,

    /**
     * Player has Slow Falling potion effect.
     * Alters fall physics significantly.
     */
    SLOW_FALLING_EFFECT
}
