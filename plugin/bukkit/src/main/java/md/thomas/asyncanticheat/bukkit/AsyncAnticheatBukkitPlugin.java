package md.thomas.asyncanticheat.bukkit;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import io.github.retrooper.packetevents.factory.spigot.SpigotPacketEventsBuilder;
import md.thomas.asyncanticheat.core.AcLogger;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import org.bstats.bukkit.Metrics;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.NotNull;

import java.util.List;

public final class AsyncAnticheatBukkitPlugin extends JavaPlugin {

    private AsyncAnticheatService service;
    private RecordingManager recordingManager;
    private BukkitPlayerExemptionTracker exemptionTracker;
    private SchedulerUtil.ScheduledTask stateTask;
    private Command registeredCommand;
    private boolean packetEventsInitialized = false;

    @Override
    public void onLoad() {
        // PacketEvents is downloaded by AacBootstrap before this class loads (Paper)
        // or must be manually installed (Spigot)
        try {
            PacketEvents.setAPI(SpigotPacketEventsBuilder.build(this));
            PacketEvents.getAPI().load();
            packetEventsInitialized = true;
        } catch (Throwable t) {
            getLogger().severe("[AsyncAnticheat] Failed to load PacketEvents: " + t.getMessage());
            getLogger().severe("[AsyncAnticheat] PacketEvents is required. Install it from https://modrinth.com/plugin/packetevents");
        }
    }

    @Override
    public void onEnable() {
        if (!packetEventsInitialized) {
            getLogger().severe("[AsyncAnticheat] PacketEvents not available. Disabling plugin.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

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
        // Use CommandMap directly for Paper plugin compatibility
        registerCommand();

        // Initialize bStats metrics (plugin ID: 20187)
        new Metrics(this, 20187);

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
        // Unregister command to prevent leak on reload
        if (registeredCommand != null) {
            registeredCommand.unregister(Bukkit.getCommandMap());
            registeredCommand = null;
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

    private void registerCommand() {
        final BukkitMainCommand mainCmd = new BukkitMainCommand(service, recordingManager);

        // Try Spigot-style registration first (plugin.yml defines the command)
        // This works on Spigot servers where getCommand() returns the registered command
        PluginCommand pluginCmd = getCommand("aac");
        if (pluginCmd != null) {
            pluginCmd.setExecutor(mainCmd);
            pluginCmd.setTabCompleter(mainCmd);
            return;
        }

        // Fall back to CommandMap registration for Paper plugins
        // Paper plugins use paper-plugin.yml which doesn't support getCommand()
        registeredCommand = new Command("aac", "AsyncAnticheat main command", "/aac [token|record|status]", List.of("asyncanticheat")) {
            @Override
            public boolean execute(@NotNull CommandSender sender, @NotNull String commandLabel, @NotNull String[] args) {
                return mainCmd.onCommand(sender, this, commandLabel, args);
            }

            @Override
            public @NotNull List<String> tabComplete(@NotNull CommandSender sender, @NotNull String alias, @NotNull String[] args) {
                List<String> result = mainCmd.onTabComplete(sender, this, alias, args);
                return result != null ? result : List.of();
            }
        };

        Bukkit.getCommandMap().register("asyncanticheat", registeredCommand);
    }
}


