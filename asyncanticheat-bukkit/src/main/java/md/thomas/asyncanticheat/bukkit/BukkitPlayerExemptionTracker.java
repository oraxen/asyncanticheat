package md.thomas.asyncanticheat.bukkit;

import md.thomas.asyncanticheat.core.ExemptionConfig;
import md.thomas.asyncanticheat.core.ExemptionReason;
import md.thomas.asyncanticheat.core.PlayerExemptionTracker;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.*;
import org.bukkit.potion.PotionEffectType;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bukkit-specific player exemption tracker.
 * 
 * <p>
 * Extends the core {@link PlayerExemptionTracker} with Bukkit-specific state
 * tracking:
 * <ul>
 * <li>Gamemode (Creative, Spectator)</li>
 * <li>Player state (Dead, Sleeping, In Vehicle)</li>
 * <li>Flight state and cooldowns</li>
 * <li>Velocity grace periods</li>
 * <li>Potion effects (Levitation, Slow Falling)</li>
 * </ul>
 * 
 * <p>
 * Based on combined analysis of NoCheatPlus, established AC, and reference anticheat.
 */
public final class BukkitPlayerExemptionTracker extends PlayerExemptionTracker implements Listener {

    private final Map<UUID, BukkitPlayerState> bukkitStates = new ConcurrentHashMap<>();

    /**
     * Bukkit-specific state that extends core connection state.
     */
    private static class BukkitPlayerState {
        volatile long respawnTime = 0;
        volatile long teleportTime = 0;
        volatile int lastVelocityTick = -1000;
        volatile int flightStopTick = -1000;
        volatile boolean wasFlying = false;
    }

    public BukkitPlayerExemptionTracker(@NotNull ExemptionConfig config) {
        super(config);
    }

    /**
     * Check if a Bukkit player should be exempted from packet capture.
     * This includes all core exemptions plus Bukkit-specific state checks.
     * 
     * @param player The player to check
     * @return The first exemption reason found, or null if player should be
     *         captured
     */
    @Nullable
    public ExemptionReason getExemptionReason(@Nullable Player player) {
        if (player == null) {
            return null;
        }

        // First check core exemptions (Bedrock, join grace, etc.)
        final ExemptionReason coreReason = super.getExemptionReason(player.getUniqueId(), player.getName());
        if (coreReason != null) {
            return coreReason;
        }

        final UUID uuid = player.getUniqueId();
        final BukkitPlayerState state = bukkitStates.get(uuid);
        final long now = System.currentTimeMillis();
        final int currentTick = getCurrentTick();

        // ============= BUKKIT-SPECIFIC GRACE PERIODS =============

        if (state != null) {
            if (config.getRespawnGraceMs() > 0 && (now - state.respawnTime) < config.getRespawnGraceMs()) {
                return ExemptionReason.JUST_RESPAWNED;
            }

            if (config.getTeleportGraceMs() > 0 && (now - state.teleportTime) < config.getTeleportGraceMs()) {
                return ExemptionReason.JUST_TELEPORTED;
            }

            // Velocity grace (reference anticheat: 50 ticks = 2.5 seconds)
            if (config.getVelocityGraceTicks() > 0 &&
                    (currentTick - state.lastVelocityTick) < config.getVelocityGraceTicks()) {
                return ExemptionReason.VELOCITY_GRACE;
            }

            // Flight cooldown (reference anticheat: 40 ticks = 2 seconds after stopping flight)
            if (config.getFlightCooldownTicks() > 0 &&
                    (currentTick - state.flightStopTick) < config.getFlightCooldownTicks()) {
                return ExemptionReason.FLIGHT_COOLDOWN;
            }
        }

        // ============= LIVE STATE CHECKS =============

        // Dead check (established AC: iS.b, NCP: early return)
        if (config.isSkipDead() && player.isDead()) {
            return ExemptionReason.DEAD;
        }

        // Sleeping check (established AC: iS.i, NCP: early return)
        if (config.isSkipSleeping() && player.isSleeping()) {
            return ExemptionReason.SLEEPING;
        }

        // Vehicle check (NCP: early return, uses VehicleChecks)
        if (config.isSkipInVehicle() && player.isInsideVehicle()) {
            return ExemptionReason.IN_VEHICLE;
        }

        // Gamemode checks (established AC: iS.r/iS.l, NCP: shouldCheckSurvivalFly)
        final GameMode gameMode = player.getGameMode();

        if (config.isSkipSpectatorMode() && gameMode == GameMode.SPECTATOR) {
            return ExemptionReason.SPECTATOR_MODE;
        }

        if (config.isSkipCreativeMode() && gameMode == GameMode.CREATIVE) {
            return ExemptionReason.CREATIVE_MODE;
        }

        // Flying check (established AC: checks.move.check_flying, NCP: isFlying)
        //
        // IMPORTANT:
        // Only exempt flight if the server actually allows it (creative/permissions).
        // If allowFlight is false but isFlying is true, that is itself suspicious and we
        // still want to capture packets so async modules can detect it.
        if (config.isSkipFlying() && player.isFlying() && player.getAllowFlight()) {
            return ExemptionReason.FLYING;
        }

        // Elytra check
        if (config.isSkipElytraGliding() && player.isGliding()) {
            return ExemptionReason.ELYTRA_GLIDING;
        }

        // Potion effect checks (NCP: Bridge1_9 checks)
        if (config.isSkipLevitationEffect() && player.hasPotionEffect(PotionEffectType.LEVITATION)) {
            return ExemptionReason.LEVITATION_EFFECT;
        }

        if (config.isSkipSlowFallingEffect() && player.hasPotionEffect(PotionEffectType.SLOW_FALLING)) {
            return ExemptionReason.SLOW_FALLING_EFFECT;
        }

        return null; // No exemption - capture this player's packets
    }

