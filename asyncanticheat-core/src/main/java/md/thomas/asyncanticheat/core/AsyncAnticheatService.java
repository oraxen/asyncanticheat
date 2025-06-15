package md.thomas.asyncanticheat.core;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Platform-agnostic core service: buffer packet records, spool to disk, and upload batches asynchronously.
 *
 * Platform adapters feed packet events via {@link #tryEnqueue(PacketRecord)}.
 */
public final class AsyncAnticheatService {

    private static final int DEFAULT_QUEUE_CAPACITY = 10_000;
    // Keep a lightweight heartbeat so the dashboard can show the plugin as "online"
    // even when there are no players/packets to upload.
    private static final long HEARTBEAT_INTERVAL_MS = 15_000L;

    private final AcLogger logger;
    private final AsyncAnticheatConfig config;
    private final ServerIdentity serverIdentity;
    private final String sessionId = UUID.randomUUID().toString();

    private final ArrayBlockingQueue<PacketRecord> queue = new ArrayBlockingQueue<>(DEFAULT_QUEUE_CAPACITY);
    private final ScheduledExecutorService executor = new ScheduledThreadPoolExecutor(1, r -> {
        Thread t = new Thread(r, "AsyncAnticheat-Uploader");
        t.setDaemon(true);
        return t;
    });
    // Ensure flush/upload is single-flight: stop() and scheduled task must never overlap.
    private final AtomicBoolean flushRunning = new AtomicBoolean(false);
    private long lastHeartbeatAtMs = 0L;

    private final Gson gson = new GsonBuilder().disableHtmlEscaping().create();
    private final DiskSpool spool;
    private final HttpUploader uploader;

    public AsyncAnticheatService(@NotNull File dataFolder, @NotNull AcLogger logger) {
        this.logger = logger;
        this.config = AsyncAnticheatConfig.load(dataFolder, logger);
        this.serverIdentity = ServerIdentity.loadOrCreate(dataFolder, logger);
        this.spool = new DiskSpool(new File(dataFolder, config.getSpoolDirName()), config, logger, gson);
        this.uploader = new HttpUploader(config, logger, serverIdentity.getServerId(), sessionId);
    }

    public void start() {
        executor.scheduleWithFixedDelay(this::flushAndUploadSafe, config.getFlushIntervalMs(), config.getFlushIntervalMs(), TimeUnit.MILLISECONDS);
        logger.info("[AsyncAnticheat] Started. server_id=" + serverIdentity.getServerId() + " session_id=" + sessionId);

        // Fire a startup handshake so the API can respond "waiting_for_registration" immediately.
        // Runs on the uploader executor to avoid blocking the server thread.
        try {
            executor.execute(uploader::handshake);
        } catch (Exception ignored) {}

        // Always print the claim URL on startup for first-time installs.
        // This is the primary "copy/paste" flow for linking a server to the dashboard.
        logger.warn("[AsyncAnticheat] Dashboard link: " + getClaimUrl());
    }

    public void stop() {
        // Avoid blocking the server/main thread on HTTP I/O during plugin disable.
        // Best effort: kick a final flush/upload on a daemon thread.
        try {
            final Thread t = new Thread(this::flushAndUploadSafe, "AsyncAnticheat-Uploader-Stop");
            t.setDaemon(true);
            t.start();
        } catch (Exception ignored) {}
        try {
            executor.shutdownNow();
        } catch (Exception ignored) {}
        logger.info("[AsyncAnticheat] Stopped.");
    }

    public boolean tryEnqueue(@NotNull PacketRecord record) {
        // Dev mode markers must never be dropped due to sampling/filtering, otherwise labels become useless.
        if (isDevMarker(record)) {
            return offerWithDropPolicy(record);
        }
        if (Math.random() > config.getSampleRate()) {
            return true;
        }
        if (!PacketFilters.shouldCapture(config, record.getPacketName())) {
            return true;
        }
        return offerWithDropPolicy(record);
    }

    private boolean isDevMarker(@NotNull PacketRecord record) {
        final String pkt = record.getPacketName();
        return pkt != null && pkt.startsWith("DEV_");
    }

    private boolean offerWithDropPolicy(@NotNull PacketRecord record) {
        if (queue.offer(record)) {
            return true;
        }
        // Queue full: apply drop policy.
        if ("drop_oldest".equalsIgnoreCase(config.getDropPolicy())) {
            queue.poll();
            return queue.offer(record);
        }
        return false; // drop_newest
    }

    private void flushAndUploadSafe() {
        // Prevent overlapping flushes (scheduled vs stop-triggered).
        if (!flushRunning.compareAndSet(false, true)) {
            return;
        }
        try {
            flushAndUpload();
        } catch (Throwable t) {
            logger.error("[AsyncAnticheat] Background flush/upload failed", t);
        } finally {
            flushRunning.set(false);
        }
    }

    private void flushAndUpload() {
        // First: upload already spooled files (oldest first).
        uploader.uploadSpoolDir(spool.getSpoolDir());

        // Heartbeat: keep last_seen_at fresh even when idle.
        // Runs on the uploader executor (already a daemon thread).
        maybeHeartbeat();

        // Then: drain queue and spool + attempt upload (best effort).
        final List<PacketRecord> drained = new ArrayList<>(Math.min(queue.size(), 2048));
        queue.drainTo(drained, 2048);
        if (drained.isEmpty()) {
            return;
        }

        final File batchFile = spool.writeBatch(drained, serverIdentity.getServerId(), sessionId);
        if (batchFile != null) {
            uploader.uploadFile(batchFile);
        }
    }

    private void maybeHeartbeat() {
        final long now = System.currentTimeMillis();
        if (now - lastHeartbeatAtMs < HEARTBEAT_INTERVAL_MS) {
            return;
        }
        lastHeartbeatAtMs = now;
        try {
            uploader.handshake();
        } catch (Exception ignored) {
        }
    }

    @NotNull
    public AsyncAnticheatConfig getConfig() {
        return config;
    }

    /**
     * URL that links this server to the dashboard account.
     * Contains the server's secret token in the query string; treat it like a password.
     */
    @NotNull
    public String getClaimUrl() {
        return uploader.getClaimUrl();
    }

    public boolean isDashboardRegistered() {
        return uploader.getRegistrationState() == HttpUploader.REG_REGISTERED;
    }

    public boolean isWaitingForDashboardRegistration() {
        return uploader.getRegistrationState() == HttpUploader.REG_WAITING;
    }
}


