package md.thomas.asyncanticheat.bukkit;

import com.github.retrooper.packetevents.event.PacketListener;
import com.github.retrooper.packetevents.event.PacketReceiveEvent;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.util.Vector3d;
import com.github.retrooper.packetevents.util.Vector3f;
import com.github.retrooper.packetevents.util.Vector3i;
import com.github.retrooper.packetevents.wrapper.play.client.*;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerDestroyEntities;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityRelativeMove;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityRelativeMoveAndRotation;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityTeleport;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSpawnLivingEntity;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSpawnPlayer;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import md.thomas.asyncanticheat.core.PacketRecord;
import org.bukkit.GameMode;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Captures packets and extracts fields relevant for anticheat analysis.
 * 
 * Based on NoCheatPlus analysis, the critical fields for various checks are:
 * 
 * **Movement checks (SurvivalFly, Speed, NoFall)**:
 * - x, y, z coordinates
 * - yaw, pitch (head rotation)
 * - onGround flag
 * - sprint/sneak status
 * 
 * **Combat checks (Angle, Reach, Speed, Killaura)**:
 * - Target entity ID
 * - Attack action type
 * - Player position + rotation at attack time
 * - Attack timing (rapid hits detection)
 * 
 * **Block interaction checks**:
 * - Block position
 * - Block face
 * - Dig/place action type
 * 
 * **Exemption handling**:
 * Players in certain states are excluded from packet capture based on
 * NoCheatPlus patterns (creative mode, spectator, flying, dead, sleeping, etc.)
 */
final class BukkitPacketCaptureListener implements PacketListener {

    private final AsyncAnticheatService service;
    private final BukkitPlayerExemptionTracker exemptionTracker;

    BukkitPacketCaptureListener(@NotNull AsyncAnticheatService service,
                                @NotNull BukkitPlayerExemptionTracker exemptionTracker) {
        this.service = service;
        this.exemptionTracker = exemptionTracker;
    }