    /**
     * Quick check if player should be exempted.
     */
    public boolean isExempt(@Nullable Player player) {
        return getExemptionReason(player) != null;
    }

    /**
     * Get all current exemption reasons for a player (for debugging/logging).
     */
    @NotNull
    public Set<ExemptionReason> getAllExemptionReasons(@Nullable Player player) {
        final EnumSet<ExemptionReason> reasons = EnumSet.noneOf(ExemptionReason.class);
        if (player == null) {
            return reasons;
        }

        // Add core reasons
        reasons.addAll(super.getAllExemptionReasons(player.getUniqueId(), player.getName()));

        final UUID uuid = player.getUniqueId();
        final BukkitPlayerState state = bukkitStates.get(uuid);
        final long now = System.currentTimeMillis();
        final int currentTick = getCurrentTick();

        if (state != null) {
            if (config.getRespawnGraceMs() > 0 && (now - state.respawnTime) < config.getRespawnGraceMs()) {
                reasons.add(ExemptionReason.JUST_RESPAWNED);
            }
            if (config.getTeleportGraceMs() > 0 && (now - state.teleportTime) < config.getTeleportGraceMs()) {
                reasons.add(ExemptionReason.JUST_TELEPORTED);
            }
            if (config.getVelocityGraceTicks() > 0
                    && (currentTick - state.lastVelocityTick) < config.getVelocityGraceTicks()) {
                reasons.add(ExemptionReason.VELOCITY_GRACE);
            }
            if (config.getFlightCooldownTicks() > 0
                    && (currentTick - state.flightStopTick) < config.getFlightCooldownTicks()) {
                reasons.add(ExemptionReason.FLIGHT_COOLDOWN);
            }
        }

        if (config.isSkipDead() && player.isDead())
            reasons.add(ExemptionReason.DEAD);
        if (config.isSkipSleeping() && player.isSleeping())
            reasons.add(ExemptionReason.SLEEPING);
        if (config.isSkipInVehicle() && player.isInsideVehicle())
            reasons.add(ExemptionReason.IN_VEHICLE);

        final GameMode gameMode = player.getGameMode();
        if (config.isSkipSpectatorMode() && gameMode == GameMode.SPECTATOR) {
            reasons.add(ExemptionReason.SPECTATOR_MODE);
        }
        if (config.isSkipCreativeMode() && gameMode == GameMode.CREATIVE) {
            reasons.add(ExemptionReason.CREATIVE_MODE);
        }
        if (config.isSkipFlying() && player.isFlying() && player.getAllowFlight())
            reasons.add(ExemptionReason.FLYING);
        if (config.isSkipElytraGliding() && player.isGliding())
            reasons.add(ExemptionReason.ELYTRA_GLIDING);
        if (config.isSkipLevitationEffect() && player.hasPotionEffect(PotionEffectType.LEVITATION)) {
            reasons.add(ExemptionReason.LEVITATION_EFFECT);
        }
        if (config.isSkipSlowFallingEffect() && player.hasPotionEffect(PotionEffectType.SLOW_FALLING)) {
            reasons.add(ExemptionReason.SLOW_FALLING_EFFECT);
        }

        return reasons;
    }

