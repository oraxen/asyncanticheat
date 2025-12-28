package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Map;

public final class PacketRecord {
    private final long timestampMs;
    private final @NotNull String direction; // serverbound | clientbound
    private final @NotNull String packetName;
    private final @Nullable String playerUuid;
    private final @Nullable String playerName;
    private final @NotNull Map<String, Object> fields;

    public PacketRecord(
            long timestampMs,
            @NotNull String direction,
            @NotNull String packetName,
            @Nullable String playerUuid,
            @Nullable String playerName,
            @NotNull Map<String, Object> fields
    ) {
        this.timestampMs = timestampMs;
        this.direction = direction;
        this.packetName = packetName;
        this.playerUuid = playerUuid;
        this.playerName = playerName;
        this.fields = fields;
    }

    public long getTimestampMs() { return timestampMs; }
    @NotNull public String getDirection() { return direction; }
    @NotNull public String getPacketName() { return packetName; }
    @Nullable public String getPlayerUuid() { return playerUuid; }
    @Nullable public String getPlayerName() { return playerName; }
    @NotNull public Map<String, Object> getFields() { return fields; }
}


