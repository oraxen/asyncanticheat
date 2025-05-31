package md.thomas.asyncanticheat.bukkit;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import io.github.retrooper.packetevents.factory.spigot.SpigotPacketEventsBuilder;
import md.thomas.asyncanticheat.core.AcLogger;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.NotNull;

public final class AsyncAnticheatBukkitPlugin extends JavaPlugin {

    private AsyncAnticheatService service;
    private BukkitDevModeManager devMode;
    private BukkitPlayerExemptionTracker exemptionTracker;
    private boolean packetEventsInitialized = false;

    @Override
    public void onLoad() {
        // PacketEvents must be loaded in onLoad() to ensure proper injection timing
        try {
            PacketEvents.setAPI(SpigotPacketEventsBuilder.build(this));
            PacketEvents.getAPI().load();
            packetEventsInitialized = true;
        } catch (Throwable t) {
            getLogger().severe("[AsyncAnticheat] Failed to load PacketEvents (Bukkit): " + t.getMessage());
        }
    }

    @Override
    public void onEnable() {
        final AcLogger logger = new BukkitLogger(getLogger());
        service = new AsyncAnticheatService(getDataFolder(), logger);
        
        // Initialize exemption tracker with config
        // Tracks player states like creative mode, flying, dead, etc. based on NCP patterns
        exemptionTracker = new BukkitPlayerExemptionTracker(service.getConfig().getExemptionConfig());
        getServer().getPluginManager().registerEvents(exemptionTracker, this);
        
        // Initialize PacketEvents (load was called in onLoad)
        if (packetEventsInitialized) {
            try {
                PacketEvents.getAPI().init();
                PacketEvents.getAPI().getEventManager().registerListener(
                        new BukkitPacketCaptureListener(service, exemptionTracker),
                        PacketListenerPriority.LOW
                );
            } catch (Throwable t) {
                logger.error("[AsyncAnticheat] Failed to initialize PacketEvents (Bukkit).", t);
                packetEventsInitialized = false;
            }
        }

        devMode = new BukkitDevModeManager(this, service);
        // Ensure dev sessions are stopped immediately on logout (no orphaned repeating tasks)
        getServer().getPluginManager().registerEvents(new Listener() {
            @EventHandler
            public void onQuit(PlayerQuitEvent event) {
                if (devMode != null) {
                    devMode.stopSilent(event.getPlayer().getUniqueId());
                }
            }
        }, this);
        final PluginCommand cmd = getCommand("aacdev");
        if (cmd != null) {
            final BukkitDevModeCommand executor = new BukkitDevModeCommand(devMode, service);
            cmd.setExecutor(executor);
            cmd.setTabCompleter(executor);
        }

        service.start();
        logger.info("[AsyncAnticheat] Player exemption tracking enabled (NCP-style)");
    }

    @Override
    public void onDisable() {
        if (packetEventsInitialized) {
            try {
                PacketEvents.getAPI().terminate();
            } catch (Throwable ignored) {}
        }
        if (exemptionTracker != null) {
            exemptionTracker.cleanup();
            exemptionTracker = null;
        }
        // IMPORTANT: devMode.stopAll() enqueues DEV_MARKER stop events via service.tryEnqueue(...).
        // service.stop() triggers a best-effort final flush/upload on a daemon thread.
        // Therefore, stopAll MUST run before stop() so stop markers are included in the final upload.
        if (devMode != null) {
            devMode.stopAll("plugin_disable");
            devMode = null;
        }
        if (service != null) {
            service.stop();
            service = null;
        }
    }

    @NotNull
    public AsyncAnticheatService getService() {
        return service;
    }
    
    @NotNull
    public BukkitPlayerExemptionTracker getExemptionTracker() {
        return exemptionTracker;
    }
}


