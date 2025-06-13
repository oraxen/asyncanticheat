package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;

import java.util.List;

final class PacketFilters {
    private PacketFilters() {}

    static boolean shouldCapture(@NotNull AsyncAnticheatConfig config, @NotNull String packetName) {
        final String normalized = packetName.trim();
        final List<String> disabled = config.getDisabledPackets();
        for (String d : disabled) {
            if (d != null && !d.isBlank() && normalized.equalsIgnoreCase(d.trim())) {
                return false;
            }
        }
        final List<String> enabled = config.getEnabledPackets();
        if (enabled.isEmpty()) {
            return DefaultPacketAllowList.matches(normalized);
        }
        for (String e : enabled) {
            if (e != null && !e.isBlank() && normalized.equalsIgnoreCase(e.trim())) {
                return true;
            }
        }
        return false;
    }
}



