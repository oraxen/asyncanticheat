package md.thomas.asyncanticheat.velocity;

import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import com.velocitypowered.api.plugin.PluginContainer;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import md.thomas.asyncanticheat.core.PacketRecord;
import net.kyori.adventure.text.Component;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

final class VelocityDevModeManager {

    private final ProxyServer server;
    private final PluginContainer plugin;
    private final AsyncAnticheatService service;

    private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();

    VelocityDevModeManager(@NotNull ProxyServer server, @NotNull PluginContainer plugin, @NotNull AsyncAnticheatService service) {
        this.server = server;
        this.plugin = plugin;
        this.service = service;
    }

    boolean start(@NotNull Player player, @NotNull String label, int durationSeconds, int warmupSeconds, int toggleSeconds) {
        stop(player, "restart");

        durationSeconds = Math.max(5, durationSeconds);
        warmupSeconds = Math.max(0, warmupSeconds);
        toggleSeconds = Math.max(2, toggleSeconds);

        final String devSessionId = UUID.randomUUID().toString();
        final Session s = new Session(player.getUniqueId(), devSessionId, label, durationSeconds, warmupSeconds, toggleSeconds);
        sessions.put(player.getUniqueId(), s);

        send(player, "[AsyncAnticheat Dev] Recording started (" + durationSeconds + "s). Keep cheat OFF.");
        enqueueMarker(player, devSessionId, label, "start", "off", Map.of(
                "duration_s", durationSeconds,
                "warmup_s", warmupSeconds,
                "toggle_s", toggleSeconds
        ));

        s.task = server.getScheduler()
                .buildTask(plugin, () -> tick(player.getUniqueId()))
                .delay(Duration.ofSeconds(1))
                .repeat(Duration.ofSeconds(1))
                .schedule();
        return true;
    }

    void stop(@NotNull Player player, @NotNull String reason) {
        final Session s = sessions.remove(player.getUniqueId());
        if (s == null) return;
        if (s.task != null) {
            s.task.cancel();
        }
        send(player, "[AsyncAnticheat Dev] Recording stopped (" + reason + ").");
        enqueueMarker(player, s.devSessionId, s.label, "stop", s.cheatState, Map.of("reason", reason));
    }

    void stopAll(@NotNull String reason) {
        for (UUID id : sessions.keySet().toArray(new UUID[0])) {
            final Player p = server.getPlayer(id).orElse(null);
            if (p != null) {
                stop(p, reason);
            } else {
                stopSilent(id);
            }
        }
    }

    @Nullable
    Session getSession(@NotNull UUID playerId) {
        return sessions.get(playerId);
    }

    private void tick(@NotNull UUID playerId) {
        final Session s = sessions.get(playerId);
        if (s == null) return;
        final Player player = server.getPlayer(playerId).orElse(null);
        if (player == null) {
            // Player disconnected: cancel repeating task and remove session without emitting markers/messages.
            stopSilent(playerId);
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

        if (s.elapsedSeconds < s.nextToggleAt) return;

        s.cycleIndex++;
        if ("off".equalsIgnoreCase(s.cheatState)) {
            s.cheatState = "on";
            send(player, "[AsyncAnticheat Dev] TOGGLE CHEAT ON now.");
            enqueueMarker(player, s.devSessionId, s.label, "toggle", "on", Map.of("cycle", s.cycleIndex));
        } else {
            s.cheatState = "off";
            send(player, "[AsyncAnticheat Dev] TOGGLE CHEAT OFF now.");
            enqueueMarker(player, s.devSessionId, s.label, "toggle", "off", Map.of("cycle", s.cycleIndex));
        }
        s.nextToggleAt = s.elapsedSeconds + s.toggleSeconds;
    }

    private void enqueueMarker(
            @NotNull Player player,
            @NotNull String devSessionId,
            @NotNull String label,
            @NotNull String phase,
            @NotNull String cheatState,
            @NotNull Map<String, Object> extra
    ) {
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
                player.getUsername(),
                fields
        ));
    }

    private static void send(@NotNull Player player, @NotNull String msg) {
        player.sendMessage(Component.text(msg));
    }

    void stopSilent(@NotNull UUID playerId) {
        final Session s = sessions.remove(playerId);
        if (s == null) return;
        if (s.task != null) {
            s.task.cancel();
        }
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

        Session(UUID playerId, String devSessionId, String label, int durationSeconds, int warmupSeconds, int toggleSeconds) {
            this.playerId = playerId;
            this.devSessionId = devSessionId;
            this.label = label;
            this.durationSeconds = durationSeconds;
            this.warmupSeconds = warmupSeconds;
            this.toggleSeconds = toggleSeconds;
        }
    }
}


