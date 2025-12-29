package md.thomas.asyncanticheat.bukkit;

import md.thomas.hopper.Dependency;
import md.thomas.hopper.FailurePolicy;
import md.thomas.hopper.LogLevel;
import md.thomas.hopper.bukkit.BukkitHopper;
import md.thomas.hopper.version.UpdatePolicy;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.util.logging.Logger;
import java.util.regex.Pattern;

/**
 * Handles automatic downloading of PacketEvents using Hopper.
 * <p>
 * Downloaded plugins are automatically loaded at runtime without requiring a server restart.
 */
public final class AacHopper {

    private static boolean downloadComplete = false;
    private static boolean requiresRestart = false;
    private static boolean enabled = true;

    // Matches: packetevents.jar, packetevents-spigot-2.7.0.jar, PacketEvents-2.7.0.jar
    private static final Pattern PACKETEVENTS_PATTERN = Pattern.compile(
        "(?i)^packetevents([-_][\\w.-]*)?\\.jar$"
    );

    private AacHopper() {}

    /**
     * Registers PacketEvents dependency with Hopper.
     * Should be called in the plugin constructor.
     *
     * @param plugin the plugin instance
     */
    public static void register(@NotNull Plugin plugin) {
        Logger logger = plugin.getLogger();

        // Check if auto-download is disabled via system property (config not loaded in constructor)
        if (Boolean.getBoolean("asyncanticheat.skipDependencyDownload")) {
            enabled = false;
            logger.info("Auto-download of dependencies is disabled");
            return;
        }

        BukkitHopper.register(plugin, deps -> {
            // Check if PacketEvents is already installed
            boolean hasPacketEvents = pluginJarExists(PACKETEVENTS_PATTERN);

            if (!hasPacketEvents) {
                // Primary source: Modrinth (auto-detects platform)
                deps.require(Dependency.modrinth("packetevents")
                    .name("PacketEvents")
                    .minVersion("2.7.0")
                    .updatePolicy(UpdatePolicy.MINOR)
                    .onFailure(FailurePolicy.FAIL)
                    .build());

                // Fallback source: GitHub releases
                deps.require(Dependency.github("retrooper/packetevents")
                    .name("PacketEvents")
                    .minVersion("2.7.0")
                    .assetPattern("*-spigot-*.jar")
                    .updatePolicy(UpdatePolicy.MINOR)
                    .onFailure(FailurePolicy.WARN_SKIP)
                    .build());
            }
        });
    }

    /**
     * Downloads all registered dependencies and automatically loads them.
     * Should be called in the plugin's onLoad() method.
     *
     * @param plugin the plugin instance
     * @return true if all dependencies are satisfied and loaded
     */
    public static boolean download(@NotNull Plugin plugin) {
        if (!enabled) {
            downloadComplete = true;
            return true;
        }

        Logger logger = plugin.getLogger();
        BukkitHopper.DownloadAndLoadResult result = BukkitHopper.downloadAndLoad(plugin, LogLevel.QUIET);

        downloadComplete = true;
        requiresRestart = !result.noRestartRequired();

        if (requiresRestart) {
            logger.warning("Some dependencies require a server restart to load:");
            for (var failed : result.loadResult().failed()) {
                logger.warning("  - " + failed.path().getFileName() + ": " + failed.error());
            }
        }

        return !requiresRestart;
    }

    /**
     * @return true if a restart is required to load newly downloaded dependencies
     */
    public static boolean requiresRestart() {
        return requiresRestart;
    }

    /**
     * @return true if the download phase has completed
     */
    public static boolean isDownloadComplete() {
        return downloadComplete;
    }

    /**
     * Checks if a plugin jar file exists in the plugins folder using a regex pattern.
     */
    private static boolean pluginJarExists(Pattern pattern) {
        File pluginsFolder = Bukkit.getPluginsFolder();
        if (pluginsFolder == null || !pluginsFolder.exists()) {
            return false;
        }

        File[] files = pluginsFolder.listFiles((dir, name) ->
            pattern.matcher(name).matches()
        );

        return files != null && files.length > 0;
    }
}
