package md.thomas.asyncanticheat.bukkit;

import io.papermc.paper.plugin.loader.PluginClasspathBuilder;
import io.papermc.paper.plugin.loader.PluginLoader;
import md.thomas.hopper.Dependency;
import md.thomas.hopper.DownloadResult;
import md.thomas.hopper.FailurePolicy;
import md.thomas.hopper.LogLevel;
import md.thomas.hopper.paper.HopperBootstrap;
import md.thomas.hopper.version.UpdatePolicy;
import org.jetbrains.annotations.NotNull;

/**
 * Paper plugin loader that downloads PacketEvents before the plugin class is loaded.
 * This ensures PacketEvents classes are available when the plugin initializes.
 *
 * Configured in paper-plugin.yml with the loader property.
 */
@SuppressWarnings("UnstableApiUsage")
public class AacBootstrap implements PluginLoader {

    @Override
    public void classloader(@NotNull PluginClasspathBuilder builder) {
        if (Boolean.getBoolean("asyncanticheat.skipDependencyDownload")) {
            return;
        }

        DownloadResult result = HopperBootstrap.create(builder.getContext())
                .logLevel(LogLevel.NORMAL)
                .require(Dependency.modrinth("packetevents")
                        .minVersion("2.7.0")
                        .updatePolicy(UpdatePolicy.MINOR)
                        .onFailure(FailurePolicy.FAIL)
                        .build())
                .download();

        if (result.requiresRestart()) {
            builder.getContext().getLogger().error("PacketEvents was downloaded. Please restart the server.");
        }
    }
}
