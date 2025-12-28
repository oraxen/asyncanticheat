package md.thomas.asyncanticheat.bukkit;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import md.thomas.asyncanticheat.core.AsyncAnticheatConfig;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Manages in-game cheat recordings that are submitted to the API.
 * Simplified replacement for the old dev mode system.
 */
final class RecordingManager {

    private final Plugin plugin;
    private final AsyncAnticheatConfig config;
    private final String serverId;

    private final Map<UUID, Recording> activeRecordings = new ConcurrentHashMap<>();
    private final HttpClient httpClient;
    private final Gson gson = new GsonBuilder().disableHtmlEscaping().create();
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "AsyncAnticheat-Recording");
        t.setDaemon(true);
        return t;
    });

    RecordingManager(@NotNull Plugin plugin, @NotNull AsyncAnticheatConfig config, @NotNull String serverId) {
        this.plugin = plugin;
        this.config = config;
        this.serverId = serverId;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(config.getTimeoutSeconds()))
                .build();
    }

    /**
     * Start recording a player for a specific cheat type.
     *
     * @param target   The player being recorded
     * @param recorder The staff member making the recording
     * @param cheatType The type of cheat (killaura, speed, fly, etc.)
     * @param label    Optional custom label/description
     * @return true if recording started, false if already recording this player
     */
    boolean startRecording(
            @NotNull Player target,
            @NotNull Player recorder,
            @NotNull String cheatType,
            @Nullable String label
    ) {
        final UUID targetId = target.getUniqueId();
        if (activeRecordings.containsKey(targetId)) {
            return false; // Already recording
        }

        final Recording recording = new Recording(
                target.getUniqueId(),
                target.getName(),
                recorder.getUniqueId(),
                recorder.getName(),
                cheatType,
                label,
                Instant.now()
        );
        activeRecordings.put(targetId, recording);

        sendStartNotice(recorder, target, cheatType, label);
        return true;
    }

    /**
     * Stop recording a player and submit to the API.
     *
     * @param target   The player being recorded
     * @param recorder The staff member (for messaging)
     * @return true if recording was stopped, false if not recording
     */
    boolean stopRecording(@NotNull Player target, @Nullable Player recorder) {
        final UUID targetId = target.getUniqueId();
        final Recording recording = activeRecordings.remove(targetId);
        if (recording == null) {
            return false; // Not recording
        }

        final Instant endedAt = Instant.now();
        submitRecording(recording, endedAt);

        if (recorder != null) {
            sendStopNotice(recorder, target, recording.cheatType);
        }
        return true;
    }

    /**
     * Stop recording by target UUID (used when player disconnects).
     */
    void stopRecordingByUuid(@NotNull UUID targetId) {
        final Recording recording = activeRecordings.remove(targetId);
        if (recording == null) return;

        submitRecording(recording, Instant.now());
        plugin.getLogger().info("[Recording] Auto-stopped recording for " + recording.playerName + " (disconnected)");
    }

    /**
     * Get the active recording for a player.
     */
    @Nullable
    Recording getRecording(@NotNull UUID playerId) {
        return activeRecordings.get(playerId);
    }

    /**
     * Get all active recordings.
     */
    @NotNull
    Map<UUID, Recording> getActiveRecordings() {
        return Map.copyOf(activeRecordings);
    }

    /**
     * Stop all active recordings (on plugin disable).
     */
    void stopAll() {
        for (UUID targetId : activeRecordings.keySet().toArray(new UUID[0])) {
            final Recording recording = activeRecordings.remove(targetId);
            if (recording != null) {
                submitRecording(recording, Instant.now());
            }
        }
        executor.shutdown();
    }

    /**
     * Called when a player quits - auto-stop their recording if active.
     */
    void handlePlayerQuit(@NotNull UUID playerId) {
        if (activeRecordings.containsKey(playerId)) {
            stopRecordingByUuid(playerId);
        }
    }

    private void submitRecording(@NotNull Recording recording, @NotNull Instant endedAt) {
        executor.execute(() -> {
            try {
                final String token = config.getApiToken();
                if (token == null || token.isBlank()) {
                    plugin.getLogger().warning("[Recording] Cannot submit: api.token not configured");
                    return;
                }

                final String url = normalizeBaseUrl(config.getApiUrl()) + "/observations";
                final Map<String, Object> body = Map.of(
                        "observation_type", "recording",
                        "player_uuid", recording.playerUuid.toString(),
                        "player_name", recording.playerName,
                        "cheat_type", recording.cheatType,
                        "label", recording.label != null ? recording.label : "",
                        "started_at", DateTimeFormatter.ISO_INSTANT.format(recording.startedAt),
                        "ended_at", DateTimeFormatter.ISO_INSTANT.format(endedAt),
                        "recorded_by_uuid", recording.recorderUuid.toString(),
                        "recorded_by_name", recording.recorderName,
                        "session_id", "" // Could add session tracking if needed
                );

                final HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(config.getTimeoutSeconds()))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .header("X-Server-Id", serverId)
                        .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body)))
                        .build();

                final HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                    plugin.getLogger().info("[Recording] Submitted recording for " + recording.playerName +
                            " (" + recording.cheatType + ")");
                } else {
                    plugin.getLogger().warning("[Recording] Failed to submit: " + resp.statusCode() +
                            " - " + resp.body());
                }
            } catch (Exception e) {
                plugin.getLogger().warning("[Recording] Failed to submit recording: " + e.getMessage());
            }
        });
    }

    @NotNull
    private static String normalizeBaseUrl(@NotNull String baseUrl) {
        String b = baseUrl.trim();
        while (b.endsWith("/")) b = b.substring(0, b.length() - 1);
        return b;
    }

    private static void sendStartNotice(@NotNull Player recorder, @NotNull Player target,
                                         @NotNull String cheatType, @Nullable String label) {
        final String labelText = label != null && !label.isBlank() ? " (" + label + ")" : "";
        recorder.sendMessage("§a[AsyncAnticheat] §fStarted recording §e" + target.getName() +
                " §ffor §c" + cheatType + labelText);
        try {
            recorder.sendTitle(
                    "§aRecording Started",
                    "§f" + target.getName() + " §7- §c" + cheatType,
                    10, 40, 10
            );
        } catch (Throwable ignored) {
        }
    }

    private static void sendStopNotice(@NotNull Player recorder, @NotNull Player target, @NotNull String cheatType) {
        recorder.sendMessage("§a[AsyncAnticheat] §fStopped recording §e" + target.getName() +
                " §ffor §c" + cheatType + " §7(submitted to dashboard)");
        try {
            recorder.sendTitle(
                    "§cRecording Stopped",
                    "§f" + target.getName() + " §7- submitted",
                    10, 40, 10
            );
        } catch (Throwable ignored) {
        }
    }

    /**
     * Represents an active recording session.
     */
    static final class Recording {
        final UUID playerUuid;
        final String playerName;
        final UUID recorderUuid;
        final String recorderName;
        final String cheatType;
        final String label;
        final Instant startedAt;

        Recording(UUID playerUuid, String playerName, UUID recorderUuid, String recorderName,
                  String cheatType, String label, Instant startedAt) {
            this.playerUuid = playerUuid;
            this.playerName = playerName;
            this.recorderUuid = recorderUuid;
            this.recorderName = recorderName;
            this.cheatType = cheatType;
            this.label = label;
            this.startedAt = startedAt;
        }
    }
}

