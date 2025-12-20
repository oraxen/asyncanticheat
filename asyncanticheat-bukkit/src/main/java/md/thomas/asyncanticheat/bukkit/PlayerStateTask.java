package md.thomas.asyncanticheat.bukkit;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import md.thomas.asyncanticheat.core.PacketRecord;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.potion.PotionEffectType;
import org.jetbrains.annotations.NotNull;

import java.util.HashMap;
import java.util.Map;

/**
 * Periodically injects synthetic PLAYER_STATE packets into the capture stream.
 * 
 * <p>
 * These packets provide server-side context that detection modules need to avoid
 * false positives. For example, a player swimming in water can move upward without
 * it being flight - but the module only sees movement packets and doesn't know
 * about the water. This task sends periodic state snapshots so modules can make
 * informed decisions.
 * 
 * <p>
 * Default interval: 10 ticks (0.5 seconds). This balances accuracy with bandwidth.
 * 
 * <p>
 * <b>Folia compatibility:</b> On Folia, this task runs on the global region scheduler
 * and dispatches per-entity tasks to safely access player state. On regular Bukkit/Paper,
 * it runs directly on the main thread.
 */
public final class PlayerStateTask implements Runnable {

    private final Plugin plugin;
    private final AsyncAnticheatService service;
    private final boolean isFolia;

    public PlayerStateTask(@NotNull Plugin plugin, @NotNull AsyncAnticheatService service) {
        this.plugin = plugin;
        this.service = service;
        this.isFolia = VersionUtil.isFoliaServer();
    }

    @Override
    public void run() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            if (player == null || !player.isOnline()) {
                continue;
            }

            if (isFolia) {
                // On Folia, we must access player state on the entity's owning thread.
                // Schedule a per-entity task that captures and enqueues the state.
                SchedulerUtil.runForEntity(plugin, player, () -> captureAndEnqueue(player), null);
            } else {
                // On regular Bukkit/Paper, we're already on the main thread.
                captureAndEnqueue(player);
            }
        }
    }

    private void captureAndEnqueue(@NotNull Player player) {
        // Double-check player is still valid (especially important for Folia delayed execution)
        if (!player.isOnline()) {
            return;
        }

        final Map<String, Object> fields = buildStateFields(player);

        service.tryEnqueue(new PacketRecord(
                System.currentTimeMillis(),
                "synthetic",
                "PLAYER_STATE",
                player.getUniqueId().toString(),
                player.getName(),
                fields
        ));
    }

    @NotNull
    private static Map<String, Object> buildStateFields(@NotNull Player player) {
        final Map<String, Object> fields = new HashMap<>();

        // Water / swimming state
        fields.put("in_water", player.isInWater());
        fields.put("swimming", player.isSwimming());

        // Ground state (server-side truth)
        fields.put("on_ground", player.isOnGround());

        // Flight state
        fields.put("flying", player.isFlying());
        fields.put("allow_flying", player.getAllowFlight());

        // Elytra gliding
        fields.put("gliding", player.isGliding());

        // Climbing (ladder, vine, etc.)
        fields.put("climbing", player.isClimbing());

        // Vehicle state
        fields.put("in_vehicle", player.isInsideVehicle());

        // Trident riptide
        fields.put("riptiding", player.isRiptiding());

        // Player condition
        fields.put("sleeping", player.isSleeping());
        fields.put("dead", player.isDead());

        // Game mode
        fields.put("gamemode", player.getGameMode().name());

        // Relevant potion effects
        fields.put("slow_falling", player.hasPotionEffect(PotionEffectType.SLOW_FALLING));
        fields.put("levitation", player.hasPotionEffect(PotionEffectType.LEVITATION));

        // Additional useful context
        fields.put("sprinting", player.isSprinting());
        fields.put("sneaking", player.isSneaking());
        fields.put("blocking", player.isBlocking());

        // Fall distance (useful for nofall detection)
        fields.put("fall_distance", (double) player.getFallDistance());

        return fields;
    }
}
