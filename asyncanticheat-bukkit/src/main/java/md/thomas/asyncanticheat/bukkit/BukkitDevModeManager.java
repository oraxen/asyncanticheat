package md.thomas.asyncanticheat.bukkit;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import md.thomas.asyncanticheat.core.PacketRecord;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dev mode: create labeled segments inside the same packet stream by injecting "DEV_*" marker records.
 */
final class BukkitDevModeManager {

    private final Plugin plugin;
    private final AsyncAnticheatService service;

    private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();

    BukkitDevModeManager(@NotNull Plugin plugin, @NotNull AsyncAnticheatService service) {
        this.plugin = plugin;
        this.service = service;
    }

    boolean start(
            @NotNull Player player,
            @NotNull String label,
            int durationSeconds,
            int warmupSeconds,
            int toggleSeconds
    ) {
        stop(player, "restart");

        durationSeconds = Math.max(5, durationSeconds);
        warmupSeconds = Math.max(0, warmupSeconds);
        toggleSeconds = Math.max(2, toggleSeconds);

        final String devSessionId = UUID.randomUUID().toString();
        final Session s = new Session(player.getUniqueId(), devSessionId, label, durationSeconds, warmupSeconds, toggleSeconds);
        sessions.put(player.getUniqueId(), s);

        // Start in "OFF" state so the first label segment is clean.
        send(player, "[AsyncAnticheat Dev] Recording started (" + durationSeconds + "s). Keep cheat OFF.");
        enqueueMarker(player, devSessionId, label, "start", "off", Map.of(
                "duration_s", durationSeconds,
                "warmup_s", warmupSeconds,
                "toggle_s", toggleSeconds
        ));

        final UUID playerId = player.getUniqueId();
        s.taskId = Bukkit.getScheduler().scheduleSyncRepeatingTask(plugin, () -> tick(playerId), 20L, 20L);
        return true;
    }

    void stop(@NotNull Player player, @NotNull String reason) {
        final Session s = sessions.remove(player.getUniqueId());
        if (s == null) return;
        if (s.taskId != -1) {
            Bukkit.getScheduler().cancelTask(s.taskId);
        }
        send(player, "[AsyncAnticheat Dev] Recording stopped (" + reason + ").");
        enqueueMarker(player, s.devSessionId, s.label, "stop", s.cheatState, Map.of("reason", reason));
    }

    void stopAll(@NotNull String reason) {
        for (UUID id : sessions.keySet().toArray(new UUID[0])) {
            final Player p = Bukkit.getPlayer(id);
            if (p != null && p.isOnline()) {
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

    void stopSilent(@NotNull UUID playerId) {
        final Session s = sessions.remove(playerId);
        if (s == null) return;
        if (s.taskId != -1) {
            Bukkit.getScheduler().cancelTask(s.taskId);
        }
    }

    private void tick(@NotNull UUID playerId) {
        final Session s = sessions.get(playerId);
        if (s == null) return;
        final Player player = Bukkit.getPlayer(playerId);
        if (player == null || !player.isOnline()) {
            // Player disconnected - cancel repeating task and remove session without emitting markers/messages.
            stopSilent(playerId);
            return;
        }

        s.elapsedSeconds++;
        if (s.elapsedSeconds >= s.durationSeconds) {
            stop(player, "finished");
            return;
        }

        // Wait warmup period before first toggle ON.
        if (!s.startedToggles) {
            if (s.elapsedSeconds >= s.warmupSeconds) {
                s.startedToggles = true;
                s.nextToggleAt = s.elapsedSeconds; // toggle immediately after warmup
            } else {
                return;
            }
        }

        if (s.elapsedSeconds < s.nextToggleAt) return;

        // Toggle state
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
        fields.put("dev_phase", phase); // start|toggle|stop
        fields.put("dev_state", cheatState); // on|off
        fields.putAll(extra);
        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "dev",
                "DEV_MARKER",
                player.getUniqueId().toString(),
                player.getName(),
                fields
        ));
    }

    private static void send(@NotNull Player player, @NotNull String msg) {
        player.sendMessage(msg);
    }

    static final class Session {
        final UUID playerId;
        final String devSessionId;
        final String label;
        final int durationSeconds;
        final int warmupSeconds;
        final int toggleSeconds;

        int taskId = -1;
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


