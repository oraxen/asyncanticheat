package md.thomas.asyncanticheat.core;

import com.google.gson.Gson;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.util.HashMap;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.GZIPOutputStream;

final class DiskSpool {

    private final File spoolDir;
    private final AsyncAnticheatConfig config;
    private final AcLogger logger;
    private final Gson gson;

    DiskSpool(@NotNull File spoolDir, @NotNull AsyncAnticheatConfig config, @NotNull AcLogger logger, @NotNull Gson gson) {
        this.spoolDir = spoolDir;
        this.config = config;
        this.logger = logger;
        this.gson = gson;
        if (!spoolDir.exists() && !spoolDir.mkdirs()) {
            logger.warn("[AsyncAnticheat] Failed to create spool dir: " + spoolDir.getAbsolutePath());
        }
    }

    @NotNull
    File getSpoolDir() {
        return spoolDir;
    }

    @Nullable
    File writeBatch(@NotNull List<PacketRecord> records, @NotNull String serverId, @NotNull String sessionId) {
        enforceMaxSize();

        final String name = "batch-" + Instant.now().toEpochMilli() + "-" + UUID.randomUUID() + ".ndjson.gz";
        final File out = new File(spoolDir, name);

        // NOTE: Map.of rejects null values; PacketRecord fields may be null (e.g., Bungee can enqueue nulls).
        final Map<String, Object> meta = new HashMap<>();
        meta.put("server_id", serverId);
        meta.put("session_id", sessionId);
        meta.put("created_at_ms", System.currentTimeMillis());
        meta.put("event_count", records.size());

        try (FileOutputStream fos = new FileOutputStream(out);
             GZIPOutputStream gzip = new GZIPOutputStream(fos);
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(gzip, StandardCharsets.UTF_8))) {

            // First line is metadata.
            writer.write(gson.toJson(meta));
            writer.write("\n");

            for (PacketRecord r : records) {
                final Map<String, Object> line = new HashMap<>();
                line.put("ts", r.getTimestampMs());
                line.put("dir", r.getDirection());
                line.put("pkt", r.getPacketName());
                // These can be null (and that's OK) - Gson will emit nulls.
                line.put("uuid", r.getPlayerUuid());
                line.put("name", r.getPlayerName());
                line.put("fields", r.getFields());
                writer.write(gson.toJson(line));
                writer.write("\n");
            }
            writer.flush();
            return out;
        } catch (Exception e) {
            logger.error("[AsyncAnticheat] Failed to write spool batch: " + out.getAbsolutePath(), e);
            try {
                Files.deleteIfExists(out.toPath());
            } catch (Exception ignored) {}
            return null;
        }
    }

    private void enforceMaxSize() {
        final long maxBytes = (long) config.getSpoolMaxMb() * 1024L * 1024L;
        if (maxBytes <= 0) return;

        final File[] files = spoolDir.listFiles((dir, name) -> name.endsWith(".ndjson.gz"));
        if (files == null || files.length == 0) return;

        long total = 0L;
        for (File f : files) total += f.length();
        if (total <= maxBytes) return;

        // Delete oldest until within limit.
        try {
            final List<File> sorted = List.of(files).stream()
                    .sorted(Comparator.comparingLong(File::lastModified))
                    .toList();
            for (File f : sorted) {
                if (total <= maxBytes) break;
                long len = f.length();
                if (Files.deleteIfExists(f.toPath())) {
                    total -= len;
                    logger.warn("[AsyncAnticheat] Spool over limit, deleted: " + f.getName());
                }
            }
        } catch (Exception e) {
            logger.warn("[AsyncAnticheat] Failed enforcing spool max size: " + e.getMessage());
        }
    }
}


