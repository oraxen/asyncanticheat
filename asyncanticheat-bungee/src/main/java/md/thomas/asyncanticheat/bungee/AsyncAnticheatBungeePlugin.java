package md.thomas.asyncanticheat.bungee;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import io.github.retrooper.packetevents.bungee.factory.BungeePacketEventsBuilder;
import md.thomas.asyncanticheat.core.AcLogger;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import net.md_5.bungee.api.ProxyServer;
import net.md_5.bungee.api.plugin.Plugin;
import net.md_5.bungee.api.plugin.PluginManager;
import org.jetbrains.annotations.NotNull;

public final class AsyncAnticheatBungeePlugin extends Plugin {

    private AsyncAnticheatService service;
    private BungeeDevModeManager devMode;
    private BungeePlayerExemptionTracker exemptionTracker;

    @Override
    public void onEnable() {
        final AcLogger logger = new BungeeLogger(getLogger());
        service = new AsyncAnticheatService(getDataFolder(), logger);
        
        // Initialize exemption tracker (handles Bedrock detection, join grace, etc.)
        exemptionTracker = new BungeePlayerExemptionTracker(service.getConfig().getExemptionConfig());
        ProxyServer.getInstance().getPluginManager().registerListener(this, exemptionTracker);
        
        try {
            PacketEvents.setAPI(BungeePacketEventsBuilder.build(this));
            PacketEvents.getAPI().load();
            PacketEvents.getAPI().init();
        } catch (Throwable t) {
            logger.error("[AsyncAnticheat] Failed to initialize PacketEvents (Bungee).", t);
        }
        try {
            PacketEvents.getAPI().getEventManager().registerListener(
                    new BungeePacketCaptureListener(ProxyServer.getInstance(), service, exemptionTracker),
                    PacketListenerPriority.LOW
            );
        } catch (Throwable t) {
            logger.error("[AsyncAnticheat] Failed to register PacketEvents listener on Bungee.", t);
        }

        devMode = new BungeeDevModeManager(this, ProxyServer.getInstance(), service);
        final PluginManager pm = ProxyServer.getInstance().getPluginManager();
        pm.registerCommand(this, new BungeeDevModeCommand(devMode, service));

        service.start();
        logger.info("[AsyncAnticheat] Player exemption tracking enabled (Bedrock detection, grace periods)");
    }

    @Override
    public void onDisable() {
        try {
            PacketEvents.getAPI().terminate();
        } catch (Throwable ignored) {}
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
}


