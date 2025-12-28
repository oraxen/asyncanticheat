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
    private RecordingManager recordingManager;
    private BukkitPlayerExemptionTracker exemptionTracker;
    private SchedulerUtil.ScheduledTask stateTask;
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

        // Initialize recording manager for in-game cheat recording
        recordingManager = new RecordingManager(this, service.getConfig(), service.getServerId());
        
        // Ensure recordings are stopped immediately on logout
        getServer().getPluginManager().registerEvents(new Listener() {
            @EventHandler
            public void onQuit(PlayerQuitEvent event) {
                if (recordingManager != null) {
                    recordingManager.handlePlayerQuit(event.getPlayer().getUniqueId());
                }
            }
        }, this);

        // Register main /aac command with subcommands
        final PluginCommand aacCmd = getCommand("aac");
        if (aacCmd != null) {
            final BukkitMainCommand mainCmd = new BukkitMainCommand(service, recordingManager);
            aacCmd.setExecutor(mainCmd);
            aacCmd.setTabCompleter(mainCmd);
        }

        service.start();
        logger.info("[AsyncAnticheat] Player exemption tracking enabled (NCP-style)");

        // Schedule periodic player state snapshots (every 10 ticks = 0.5s)
        // These synthetic packets provide context (swimming, climbing, etc.) to modules
        //
        // On Folia, we use a global timer that schedules per-entity tasks.
        // On Bukkit/Paper, we use a simple repeating task.
        final PlayerStateTask stateTaskRunner = new PlayerStateTask(this, service);
        stateTask = SchedulerUtil.runTaskTimer(
                this,
                20L,  // Initial delay: 1 second (let players fully load)
                10L,  // Period: 10 ticks (0.5 seconds)
                stateTaskRunner
        );
        logger.info("[AsyncAnticheat] Player state tracking enabled (10-tick interval)" +
                (VersionUtil.isFoliaServer() ? " [Folia mode]" : ""));
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
        // Cancel the player state task
        if (stateTask != null) {
            stateTask.cancel();
            stateTask = null;
        }
        // Stop all active recordings and submit them
        if (recordingManager != null) {
            recordingManager.stopAll();
            recordingManager = null;
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


