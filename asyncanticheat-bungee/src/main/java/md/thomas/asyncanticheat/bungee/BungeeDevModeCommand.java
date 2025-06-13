package md.thomas.asyncanticheat.bungee;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import net.md_5.bungee.api.ChatColor;
import net.md_5.bungee.api.CommandSender;
import net.md_5.bungee.api.connection.ProxiedPlayer;
import net.md_5.bungee.api.plugin.Command;
import org.jetbrains.annotations.NotNull;

final class BungeeDevModeCommand extends Command {

    private final BungeeDevModeManager dev;
    private final AsyncAnticheatService service;

    BungeeDevModeCommand(@NotNull BungeeDevModeManager dev, @NotNull AsyncAnticheatService service) {
        super("aacdev", "asyncanticheat.dev", "asyncdev");
        this.dev = dev;
        this.service = service;
    }

    @Override
    public void execute(CommandSender sender, String[] args) {
        if (!(sender instanceof ProxiedPlayer player)) {
            sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.RED + "[AsyncAnticheat] This command must be run by a player."));
            return;
        }
        if (!service.getConfig().isDevModeEnabled()) {
            sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.RED + "[AsyncAnticheat] Dev mode is disabled. Enable it in config.yml: dev.enabled: true"));
            return;
        }

        if (args.length == 0) {
            help(sender);
            return;
        }

        final String sub = args[0].toLowerCase();
        switch (sub) {
            case "start" -> {
                if (args.length < 3) {
                    help(sender);
                    return;
                }
                int duration = parseInt(args[1], service.getConfig().getDevDefaultDurationSeconds());
                String cheatLabel = args[2];
                int warmup = args.length >= 4 ? parseInt(args[3], service.getConfig().getDevDefaultWarmupSeconds()) : service.getConfig().getDevDefaultWarmupSeconds();
                int toggle = args.length >= 5 ? parseInt(args[4], service.getConfig().getDevDefaultToggleSeconds()) : service.getConfig().getDevDefaultToggleSeconds();
                dev.start(player, cheatLabel, duration, warmup, toggle);
            }
            case "stop" -> dev.stop(player, "manual");
            case "status" -> {
                final BungeeDevModeManager.Session s = dev.getSession(player.getUniqueId());
                if (s == null) {
                    sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.YELLOW + "[AsyncAnticheat Dev] No active session."));
                } else {
                    sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.YELLOW + "[AsyncAnticheat Dev] Active: label=" + s.label + " state=" + s.cheatState +
                            " elapsed=" + s.elapsedSeconds + "s/" + s.durationSeconds + "s toggle=" + s.toggleSeconds + "s warmup=" + s.warmupSeconds + "s"));
                }
            }
            default -> help(sender);
        }
    }

    private static int parseInt(@NotNull String s, int def) {
        try {
            return Integer.parseInt(s);
        } catch (Exception ignored) {
            return def;
        }
    }

    private static void help(CommandSender sender) {
        sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.GOLD + "AsyncAnticheat dev mode (labeled recording)"));
        sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.YELLOW + "/aacdev start <durationSeconds> <label> [warmupSeconds] [toggleSeconds]"));
        sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.YELLOW + "/aacdev stop"));
        sender.sendMessage(new net.md_5.bungee.api.chat.TextComponent(ChatColor.YELLOW + "/aacdev status"));
    }
}