    @Override
    public void onPacketReceive(PacketReceiveEvent event) {
        final Player player = event.getPlayer();
        
        // Check exemptions before processing (based on NCP patterns)
        // This avoids capturing packets from players who shouldn't be checked
        if (exemptionTracker.isExempt(player)) {
            return;
        }
        
        final String packetName = String.valueOf(event.getPacketType());
        final Map<String, Object> fields = extractServerBoundFields(event, player);
        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "serverbound",
                packetName,
                player == null ? null : player.getUniqueId().toString(),
                player == null ? null : player.getName(),
                fields
        ));
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        // Clientbound packets are less critical for cheating detection,
        // but can be useful for context (e.g., teleports, entity positions).
        // For now, we capture minimal data to reduce bandwidth.
        final Player player = event.getPlayer();
        
        // Check exemptions (same as serverbound)
        // Note: We might want different rules for clientbound in the future
        if (exemptionTracker.isExempt(player)) {
            return;
        }
        
        final String packetName = String.valueOf(event.getPacketType());
        final Map<String, Object> fields = extractClientBoundFields(event);
        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "clientbound",
                packetName,
                player == null ? null : player.getUniqueId().toString(),
                player == null ? null : player.getName(),
                fields
        ));
    }

    /**
     * Extract fields from serverbound (client→server) packets.
     * These are the packets that reveal player intent and potential cheating.
     */
    @NotNull
    private static Map<String, Object> extractServerBoundFields(@NotNull PacketReceiveEvent event, Player player) {
        final Object packetType = event.getPacketType();
        final String packetTypeStr = String.valueOf(packetType);

        // === POSITION PACKETS ===
        // These are critical for movement checks (fly, speed, teleport)
        
        if (packetType == PacketType.Play.Client.PLAYER_POSITION) {
            return extractPlayerPosition(event);
        }
        
        if (packetType == PacketType.Play.Client.PLAYER_POSITION_AND_ROTATION) {
            return extractPlayerPositionAndRotation(event);
        }
        
        if (packetType == PacketType.Play.Client.PLAYER_ROTATION) {
            return extractPlayerRotation(event);
        }
        
        if (packetType == PacketType.Play.Client.PLAYER_FLYING) {
            return extractPlayerFlying(event);
        }

        // === ABILITIES ===
        // On 1.16+ the packet itself only contains the "flying" bit, so we also annotate
        // server-side allow-flight state for deterministic downstream checks.
        if ("PLAYER_ABILITIES".equals(packetTypeStr)) {
            return extractPlayerAbilities(event, player);
        }

        // === COMBAT PACKETS ===
        // Critical for killaura, reach, angle, and attack speed checks
        
        if (packetType == PacketType.Play.Client.INTERACT_ENTITY) {
            return extractInteractEntity(event);
        }
        
        if (packetType == PacketType.Play.Client.ANIMATION) {
            return extractAnimation(event);
        }

        // === BLOCK INTERACTION PACKETS ===
        // For reach, nuker, and block interaction checks
        
        if (packetType == PacketType.Play.Client.PLAYER_DIGGING) {
            return extractPlayerDigging(event);
        }
        
        if (packetType == PacketType.Play.Client.PLAYER_BLOCK_PLACEMENT) {
            return extractBlockPlacement(event);
        }
        
        if (packetType == PacketType.Play.Client.USE_ITEM) {
            return extractUseItem(event);
        }

        // Modern versions (1.9+): block interactions use USE_ITEM_ON / INTERACT_BLOCK style packets.
        // PacketEvents may surface these as distinct packet types on newer protocol versions.
        if ("USE_ITEM_ON".equals(String.valueOf(packetType)) || "INTERACT_BLOCK".equals(String.valueOf(packetType))) {
            return extractUseItemOnLike(event);
        }

        // === ENTITY ACTION PACKETS ===
        // Sprint, sneak, jump with horse, etc.
        
        if (packetType == PacketType.Play.Client.ENTITY_ACTION) {
            return extractEntityAction(event);
        }

        // === INVENTORY PACKETS ===
        // For inventory checks
        
        if (packetType == PacketType.Play.Client.CLICK_WINDOW) {
            return extractClickWindow(event);
        }
        
        if (packetType == PacketType.Play.Client.HELD_ITEM_CHANGE) {
            return extractHeldItemChange(event);
        }

        return Collections.emptyMap();
    }

    /**
     * Extract fields from clientbound (server→client) packets.
     *
     * These packets are used to reconstruct entity positions client-side, which enables
     * NCP-style Reach/Direction checks in async modules without touching Bukkit world state.
     */
    @NotNull
    private static Map<String, Object> extractClientBoundFields(@NotNull PacketSendEvent event) {
        final Object packetType = event.getPacketType();

        // Entity absolute teleport
        if (packetType == PacketType.Play.Server.ENTITY_TELEPORT) {
            final WrapperPlayServerEntityTeleport w = new WrapperPlayServerEntityTeleport(event);
            final Vector3d pos = w.getPosition();
            final Map<String, Object> m = new HashMap<>();
            m.put("entity_id", w.getEntityId());
            m.put("x", pos.getX());
            m.put("y", pos.getY());
            m.put("z", pos.getZ());
            m.put("on_ground", w.isOnGround());
            return m;
        }

        // Entity relative move (delta)
        if (packetType == PacketType.Play.Server.ENTITY_RELATIVE_MOVE) {
            final WrapperPlayServerEntityRelativeMove w = new WrapperPlayServerEntityRelativeMove(event);
            final Map<String, Object> m = new HashMap<>();
            m.put("entity_id", w.getEntityId());
            m.put("dx", w.getDeltaX());
            m.put("dy", w.getDeltaY());
            m.put("dz", w.getDeltaZ());
            m.put("on_ground", w.isOnGround());
            return m;
        }

        // Entity relative move + rotation (delta)
        if (packetType == PacketType.Play.Server.ENTITY_RELATIVE_MOVE_AND_ROTATION) {
            final WrapperPlayServerEntityRelativeMoveAndRotation w = new WrapperPlayServerEntityRelativeMoveAndRotation(event);
            final Map<String, Object> m = new HashMap<>();
            m.put("entity_id", w.getEntityId());
            m.put("dx", w.getDeltaX());
            m.put("dy", w.getDeltaY());
            m.put("dz", w.getDeltaZ());
            m.put("yaw", w.getYaw());
            m.put("pitch", w.getPitch());
            m.put("on_ground", w.isOnGround());
            return m;
        }

        // Spawn living entity (absolute position)
        if (packetType == PacketType.Play.Server.SPAWN_LIVING_ENTITY) {
            final WrapperPlayServerSpawnLivingEntity w = new WrapperPlayServerSpawnLivingEntity(event);
            final Vector3d pos = w.getPosition();
            final Map<String, Object> m = new HashMap<>();
            m.put("entity_id", w.getEntityId());
            m.put("entity_uuid", w.getEntityUUID() == null ? null : w.getEntityUUID().toString());
            m.put("entity_type", w.getEntityType() == null ? null : w.getEntityType().getName());
            m.put("x", pos.getX());
            m.put("y", pos.getY());
            m.put("z", pos.getZ());
            return m;
        }

        // Spawn player (absolute position)
        if (packetType == PacketType.Play.Server.SPAWN_PLAYER) {
            final WrapperPlayServerSpawnPlayer w = new WrapperPlayServerSpawnPlayer(event);
            final Vector3d pos = w.getPosition();
            final Map<String, Object> m = new HashMap<>();
            m.put("entity_id", w.getEntityId());
            m.put("entity_uuid", w.getUUID() == null ? null : w.getUUID().toString());
            m.put("entity_type", "PLAYER");
            m.put("x", pos.getX());
            m.put("y", pos.getY());
            m.put("z", pos.getZ());
            return m;
        }

        // Destroy entities
        if (packetType == PacketType.Play.Server.DESTROY_ENTITIES) {
            final WrapperPlayServerDestroyEntities w = new WrapperPlayServerDestroyEntities(event);
            final Map<String, Object> m = new HashMap<>();
            m.put("entity_ids", w.getEntityIds());
            return m;
        }

        return Collections.emptyMap();
    }

    // ========== POSITION EXTRACTION ==========

    @NotNull
    private static Map<String, Object> extractPlayerPosition(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientPlayerPosition wrapper = new WrapperPlayClientPlayerPosition(event);
        final Map<String, Object> m = new HashMap<>();
        final Vector3d pos = wrapper.getPosition();
        m.put("x", pos.getX());
        m.put("y", pos.getY());
        m.put("z", pos.getZ());
        m.put("on_ground", wrapper.isOnGround());
        return m;
    }

    @NotNull
    private static Map<String, Object> extractPlayerPositionAndRotation(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientPlayerPositionAndRotation wrapper = new WrapperPlayClientPlayerPositionAndRotation(event);
        final Map<String, Object> m = new HashMap<>();
        final Vector3d pos = wrapper.getPosition();
        m.put("x", pos.getX());
        m.put("y", pos.getY());
        m.put("z", pos.getZ());
        m.put("yaw", wrapper.getYaw());
        m.put("pitch", wrapper.getPitch());
        m.put("on_ground", wrapper.isOnGround());
        return m;
    }

    @NotNull
    private static Map<String, Object> extractPlayerRotation(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientPlayerRotation wrapper = new WrapperPlayClientPlayerRotation(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("yaw", wrapper.getYaw());
        m.put("pitch", wrapper.getPitch());
        m.put("on_ground", wrapper.isOnGround());
        return m;
    }

    @NotNull
    private static Map<String, Object> extractPlayerFlying(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientPlayerFlying wrapper = new WrapperPlayClientPlayerFlying(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("on_ground", wrapper.isOnGround());
        // Position/rotation may be present depending on sub-type, but we handle those separately
        return m;
    }

    @NotNull
    private static Map<String, Object> extractPlayerAbilities(@NotNull PacketReceiveEvent event, Player player) {
        final WrapperPlayClientPlayerAbilities wrapper = new WrapperPlayClientPlayerAbilities(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("flying", wrapper.isFlying());

        // Packet doesn't reliably include allow-flight / creative flags on modern versions (1.16+),
        // so annotate from Bukkit state for downstream checks.
        if (player != null) {
            m.put("allow_flying", player.getAllowFlight());
            m.put("invulnerable", player.isInvulnerable());
            final GameMode gm = player.getGameMode();
            m.put("instant_break", gm == GameMode.CREATIVE);
        }
        return m;
    }

    // ========== COMBAT EXTRACTION ==========

    @NotNull
    private static Map<String, Object> extractInteractEntity(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientInteractEntity wrapper = new WrapperPlayClientInteractEntity(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("entity_id", wrapper.getEntityId());
        m.put("action", wrapper.getAction().name());
        m.put("sneaking", wrapper.isSneaking());
        // Target position (where on the entity the player clicked)
        final Optional<Vector3f> target = wrapper.getTarget();
        if (target.isPresent()) {
            final Vector3f t = target.get();
            m.put("target_x", t.getX());
            m.put("target_y", t.getY());
            m.put("target_z", t.getZ());
        }
        // Hand used (for interact actions)
        if (wrapper.getHand() != null) {
            m.put("hand", wrapper.getHand().name());
        }
        return m;
    }

    @NotNull
    private static Map<String, Object> extractAnimation(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientAnimation wrapper = new WrapperPlayClientAnimation(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("hand", wrapper.getHand().name());
        return m;
    }

    // ========== BLOCK INTERACTION EXTRACTION ==========

    @NotNull
    private static Map<String, Object> extractPlayerDigging(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientPlayerDigging wrapper = new WrapperPlayClientPlayerDigging(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("action", wrapper.getAction() == null ? null : wrapper.getAction().name());
        final Vector3i pos = wrapper.getBlockPosition();
        if (pos != null) {
            m.put("x", pos.getX());
            m.put("y", pos.getY());
            m.put("z", pos.getZ());
        }
        m.put("face", wrapper.getBlockFace() == null ? null : wrapper.getBlockFace().name());
        m.put("sequence", wrapper.getSequence());
        return m;
    }

    @NotNull
    private static Map<String, Object> extractBlockPlacement(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientPlayerBlockPlacement wrapper = new WrapperPlayClientPlayerBlockPlacement(event);
        final Map<String, Object> m = new HashMap<>();
        final Vector3i pos = wrapper.getBlockPosition();
        if (pos != null) {
            m.put("x", pos.getX());
            m.put("y", pos.getY());
            m.put("z", pos.getZ());
        }
        m.put("face", wrapper.getFace() == null ? null : wrapper.getFace().name());
        m.put("hand", wrapper.getHand() == null ? null : wrapper.getHand().name());
        // Cursor position within the block face
        if (wrapper.getCursorPosition() != null) {
            m.put("cursor_x", wrapper.getCursorPosition().getX());
            m.put("cursor_y", wrapper.getCursorPosition().getY());
            m.put("cursor_z", wrapper.getCursorPosition().getZ());
        }
        m.put("inside_block", wrapper.getInsideBlock());
        m.put("sequence", wrapper.getSequence());
        return m;
    }

    @NotNull
    private static Map<String, Object> extractUseItem(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientUseItem wrapper = new WrapperPlayClientUseItem(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("hand", wrapper.getHand().name());
        m.put("sequence", wrapper.getSequence());
        // Rotation at use time (1.19+)
        m.put("yaw", wrapper.getYaw());
        m.put("pitch", wrapper.getPitch());
        return m;
    }

    /**
     * Best-effort extraction for modern "use item on block" packets on newer Minecraft versions.
     * We intentionally avoid directly referencing PacketEvents wrapper classes that may not exist
     * in all supported builds, and instead extract by reflection.
     */
    @NotNull
    private static Map<String, Object> extractUseItemOnLike(@NotNull PacketReceiveEvent event) {
        final Map<String, Object> m = new HashMap<>();
        try {
            final Object wrapper = new WrapperPlayClientUseItem(event);
            // Fallback: at least capture hand/sequence/yaw/pitch when available.
            m.put("hand", ((WrapperPlayClientUseItem) wrapper).getHand().name());
            m.put("sequence", ((WrapperPlayClientUseItem) wrapper).getSequence());
            m.put("yaw", ((WrapperPlayClientUseItem) wrapper).getYaw());
            m.put("pitch", ((WrapperPlayClientUseItem) wrapper).getPitch());
        } catch (Throwable ignored) {
            // ignore
        }

        // Try extracting block interaction fields via reflection (position/face/cursor/inside_block)
        try {
            // Attempt to construct WrapperPlayClientPlayerBlockPlacement against this event if compatible.
            try {
                final WrapperPlayClientPlayerBlockPlacement w = new WrapperPlayClientPlayerBlockPlacement(event);
                final Vector3i pos = w.getBlockPosition();
                if (pos != null) {
                    m.put("x", pos.getX());
                    m.put("y", pos.getY());
                    m.put("z", pos.getZ());
                }
                if (w.getFace() != null) {
                    m.put("face", w.getFace().name());
                }
                if (w.getHand() != null) {
                    m.put("hand", w.getHand().name());
                }
                if (w.getCursorPosition() != null) {
                    m.put("cursor_x", w.getCursorPosition().getX());
                    m.put("cursor_y", w.getCursorPosition().getY());
                    m.put("cursor_z", w.getCursorPosition().getZ());
                }
                m.put("inside_block", w.getInsideBlock());
                m.put("sequence", w.getSequence());
            } catch (Throwable ignored) {
                // If wrapper construction isn't compatible, just keep partial fields.
            }
        } catch (Throwable ignored) {
            // ignore
        }
        return m;
    }

    // ========== ENTITY ACTION EXTRACTION ==========

    @NotNull
    private static Map<String, Object> extractEntityAction(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientEntityAction wrapper = new WrapperPlayClientEntityAction(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("entity_id", wrapper.getEntityId());
        m.put("action", wrapper.getAction().name());
        m.put("jump_boost", wrapper.getJumpBoost());
        return m;
    }

    // ========== INVENTORY EXTRACTION ==========

    @NotNull
    private static Map<String, Object> extractClickWindow(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientClickWindow wrapper = new WrapperPlayClientClickWindow(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("window_id", wrapper.getWindowId());
        m.put("slot", wrapper.getSlot());
        m.put("button", wrapper.getButton());
        m.put("action_type", wrapper.getWindowClickType().name());
        // Don't include carried item details to avoid bandwidth bloat
        return m;
    }

    @NotNull
    private static Map<String, Object> extractHeldItemChange(@NotNull PacketReceiveEvent event) {
        final WrapperPlayClientHeldItemChange wrapper = new WrapperPlayClientHeldItemChange(event);
        final Map<String, Object> m = new HashMap<>();
        m.put("slot", wrapper.getSlot());
        return m;
    }
}
