package md.thomas.asyncanticheat.bungee;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import md.thomas.asyncanticheat.core.PacketRecord;
import net.md_5.bungee.api.ChatColor;
import net.md_5.bungee.api.ProxyServer;
import net.md_5.bungee.api.connection.ProxiedPlayer;
import net.md_5.bungee.api.plugin.Plugin;
import net.md_5.bungee.api.scheduler.ScheduledTask;
import net.md_5.bungee.api.chat.TextComponent;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

final class BungeeDevModeManager {

    private final Plugin plugin;
    private final ProxyServer proxy;
    private final AsyncAnticheatService service;

    private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();

    BungeeDevModeManager(@NotNull Plugin plugin, @NotNull ProxyServer proxy, @NotNull AsyncAnticheatService service) {
        this.plugin = plugin;
        this.proxy = proxy;
        this.service = service;
    }

    boolean start(@NotNull ProxiedPlayer player, @NotNull String label, int durationSeconds, int warmupSeconds,
            int toggleSeconds) {
        stop(player, "restart");

        durationSeconds = Math.max(5, durationSeconds);
        warmupSeconds = Math.max(0, warmupSeconds);
        toggleSeconds = Math.max(2, toggleSeconds);

        final String devSessionId = UUID.randomUUID().toString();
        final Session s = new Session(player.getUniqueId(), devSessionId, label, durationSeconds, warmupSeconds,
                toggleSeconds);
        sessions.put(player.getUniqueId(), s);

        send(player, ChatColor.YELLOW + "[AsyncAnticheat Dev] Recording started (" + durationSeconds
                + "s). Keep cheat OFF.");
        enqueueMarker(player, devSessionId, label, "start", "off", Map.of(
                "duration_s", durationSeconds,
                "warmup_s", warmupSeconds,
                "toggle_s", toggleSeconds));

        s.task = proxy.getScheduler().schedule(plugin, () -> tick(player.getUniqueId()), 1, 1, TimeUnit.SECONDS);
        return true;
    }

    void stop(@NotNull ProxiedPlayer player, @NotNull String reason) {
        final Session s = sessions.remove(player.getUniqueId());
        if (s == null)
            return;
        if (s.task != null) {
            s.task.cancel();
        }
        send(player, ChatColor.YELLOW + "[AsyncAnticheat Dev] Recording stopped (" + reason + ").");
        enqueueMarker(player, s.devSessionId, s.label, "stop", s.cheatState, Map.of("reason", reason));
    }

    void stopAll(@NotNull String reason) {
        for (UUID id : sessions.keySet()) {
            final ProxiedPlayer p = proxy.getPlayer(id);
            if (p != null) {
                stop(p, reason);
            } else {
                sessions.remove(id);
            }
        }
    }

    @Nullable
    Session getSession(@NotNull UUID playerId) {
        return sessions.get(playerId);
    }

    private void tick(@NotNull UUID playerId) {
        final Session s = sessions.get(playerId);
        if (s == null)
            return;
        final ProxiedPlayer player = proxy.getPlayer(playerId);
        if (player == null) {
            sessions.remove(playerId);
            return;
        }

        s.elapsedSeconds++;
        if (s.elapsedSeconds >= s.durationSeconds) {
            stop(player, "finished");
            return;
        }

        if (!s.startedToggles) {
            if (s.elapsedSeconds >= s.warmupSeconds) {
                s.startedToggles = true;
                s.nextToggleAt = s.elapsedSeconds;
            } else {
                return;
            }
        }

        if (s.elapsedSeconds < s.nextToggleAt)
            return;

        s.cycleIndex++;
        if ("off".equalsIgnoreCase(s.cheatState)) {
            s.cheatState = "on";
            send(player, ChatColor.AQUA + "[AsyncAnticheat Dev] TOGGLE CHEAT ON now.");
            enqueueMarker(player, s.devSessionId, s.label, "toggle", "on", Map.of("cycle", s.cycleIndex));
        } else {
            s.cheatState = "off";
            send(player, ChatColor.AQUA + "[AsyncAnticheat Dev] TOGGLE CHEAT OFF now.");
            enqueueMarker(player, s.devSessionId, s.label, "toggle", "off", Map.of("cycle", s.cycleIndex));
        }
        s.nextToggleAt = s.elapsedSeconds + s.toggleSeconds;
    }

    private void enqueueMarker(
            @NotNull ProxiedPlayer player,
            @NotNull String devSessionId,
            @NotNull String label,
            @NotNull String phase,
            @NotNull String cheatState,
            @NotNull Map<String, Object> extra) {
        final Map<String, Object> fields = new HashMap<>();
        fields.put("dev_session_id", devSessionId);
        fields.put("dev_label", label);
        fields.put("dev_phase", phase);
        fields.put("dev_state", cheatState);
        fields.putAll(extra);
        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "dev",
                "DEV_MARKER",
                player.getUniqueId().toString(),
                player.getName(),
                fields));
    }

    private static void send(@NotNull ProxiedPlayer player, @NotNull String msg) {
        player.sendMessage(new TextComponent(msg));
    }

    static final class Session {
        final UUID playerId;
        final String devSessionId;
        final String label;
        final int durationSeconds;
        final int warmupSeconds;
        final int toggleSeconds;

        ScheduledTask task;
        int elapsedSeconds = 0;
        boolean startedToggles = false;
        int nextToggleAt = 0;
        int cycleIndex = 0;
        String cheatState = "off";

        Session(UUID playerId, String devSessionId, String label, int durationSeconds, int warmupSeconds,
                int toggleSeconds) {
            this.playerId = playerId;
            this.devSessionId = devSessionId;
            this.label = label;
            this.durationSeconds = durationSeconds;
            this.warmupSeconds = warmupSeconds;
            this.toggleSeconds = toggleSeconds;
        }
    }
}
