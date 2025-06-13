package md.thomas.asyncanticheat.velocity;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.PostLoginEvent;
import com.velocitypowered.api.event.player.ServerConnectedEvent;
import com.velocitypowered.api.proxy.Player;
import md.thomas.asyncanticheat.core.ExemptionConfig;
import md.thomas.asyncanticheat.core.ExemptionReason;
import md.thomas.asyncanticheat.core.PlayerExemptionTracker;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

/**
 * Velocity-specific player exemption tracker.
 * 
 * <p>
 * Extends the core {@link PlayerExemptionTracker} with Velocity event handling.
 * On a proxy, we can only track:
 * <ul>
 * <li>Bedrock/Geyser clients (via UUID/username/Floodgate API)</li>
 * <li>Join grace period</li>
 * <li>Server switch grace period</li>
 * </ul>
 * 
 * <p>
 * State-based exemptions (gamemode, flying, dead, etc.) are NOT available
 * on proxies - use the Bukkit backend for full exemption support.
 */
public final class VelocityPlayerExemptionTracker extends PlayerExemptionTracker {

    public VelocityPlayerExemptionTracker(@NotNull ExemptionConfig config) {
        super(config);
    }

    /**
     * Check if a Velocity player should be exempted from packet capture.
     * 
     * @param player The player to check
     * @return The first exemption reason found, or null if player should be captured
     */
    @Nullable
    public ExemptionReason getExemptionReason(@Nullable Player player) {
        if (player == null) {
            return null;
        }
        return super.getExemptionReason(player.getUniqueId(), player.getUsername());
    }

    /**
     * Quick check if player should be exempted.
     */
    public boolean isExempt(@Nullable Player player) {
        return getExemptionReason(player) != null;
    }

    // ============= EVENT HANDLERS =============

    @Subscribe
    public void onPostLogin(PostLoginEvent event) {
        final Player player = event.getPlayer();
        super.onPlayerJoin(player.getUniqueId(), player.getUsername());
    }

    @Subscribe
    public void onDisconnect(DisconnectEvent event) {
        super.onPlayerQuit(event.getPlayer().getUniqueId());
    }

    @Subscribe
    public void onServerConnected(ServerConnectedEvent event) {
        // Server switch = like world change, data may be unreliable
        // Only trigger if this is NOT the initial connection
        if (event.getPreviousServer().isPresent()) {
            super.onServerSwitch(event.getPlayer().getUniqueId());
        }
    }
}

