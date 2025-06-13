package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Core player exemption tracker that works across all platforms (Bukkit, Bungee, Velocity).
 * 
 * <p>
 * This base implementation handles exemptions that can be determined from:
 * <ul>
 * <li>UUID (Bedrock/Geyser detection)</li>
 * <li>Username (Geyser prefix detection)</li>
 * <li>Connection timing (join grace period)</li>
 * </ul>
 * 
 * <p>
 * Platform-specific trackers (Bukkit) extend this to add state-based exemptions
 * like gamemode, flying, dead, sleeping, etc.
 */
public class PlayerExemptionTracker {

    protected final ExemptionConfig config;
    protected final Map<UUID, PlayerConnectionState> connectionStates = new ConcurrentHashMap<>();

    // Floodgate API detection (lazy loaded, shared across instances)
    private static Boolean floodgateAvailable = null;

    /**
     * Minimal connection state that can be tracked on any platform.
     */
    protected static class PlayerConnectionState {
        volatile long joinTime = 0;
        volatile long serverSwitchTime = 0; // For proxies: when player switched backend server
        volatile boolean isBedrock = false;
        volatile String username = null;
    }

    public PlayerExemptionTracker(@NotNull ExemptionConfig config) {
        this.config = config;
    }

    /**
     * Check if a player should be exempted from packet capture.
     * This base implementation only checks proxy-compatible exemptions.
     * 
     * @param uuid     Player UUID (required)
     * @param username Player username (optional, used for Geyser prefix detection)
     * @return The first exemption reason found, or null if player should be captured
     */
    @Nullable
    public ExemptionReason getExemptionReason(@Nullable UUID uuid, @Nullable String username) {
        if (uuid == null) {
            return null;
        }

        final PlayerConnectionState state = connectionStates.get(uuid);
        final long now = System.currentTimeMillis();

        // Bedrock client check (cached on join)
        if (config.isSkipBedrockClients()) {
            if (state != null && state.isBedrock) {
                return ExemptionReason.BEDROCK_CLIENT;
            }
            // Also check live if not cached (e.g., player connected before tracking started)
            if (checkIsBedrock(uuid, username)) {
                return ExemptionReason.BEDROCK_CLIENT;
            }
        }

        // Grace periods
        if (state != null) {
            if (config.getJoinGraceMs() > 0 && (now - state.joinTime) < config.getJoinGraceMs()) {
                return ExemptionReason.JUST_JOINED;
            }

            // Server switch grace (for proxies)
            if (config.getWorldChangeGraceMs() > 0 && state.serverSwitchTime > 0 &&
                    (now - state.serverSwitchTime) < config.getWorldChangeGraceMs()) {
                return ExemptionReason.WORLD_CHANGE;
            }
        }

        return null; // No exemption at this level
    }

    /**
     * Quick check if player should be exempted.
     */
    public boolean isExempt(@Nullable UUID uuid, @Nullable String username) {
        return getExemptionReason(uuid, username) != null;
    }

    /**
     * Called when a player connects.
     */
    public void onPlayerJoin(@NotNull UUID uuid, @NotNull String username) {
        final PlayerConnectionState state = new PlayerConnectionState();
        state.joinTime = System.currentTimeMillis();
        state.username = username;
        state.isBedrock = checkIsBedrock(uuid, username);
        connectionStates.put(uuid, state);
    }

    /**
     * Called when a player disconnects.
     */
    public void onPlayerQuit(@NotNull UUID uuid) {
        connectionStates.remove(uuid);
    }

    /**
     * Called when a player switches backend server (proxy only).
     */
    public void onServerSwitch(@NotNull UUID uuid) {
        final PlayerConnectionState state = connectionStates.get(uuid);
        if (state != null) {
            state.serverSwitchTime = System.currentTimeMillis();
        }
    }

    /**
     * Check if player is a Bedrock client.
     * Uses multiple detection methods (like reference anticheat):
     * 1. Floodgate API (if available)
     * 2. Username prefix (configurable)
     * 3. UUID prefix (Geyser uses 00000000-0000-0000 prefix)
     */
    protected boolean checkIsBedrock(@NotNull UUID uuid, @Nullable String username) {
        // Method 1: Floodgate API (most reliable)
        if (isFloodgateAvailable()) {
            try {
                Class<?> floodgateApi = Class.forName("org.geysermc.floodgate.api.FloodgateApi");
                Object instance = floodgateApi.getMethod("getInstance").invoke(null);
                Boolean isFloodgate = (Boolean) floodgateApi.getMethod("isFloodgatePlayer", UUID.class)
                        .invoke(instance, uuid);
                if (Boolean.TRUE.equals(isFloodgate)) {
                    return true;
                }
            } catch (Exception ignored) {
                // Floodgate not available or error
            }
        }

        // Method 2: Username prefix (reference anticheat: ignore-geyser-prefixes)
        final String prefix = config.getGeyserUsernamePrefix();
        if (prefix != null && !prefix.isEmpty() && username != null && username.startsWith(prefix)) {
            return true;
        }

        // Method 3: UUID prefix (reference anticheat: ignore-geyser-uuids)
        // Geyser/Floodgate uses UUIDs starting with 00000000-0000-0000
        final String uuidStr = uuid.toString();
        if (uuidStr.startsWith("00000000-0000-0000")) {
            return true;
        }

        return false;
    }

    protected static boolean isFloodgateAvailable() {
        if (floodgateAvailable == null) {
            try {
                Class.forName("org.geysermc.floodgate.api.FloodgateApi");
                floodgateAvailable = true;
            } catch (ClassNotFoundException e) {
                floodgateAvailable = false;
            }
        }
        return floodgateAvailable;
    }

    /**
     * Check if a specific player is a Bedrock client (for external queries).
     */
    public boolean isBedrockPlayer(@NotNull UUID uuid) {
        final PlayerConnectionState state = connectionStates.get(uuid);
        if (state != null) {
            return state.isBedrock;
        }
        return checkIsBedrock(uuid, null);
    }

    /**
     * Get all exemption reasons for a player (for debugging).
     */
    @NotNull
    public Set<ExemptionReason> getAllExemptionReasons(@Nullable UUID uuid, @Nullable String username) {
        final java.util.EnumSet<ExemptionReason> reasons = java.util.EnumSet.noneOf(ExemptionReason.class);
        if (uuid == null) {
            return reasons;
        }

        final PlayerConnectionState state = connectionStates.get(uuid);
        final long now = System.currentTimeMillis();

        if (config.isSkipBedrockClients() && (state != null && state.isBedrock || checkIsBedrock(uuid, username))) {
            reasons.add(ExemptionReason.BEDROCK_CLIENT);
        }

        if (state != null) {
            if (config.getJoinGraceMs() > 0 && (now - state.joinTime) < config.getJoinGraceMs()) {
                reasons.add(ExemptionReason.JUST_JOINED);
            }
            if (config.getWorldChangeGraceMs() > 0 && state.serverSwitchTime > 0 &&
                    (now - state.serverSwitchTime) < config.getWorldChangeGraceMs()) {
                reasons.add(ExemptionReason.WORLD_CHANGE);
            }
        }

        return reasons;
    }

    /**
     * Clean up all tracked data.
     */
    public void cleanup() {
        connectionStates.clear();
    }
}

