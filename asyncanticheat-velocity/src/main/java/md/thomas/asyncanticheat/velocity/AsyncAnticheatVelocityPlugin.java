package md.thomas.asyncanticheat.velocity;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import com.google.inject.Inject;
import com.velocitypowered.api.command.CommandMeta;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.PluginContainer;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import md.thomas.asyncanticheat.core.AcLogger;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import io.github.retrooper.packetevents.velocity.factory.VelocityPacketEventsBuilder;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;

import java.nio.file.Path;

public final class AsyncAnticheatVelocityPlugin {

    private final ProxyServer server;
    private final Logger logger;
    private final PluginContainer pluginContainer;
    private final Path dataDirectory;

    private AsyncAnticheatService service;
    private VelocityDevModeManager devMode;
    private VelocityPlayerExemptionTracker exemptionTracker;

    @Inject
    public AsyncAnticheatVelocityPlugin(
            ProxyServer server,
            Logger logger,
            PluginContainer pluginContainer,
            @DataDirectory Path dataDirectory
    ) {
        this.server = server;
        this.logger = logger;
        this.pluginContainer = pluginContainer;
        this.dataDirectory = dataDirectory;
        PacketEvents.setAPI(VelocityPacketEventsBuilder.build(server, pluginContainer, logger, dataDirectory));
    }

    @Subscribe
    public void onProxyInitialize(ProxyInitializeEvent event) {
        final AcLogger log = new VelocityLogger(logger);
        service = new AsyncAnticheatService(dataDirectory.toFile(), log);
        service.start();
        
        // Initialize exemption tracker (handles Bedrock detection, join grace, etc.)
        exemptionTracker = new VelocityPlayerExemptionTracker(service.getConfig().getExemptionConfig());
        server.getEventManager().register(pluginContainer, exemptionTracker);

        PacketEvents.getAPI().getEventManager().registerListener(
                new VelocityPacketCaptureListener(server, service, exemptionTracker),
                PacketListenerPriority.LOW
        );
        PacketEvents.getAPI().init();

        devMode = new VelocityDevModeManager(server, pluginContainer, service);
        CommandMeta meta = server.getCommandManager()
                .metaBuilder("aacdev")
                .plugin(pluginContainer)
                .build();
        server.getCommandManager().register(meta, new VelocityDevModeCommand(devMode, service));

        CommandMeta linkMeta = server.getCommandManager()
                .metaBuilder("aac")
                .aliases("asyncanticheat")
                .plugin(pluginContainer)
                .build();
        server.getCommandManager().register(linkMeta, new VelocityLinkCommand(service));

        logger.info("AsyncAnticheat (Velocity) enabled with exemption tracking (Bedrock detection, grace periods)");
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        if (exemptionTracker != null) {
            exemptionTracker.cleanup();
            exemptionTracker = null;
        }
        if (devMode != null) {
            devMode.stopAll("plugin_disable");
            devMode = null;
        }
        if (service != null) {
            service.stop();
            service = null;
        }
        try {
            PacketEvents.getAPI().terminate();
        } catch (Throwable ignored) {}
        logger.info("AsyncAnticheat (Velocity) disabled.");
    }

    @NotNull
    public ProxyServer getServer() {
        return server;
    }

    @NotNull
    public AsyncAnticheatService getService() {
        return service;
    }
}


