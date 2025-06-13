package md.thomas.asyncanticheat.bukkit;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

final class BukkitDevModeCommand implements CommandExecutor, TabCompleter {

    private final BukkitDevModeManager dev;
    private final AsyncAnticheatService service;

    BukkitDevModeCommand(@NotNull BukkitDevModeManager dev, @NotNull AsyncAnticheatService service) {
        this.dev = dev;
        this.service = service;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("[AsyncAnticheat] This command must be run by a player.");
            return true;
        }
        if (!service.getConfig().isDevModeEnabled()) {
            sender.sendMessage("[AsyncAnticheat] Dev mode is disabled. Enable it in config.yml: dev.enabled: true");
            return true;
        }
        if (!sender.hasPermission("asyncanticheat.dev")) {
            sender.sendMessage("[AsyncAnticheat] Missing permission: asyncanticheat.dev");
            return true;
        }

        if (args.length == 0) {
            return help(sender);
        }

        final String sub = args[0].toLowerCase();
        switch (sub) {
            case "start" -> {
                if (args.length < 3) return help(sender);
                int duration = parseInt(args[1], service.getConfig().getDevDefaultDurationSeconds());
                String cheatLabel = args[2];
                int warmup = args.length >= 4 ? parseInt(args[3], service.getConfig().getDevDefaultWarmupSeconds()) : service.getConfig().getDevDefaultWarmupSeconds();
                int toggle = args.length >= 5 ? parseInt(args[4], service.getConfig().getDevDefaultToggleSeconds()) : service.getConfig().getDevDefaultToggleSeconds();
                dev.start(player, cheatLabel, duration, warmup, toggle);
                return true;
            }
            case "stop" -> {
                dev.stop(player, "manual");
                return true;
            }
            case "status" -> {
                final BukkitDevModeManager.Session s = dev.getSession(player.getUniqueId());
                if (s == null) {
                    sender.sendMessage("[AsyncAnticheat Dev] No active session.");
                } else {
                    sender.sendMessage("[AsyncAnticheat Dev] Active: label=" + s.label + " state=" + s.cheatState +
                            " elapsed=" + s.elapsedSeconds + "s/" + s.durationSeconds + "s toggle=" + s.toggleSeconds + "s warmup=" + s.warmupSeconds + "s");
                }
                return true;
            }
            default -> {
                return help(sender);
            }
        }
    }

    private static int parseInt(@NotNull String s, int def) {
        try {
            return Integer.parseInt(s);
        } catch (Exception ignored) {
            return def;
        }
    }

    private static boolean help(@NotNull CommandSender sender) {
        sender.sendMessage("AsyncAnticheat dev mode (labeled recording)");
        sender.sendMessage("/aacdev start <durationSeconds> <label> [warmupSeconds] [toggleSeconds]");
        sender.sendMessage("/aacdev stop");
        sender.sendMessage("/aacdev status");
        sender.sendMessage("Markers are injected as DEV_MARKER events with dev_state=on/off so you can train detectors.");
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command, @NotNull String alias, @NotNull String[] args) {
        final List<String> out = new ArrayList<>();
        if (args.length == 1) {
            out.add("start");
            out.add("stop");
            out.add("status");
            return out;
        }
        return out;
    }
}


