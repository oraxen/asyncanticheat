package md.thomas.asyncanticheat.bungee;

import com.github.retrooper.packetevents.event.PacketListener;
import com.github.retrooper.packetevents.event.PacketReceiveEvent;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.util.Vector3i;
import com.github.retrooper.packetevents.wrapper.play.client.WrapperPlayClientPlayerDigging;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import md.thomas.asyncanticheat.core.PacketRecord;
import net.md_5.bungee.api.ProxyServer;
import net.md_5.bungee.api.connection.ProxiedPlayer;
import org.jetbrains.annotations.NotNull;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

final class BungeePacketCaptureListener implements PacketListener {

    private final ProxyServer proxy;
    private final AsyncAnticheatService service;
    private final BungeePlayerExemptionTracker exemptionTracker;

    BungeePacketCaptureListener(@NotNull ProxyServer proxy,
            @NotNull AsyncAnticheatService service,
            @NotNull BungeePlayerExemptionTracker exemptionTracker) {
        this.proxy = proxy;
        this.service = service;
        this.exemptionTracker = exemptionTracker;
    }

    @Override
    public void onPacketReceive(PacketReceiveEvent event) {
        final User user = event.getUser();
        final ProxiedPlayer player = user == null ? null : proxy.getPlayer(user.getUUID());

        // Check exemptions (Bedrock, join grace, server switch grace)
        if (exemptionTracker.isExempt(player)) {
            return;
        }

        final Map<String, Object> fields = extractFields(event);
        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "serverbound",
                String.valueOf(event.getPacketType()),
                player == null ? null : player.getUniqueId().toString(),
                player == null ? null : player.getName(),
                fields));
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        final User user = event.getUser();
        final ProxiedPlayer player = user == null ? null : proxy.getPlayer(user.getUUID());

        // Check exemptions (same as serverbound)
        if (exemptionTracker.isExempt(player)) {
            return;
        }

        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "clientbound",
                String.valueOf(event.getPacketType()),
                player == null ? null : player.getUniqueId().toString(),
                player == null ? null : player.getName(),
                Collections.emptyMap()));
    }

    @NotNull
    private static Map<String, Object> extractFields(@NotNull PacketReceiveEvent event) {
        if (event.getPacketType() == PacketType.Play.Client.PLAYER_DIGGING) {
            final WrapperPlayClientPlayerDigging wrapper = new WrapperPlayClientPlayerDigging(event);
            final Vector3i pos = wrapper.getBlockPosition();
            final Map<String, Object> m = new HashMap<>();
            m.put("action", wrapper.getAction() == null ? null : wrapper.getAction().name());
            if (pos != null) {
                m.put("x", pos.getX());
                m.put("y", pos.getY());
                m.put("z", pos.getZ());
            }
            m.put("face", wrapper.getBlockFace() == null ? null : wrapper.getBlockFace().name());
            return m;
        }
        return Collections.emptyMap();
    }
}
