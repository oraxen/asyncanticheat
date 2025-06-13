package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.atomic.AtomicInteger;

final class HttpUploader {

    private final AsyncAnticheatConfig config;
    private final AcLogger logger;
    private final String serverId;
    private final String sessionId;
    private final HttpClient client;

    static final int REG_UNKNOWN = 0;
    static final int REG_WAITING = 1;
    static final int REG_REGISTERED = 2;

    private final AtomicInteger registrationState = new AtomicInteger(REG_UNKNOWN);

    // Backoff / degraded-mode state (single-threaded: used only by AsyncAnticheatService's executor)
    private long nextAttemptAtMs = 0L;
    private long backoffMs = 1_000L;
    private final long maxBackoffMs = 60_000L;
    private int consecutiveFailures = 0;
    private long degradedUntilMs = 0L;
    private long lastMissingTokenWarnAtMs = 0L;
    private final long missingTokenWarnIntervalMs = 5 * 60_000L; // 5 minutes
    private long lastRegistrationWarnAtMs = 0L;
    private final long registrationWarnIntervalMs = 5 * 60_000L; // 5 minutes

    HttpUploader(@NotNull AsyncAnticheatConfig config, @NotNull AcLogger logger, @NotNull String serverId, @NotNull String sessionId) {
        this.config = config;
        this.logger = logger;
        this.serverId = serverId;
        this.sessionId = sessionId;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(config.getTimeoutSeconds()))
                .build();
    }

    int getRegistrationState() {
        return registrationState.get();
    }

    @NotNull
    String getClaimUrl() {
        final String base = normalizeBaseUrl(config.getDashboardUrl());
        final String token = config.getApiToken();
        final String encoded = URLEncoder.encode(token == null ? "" : token, StandardCharsets.UTF_8);
        return base + "/register-server?token=" + encoded;
    }

    void handshake() {
        final String token = config.getApiToken();
        if (token == null || token.isBlank()) {
            return;
        }

        final String url = normalizeBaseUrl(config.getApiUrl()) + "/handshake";
        final HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(config.getTimeoutSeconds()))
                .header("Authorization", "Bearer " + token)
                .header("X-Server-Id", serverId)
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        try {
            final HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            handleRegistrationStatus(resp.statusCode(), resp.body());
        } catch (Exception e) {
            // Ignore; uploader will retry later via normal uploads.
        }
    }

    void uploadSpoolDir(@NotNull File spoolDir) {
        final long now = System.currentTimeMillis();
        if (now < degradedUntilMs || now < nextAttemptAtMs) {
            return;
        }
        final File[] files = spoolDir.listFiles((dir, name) -> name.endsWith(".ndjson.gz"));
        if (files == null || files.length == 0) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        // Upload up to a small number per tick to avoid long stalls.
        int limit = Math.min(files.length, 10);
        for (int i = 0; i < limit; i++) {
            uploadFile(files[i]);
            // If we entered backoff/degraded mode after a failure, stop for now.
            final long now2 = System.currentTimeMillis();
            if (now2 < degradedUntilMs || now2 < nextAttemptAtMs) {
                return;
            }
        }
    }

    void uploadFile(@NotNull File file) {
        final String token = config.getApiToken();
        if (token == null || token.isBlank()) {
            // No auth configured: just keep spooling.
            final long now = System.currentTimeMillis();
            if (now - lastMissingTokenWarnAtMs >= missingTokenWarnIntervalMs) {
                lastMissingTokenWarnAtMs = now;
                logger.warn("[AsyncAnticheat] api.token is not set; spooling packets to disk but not uploading. Set api.token in config.yml to enable uploads.");
            }
            return;
        }

        final long now = System.currentTimeMillis();
        if (now < degradedUntilMs || now < nextAttemptAtMs) {
            return;
        }

        final byte[] body;
        try {
            body = Files.readAllBytes(file.toPath());
        } catch (Exception e) {
            logger.warn("[AsyncAnticheat] Failed reading spool file: " + file.getName() + " (" + e.getMessage() + ")");
            return;
        }

        final String url = normalizeBaseUrl(config.getApiUrl()) + "/ingest";
        final HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(config.getTimeoutSeconds()))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/x-ndjson")
                .header("Content-Encoding", "gzip")
                .header("X-Server-Id", serverId)
                .header("X-Session-Id", sessionId)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        try {
            final HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                Files.deleteIfExists(file.toPath());
                registrationState.set(REG_REGISTERED);
                onSuccess();
            } else if (handleRegistrationStatus(resp.statusCode(), resp.body())) {
                // Server is not registered yet: keep the file, but don't spam retries.
                // This is not a "network failure" and shouldn't trigger exponential backoff.
                nextAttemptAtMs = System.currentTimeMillis() + 60_000L; // check again in 60s
            } else {
                onFailure("Upload failed (" + resp.statusCode() + ") for " + file.getName());
            }
        } catch (Exception e) {
            // Network down / timeout etc. Keep file for retry.
            onFailure("Upload exception for " + file.getName() + ": " + e.getMessage());
        }
    }

    @NotNull
    private static String normalizeBaseUrl(@NotNull String baseUrl) {
        String b = baseUrl.trim();
        while (b.endsWith("/")) b = b.substring(0, b.length() - 1);
        return b;
    }

    /**
     * @return true if the response indicates "waiting_for_registration" and we handled it.
     */
    private boolean handleRegistrationStatus(int statusCode, String body) {
        // The API returns 409 with a JSON body containing waiting_for_registration.
        if (statusCode != 409) return false;
        final String b = body == null ? "" : body;
        if (!b.contains("waiting_for_registration")) return false;

        registrationState.set(REG_WAITING);

        final long now = System.currentTimeMillis();
        if (now - lastRegistrationWarnAtMs >= registrationWarnIntervalMs) {
            lastRegistrationWarnAtMs = now;
            logger.warn("[AsyncAnticheat] Server is waiting for dashboard registration. Link it here: " + getClaimUrl());
        }
        return true;
    }

    private void onSuccess() {
        consecutiveFailures = 0;
        backoffMs = 1_000L;
        nextAttemptAtMs = 0L;
        degradedUntilMs = 0L;
    }

    private void onFailure(@NotNull String reason) {
        consecutiveFailures++;
        // Exponential backoff.
        final long appliedBackoffMs = backoffMs;
        nextAttemptAtMs = System.currentTimeMillis() + appliedBackoffMs;
        backoffMs = Math.min(maxBackoffMs, appliedBackoffMs * 2L);

        // Degraded mode: stop uploading for a while after repeated failures.
        if (consecutiveFailures >= 5) {
            degradedUntilMs = System.currentTimeMillis() + 5 * 60_000L; // 5 minutes
            logger.warn("[AsyncAnticheat] Entering spool-only mode for 5m after repeated upload failures. Last: " + reason);
        } else if (consecutiveFailures == 1 || consecutiveFailures == 3) {
            // Avoid log spam; log early signals.
            logger.warn("[AsyncAnticheat] " + reason + " (backoff=" + appliedBackoffMs + "ms, failures=" + consecutiveFailures + ")");
        }
    }
}