    // ============= EVENT HANDLERS =============

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        final Player player = event.getPlayer();
        final UUID uuid = player.getUniqueId();

        // Initialize core state
        super.onPlayerJoin(uuid, player.getName());

        // Initialize Bukkit-specific state
        final BukkitPlayerState state = new BukkitPlayerState();
        state.wasFlying = player.isFlying();
        bukkitStates.put(uuid, state);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        final UUID uuid = event.getPlayer().getUniqueId();
        super.onPlayerQuit(uuid);
        bukkitStates.remove(uuid);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerRespawn(PlayerRespawnEvent event) {
        final BukkitPlayerState state = bukkitStates.get(event.getPlayer().getUniqueId());
        if (state != null) {
            state.respawnTime = System.currentTimeMillis();
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        // Use core server switch tracking (works for world changes too)
        super.onServerSwitch(event.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) {
        final BukkitPlayerState state = bukkitStates.get(event.getPlayer().getUniqueId());
        if (state != null) {
            state.teleportTime = System.currentTimeMillis();
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onVelocity(PlayerVelocityEvent event) {
        final BukkitPlayerState state = bukkitStates.get(event.getPlayer().getUniqueId());
        if (state != null) {
            state.lastVelocityTick = getCurrentTick();
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent event) {
        if (event.getEntity() instanceof Player player) {
            if (event.getCause() == EntityDamageEvent.DamageCause.ENTITY_ATTACK ||
                    event.getCause() == EntityDamageEvent.DamageCause.ENTITY_EXPLOSION ||
                    event.getCause() == EntityDamageEvent.DamageCause.BLOCK_EXPLOSION) {
                final BukkitPlayerState state = bukkitStates.get(player.getUniqueId());
                if (state != null) {
                    state.lastVelocityTick = getCurrentTick();
                }
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onToggleFlight(PlayerToggleFlightEvent event) {
        final BukkitPlayerState state = bukkitStates.get(event.getPlayer().getUniqueId());
        if (state != null) {
            if (!event.isFlying() && state.wasFlying) {
                state.flightStopTick = getCurrentTick();
            }
            state.wasFlying = event.isFlying();
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onGameModeChange(PlayerGameModeChangeEvent event) {
        final BukkitPlayerState state = bukkitStates.get(event.getPlayer().getUniqueId());
        if (state != null) {
            final GameMode oldMode = event.getPlayer().getGameMode();
            final GameMode newMode = event.getNewGameMode();

            if ((oldMode == GameMode.CREATIVE || oldMode == GameMode.SPECTATOR) &&
                    (newMode == GameMode.SURVIVAL || newMode == GameMode.ADVENTURE)) {
                state.flightStopTick = getCurrentTick();
            }
        }
    }

    private int getCurrentTick() {
        return Bukkit.getCurrentTick();
    }

    @Override
    public void cleanup() {
        super.cleanup();
        bukkitStates.clear();
    }
}
