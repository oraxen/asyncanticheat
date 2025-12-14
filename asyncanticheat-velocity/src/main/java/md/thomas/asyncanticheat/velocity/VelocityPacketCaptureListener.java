package md.thomas.asyncanticheat.velocity;

import com.github.retrooper.packetevents.event.PacketListener;
import com.github.retrooper.packetevents.event.PacketReceiveEvent;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.util.Vector3i;
import com.github.retrooper.packetevents.wrapper.play.client.WrapperPlayClientPlayerDigging;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import md.thomas.asyncanticheat.core.PacketRecord;
import org.jetbrains.annotations.NotNull;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

final class VelocityPacketCaptureListener implements PacketListener {

    private final ProxyServer server;
    private final AsyncAnticheatService service;
    private final VelocityPlayerExemptionTracker exemptionTracker;

    VelocityPacketCaptureListener(@NotNull ProxyServer server,
                                  @NotNull AsyncAnticheatService service,
                                  @NotNull VelocityPlayerExemptionTracker exemptionTracker) {
        this.server = server;
        this.service = service;
        this.exemptionTracker = exemptionTracker;
    }

    @Override
    public void onPacketReceive(PacketReceiveEvent event) {
        final User user = event.getUser();
        final Player player = user == null ? null : server.getPlayer(user.getUUID()).orElse(null);

        // If we can't resolve a player, drop the packet. Enqueuing null UUID/name creates unusable anonymous traffic.
        if (user == null || player == null) {
            return;
        }
        
        // Check exemptions (Bedrock, join grace, server switch grace)
        if (exemptionTracker.isExempt(player)) {
            return;
        }
        
        final String packetName = String.valueOf(event.getPacketType());
        final Map<String, Object> fields = extractFields(event);
        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "serverbound",
                packetName,
                player.getUniqueId().toString(),
                player.getUsername(),
                fields
        ));
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        final User user = event.getUser();
        final Player player = user == null ? null : server.getPlayer(user.getUUID()).orElse(null);

        if (user == null || player == null) {
            return;
        }
        
        // Check exemptions (same as serverbound)
        if (exemptionTracker.isExempt(player)) {
            return;
        }
        
        final String packetName = String.valueOf(event.getPacketType());
        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "clientbound",
                packetName,
                player.getUniqueId().toString(),
                player.getUsername(),
                Collections.emptyMap()
        ));
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


