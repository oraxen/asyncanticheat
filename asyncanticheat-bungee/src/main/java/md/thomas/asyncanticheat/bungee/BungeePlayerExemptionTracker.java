package md.thomas.asyncanticheat.bungee;

import md.thomas.asyncanticheat.core.ExemptionConfig;
import md.thomas.asyncanticheat.core.ExemptionReason;
import md.thomas.asyncanticheat.core.PlayerExemptionTracker;
import net.md_5.bungee.api.connection.ProxiedPlayer;
import net.md_5.bungee.api.event.PlayerDisconnectEvent;
import net.md_5.bungee.api.event.PostLoginEvent;
import net.md_5.bungee.api.event.ServerSwitchEvent;
import net.md_5.bungee.api.plugin.Listener;
import net.md_5.bungee.event.EventHandler;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

/**
 * BungeeCord-specific player exemption tracker.
 * 
 * <p>
 * Extends the core {@link PlayerExemptionTracker} with BungeeCord event handling.
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
public final class BungeePlayerExemptionTracker extends PlayerExemptionTracker implements Listener {

    public BungeePlayerExemptionTracker(@NotNull ExemptionConfig config) {
        super(config);
    }

    /**
     * Check if a BungeeCord player should be exempted from packet capture.
     * 
     * @param player The player to check
     * @return The first exemption reason found, or null if player should be captured
     */
    @Nullable
    public ExemptionReason getExemptionReason(@Nullable ProxiedPlayer player) {
        if (player == null) {
            return null;
        }
        return super.getExemptionReason(player.getUniqueId(), player.getName());
    }

    /**
     * Quick check if player should be exempted.
     */
    public boolean isExempt(@Nullable ProxiedPlayer player) {
        return getExemptionReason(player) != null;
    }

    // ============= EVENT HANDLERS =============

    @EventHandler
    public void onPostLogin(PostLoginEvent event) {
        final ProxiedPlayer player = event.getPlayer();
        super.onPlayerJoin(player.getUniqueId(), player.getName());
    }

    @EventHandler
    public void onPlayerDisconnect(PlayerDisconnectEvent event) {
        super.onPlayerQuit(event.getPlayer().getUniqueId());
    }

    @EventHandler
    public void onServerSwitch(ServerSwitchEvent event) {
        // Server switch = like world change, data may be unreliable
        super.onServerSwitch(event.getPlayer().getUniqueId());
    }
}

