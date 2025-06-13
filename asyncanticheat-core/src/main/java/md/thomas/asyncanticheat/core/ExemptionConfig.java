package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Configuration for player exemptions from packet capture.
 * 
 * <p>
 * Based on analysis of three major anticheats:
 * <ul>
 * <li>NoCheatPlus: MovingConfig, ExemptionSettings</li>
 * <li>established AC: config.yml checks.move.*, automatic exemptions</li>
 * <li>reference anticheat: settings.ignore-*, grace windows</li>
 * </ul>
 * 
 * <p>
 * Default values are chosen based on what all three agree on,
 * with grace periods based on reference anticheat's battle-tested values.
 */
public final class ExemptionConfig {

    // ============= GAMEMODE EXEMPTIONS =============
    // All three anticheats handle these

    /** Skip capture for players in Spectator mode. Always recommended. */
    private boolean skipSpectatorMode = true;

    /**
     * Skip capture for players in Creative mode.
     * Set false if you want to capture creative data for analysis with labels.
     */
    private boolean skipCreativeMode = true;

    // ============= PLAYER STATE EXEMPTIONS =============
    // established AC and NCP both exempt these - meaningless data

    /** Skip capture for dead players. No useful movement data. */
    private boolean skipDead = true;

    /** Skip capture for sleeping players. Immobilized state. */
    private boolean skipSleeping = true;

    /** Skip capture for players in vehicles. Different physics apply. */
    private boolean skipInVehicle = true;

    // ============= FLIGHT EXEMPTIONS =============
    // established AC: checks.move.check_flying (default: false = exempt)
    // NCP: ignoreAllowFlight config

    /** Skip capture for players currently flying. */
    private boolean skipFlying = true;

    /** Skip capture for players gliding with elytra. */
    private boolean skipElytraGliding = false;

    // ============= BEDROCK/GEYSER EXEMPTIONS =============
    // Both established AC and reference anticheat exempt by default - different physics!

    /**
     * Skip capture for Bedrock clients (via Floodgate/Geyser).
     * HIGHLY RECOMMENDED - Bedrock has fundamentally different movement.
     * Both established AC and reference anticheat exempt these by default.
     */
    private boolean skipBedrockClients = true;

    /** Username prefix that identifies Geyser players (reference anticheat: "*"). */
    private String geyserUsernamePrefix = ".";

    // ============= GRACE PERIODS =============
    // Based on reference anticheat's values which are battle-tested

    /**
     * Grace period (ms) after join during which to skip capture.
     * reference anticheat default: 2500ms
     */
    private long joinGraceMs = 2500;

    /**
     * Grace period (ms) after respawn during which to skip capture.
     * Based on NCP patterns.
     */
    private long respawnGraceMs = 500;

    /**
     * Grace period (ms) after teleport during which to skip capture.
     * Position data is unreliable during teleport confirmation.
     */
    private long teleportGraceMs = 200;

    /**
     * Grace period (ms) after world change during which to skip capture.
     * Based on NCP patterns.
     */
    private long worldChangeGraceMs = 500;

    /**
     * Grace period (ticks) after receiving velocity during which to skip capture.
     * reference anticheat default: 50 ticks (2.5 seconds)
     */
    private int velocityGraceTicks = 50;

    /**
     * Grace period (ticks) after stopping flight during which to skip capture.
     * reference anticheat default: 40 ticks (2 seconds)
     */
    private int flightCooldownTicks = 40;

    // ============= POTION EFFECT EXEMPTIONS =============
    // NCP has special handling for these

    /** Skip capture for players with Levitation effect. */
    private boolean skipLevitationEffect = false;

    /** Skip capture for players with Slow Falling effect. */
    private boolean skipSlowFallingEffect = false;

    // ============= LOADERS =============

    public void loadFromMap(@NotNull Map<String, Object> data) {
        // Gamemode
        skipSpectatorMode = getBoolean(data, "skip_spectator_mode", skipSpectatorMode);
        skipCreativeMode = getBoolean(data, "skip_creative_mode", skipCreativeMode);

        // Player state
        skipDead = getBoolean(data, "skip_dead", skipDead);
        skipSleeping = getBoolean(data, "skip_sleeping", skipSleeping);
        skipInVehicle = getBoolean(data, "skip_in_vehicle", skipInVehicle);

        // Flight
        skipFlying = getBoolean(data, "skip_flying", skipFlying);
        skipElytraGliding = getBoolean(data, "skip_elytra_gliding", skipElytraGliding);

        // Bedrock/Geyser
        skipBedrockClients = getBoolean(data, "skip_bedrock_clients", skipBedrockClients);
        geyserUsernamePrefix = getString(data, "geyser_username_prefix", geyserUsernamePrefix);

        // Grace periods
        joinGraceMs = getLong(data, "join_grace_ms", joinGraceMs);
        respawnGraceMs = getLong(data, "respawn_grace_ms", respawnGraceMs);
        teleportGraceMs = getLong(data, "teleport_grace_ms", teleportGraceMs);
        worldChangeGraceMs = getLong(data, "world_change_grace_ms", worldChangeGraceMs);
        velocityGraceTicks = getInt(data, "velocity_grace_ticks", velocityGraceTicks);
        flightCooldownTicks = getInt(data, "flight_cooldown_ticks", flightCooldownTicks);

        // Potion effects
        skipLevitationEffect = getBoolean(data, "skip_levitation_effect", skipLevitationEffect);
        skipSlowFallingEffect = getBoolean(data, "skip_slow_falling_effect", skipSlowFallingEffect);
    }

