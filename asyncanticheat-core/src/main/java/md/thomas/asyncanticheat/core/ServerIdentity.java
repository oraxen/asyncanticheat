package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;

public final class ServerIdentity {

    private static final String FILE_NAME = "server-id.txt";

    private final String serverId;

    private ServerIdentity(@NotNull String serverId) {
        this.serverId = serverId;
    }

    @NotNull
    public static ServerIdentity loadOrCreate(@NotNull File dataFolder, @NotNull AcLogger logger) {
        final File f = new File(dataFolder, FILE_NAME);
        if (f.exists()) {
            try {
                final String id = Files.readString(f.toPath(), StandardCharsets.UTF_8).trim();
                if (!id.isBlank()) {
                    return new ServerIdentity(id);
                }
            } catch (Exception e) {
                logger.warn("[AsyncAnticheat] Failed reading server id file, regenerating: " + e.getMessage());
            }
        }
        final String newId = UUID.randomUUID().toString();
        try {
            Files.writeString(f.toPath(), newId + "\n", StandardCharsets.UTF_8);
        } catch (Exception e) {
            logger.warn("[AsyncAnticheat] Failed writing server id file: " + e.getMessage());
        }
        return new ServerIdentity(newId);
    }

    @NotNull
    public String getServerId() {
        return serverId;
    }
}