    @NotNull
    public Map<String, Object> toMap() {
        return Map.ofEntries(
                // Gamemode - established AC/NCP both exempt
                Map.entry("skip_spectator_mode", skipSpectatorMode),
                Map.entry("skip_creative_mode", skipCreativeMode),

                // Player state - meaningless data
                Map.entry("skip_dead", skipDead),
                Map.entry("skip_sleeping", skipSleeping),
                Map.entry("skip_in_vehicle", skipInVehicle),

                // Flight - different physics
                Map.entry("skip_flying", skipFlying),
                Map.entry("skip_elytra_gliding", skipElytraGliding),

                // Bedrock - established AC and reference anticheat both exempt by default
                Map.entry("skip_bedrock_clients", skipBedrockClients),
                Map.entry("geyser_username_prefix", geyserUsernamePrefix),

                // Grace periods - based on reference anticheat's values
                Map.entry("join_grace_ms", joinGraceMs),
                Map.entry("respawn_grace_ms", respawnGraceMs),
                Map.entry("teleport_grace_ms", teleportGraceMs),
                Map.entry("world_change_grace_ms", worldChangeGraceMs),
                Map.entry("velocity_grace_ticks", velocityGraceTicks),
                Map.entry("flight_cooldown_ticks", flightCooldownTicks),

                // Potion effects
                Map.entry("skip_levitation_effect", skipLevitationEffect),
                Map.entry("skip_slow_falling_effect", skipSlowFallingEffect));
    }

    @NotNull
    public Set<ExemptionReason> getActiveExemptionReasons() {
        final EnumSet<ExemptionReason> active = EnumSet.noneOf(ExemptionReason.class);

        if (skipSpectatorMode)
            active.add(ExemptionReason.SPECTATOR_MODE);
        if (skipCreativeMode)
            active.add(ExemptionReason.CREATIVE_MODE);
        if (skipDead)
            active.add(ExemptionReason.DEAD);
        if (skipSleeping)
            active.add(ExemptionReason.SLEEPING);
        if (skipInVehicle)
            active.add(ExemptionReason.IN_VEHICLE);
        if (skipFlying)
            active.add(ExemptionReason.FLYING);
        if (skipElytraGliding)
            active.add(ExemptionReason.ELYTRA_GLIDING);
        if (skipBedrockClients)
            active.add(ExemptionReason.BEDROCK_CLIENT);
        if (joinGraceMs > 0)
            active.add(ExemptionReason.JUST_JOINED);
        if (respawnGraceMs > 0)
            active.add(ExemptionReason.JUST_RESPAWNED);
        if (teleportGraceMs > 0)
            active.add(ExemptionReason.JUST_TELEPORTED);
        if (worldChangeGraceMs > 0)
            active.add(ExemptionReason.WORLD_CHANGE);
        if (velocityGraceTicks > 0)
            active.add(ExemptionReason.VELOCITY_GRACE);
        if (flightCooldownTicks > 0)
            active.add(ExemptionReason.FLIGHT_COOLDOWN);
        if (skipLevitationEffect)
            active.add(ExemptionReason.LEVITATION_EFFECT);
        if (skipSlowFallingEffect)
            active.add(ExemptionReason.SLOW_FALLING_EFFECT);

        return active;
    }

    // ============= GETTERS =============

    public boolean isSkipSpectatorMode() {
        return skipSpectatorMode;
    }

    public boolean isSkipCreativeMode() {
        return skipCreativeMode;
    }

    public boolean isSkipDead() {
        return skipDead;
    }

    public boolean isSkipSleeping() {
        return skipSleeping;
    }

    public boolean isSkipInVehicle() {
        return skipInVehicle;
    }

    public boolean isSkipFlying() {
        return skipFlying;
    }

    public boolean isSkipElytraGliding() {
        return skipElytraGliding;
    }

    public boolean isSkipBedrockClients() {
        return skipBedrockClients;
    }

    @NotNull
    public String getGeyserUsernamePrefix() {
        return geyserUsernamePrefix;
    }

    public long getJoinGraceMs() {
        return joinGraceMs;
    }

    public long getRespawnGraceMs() {
        return respawnGraceMs;
    }

    public long getTeleportGraceMs() {
        return teleportGraceMs;
    }

    public long getWorldChangeGraceMs() {
        return worldChangeGraceMs;
    }

    public int getVelocityGraceTicks() {
        return velocityGraceTicks;
    }

    public int getFlightCooldownTicks() {
        return flightCooldownTicks;
    }

    public boolean isSkipLevitationEffect() {
        return skipLevitationEffect;
    }

    public boolean isSkipSlowFallingEffect() {
        return skipSlowFallingEffect;
    }

    // ============= HELPER METHODS =============

    private static boolean getBoolean(Map<String, Object> map, String key, boolean def) {
        Object value = map.get(key);
        if (value instanceof Boolean b)
            return b;
        if (value == null)
            return def;
        return Boolean.parseBoolean(value.toString());
    }

    private static int getInt(Map<String, Object> map, String key, int def) {
        Object value = map.get(key);
        if (value instanceof Number n)
            return n.intValue();
        try {
            return value == null ? def : Integer.parseInt(value.toString());
        } catch (Exception ignored) {
            return def;
        }
    }

    private static long getLong(Map<String, Object> map, String key, long def) {
        Object value = map.get(key);
        if (value instanceof Number n)
            return n.longValue();
        try {
            return value == null ? def : Long.parseLong(value.toString());
        } catch (Exception ignored) {
            return def;
        }
    }

    private static String getString(Map<String, Object> map, String key, String def) {
        Object value = map.get(key);
        return value != null ? value.toString() : def;
    }
}
