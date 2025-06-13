package md.thomas.asyncanticheat.velocity;

import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import net.kyori.adventure.text.Component;
import org.jetbrains.annotations.NotNull;

import java.util.List;

final class VelocityDevModeCommand implements SimpleCommand {

    private final VelocityDevModeManager dev;
    private final AsyncAnticheatService service;

    VelocityDevModeCommand(@NotNull VelocityDevModeManager dev, @NotNull AsyncAnticheatService service) {
        this.dev = dev;
        this.service = service;
    }

    @Override
    public void execute(Invocation invocation) {
        if (!(invocation.source() instanceof Player player)) {
            invocation.source().sendMessage(Component.text("[AsyncAnticheat] This command must be run by a player."));
            return;
        }
        if (!service.getConfig().isDevModeEnabled()) {
            invocation.source().sendMessage(Component.text("[AsyncAnticheat] Dev mode is disabled. Enable it in config.yml: dev.enabled: true"));
            return;
        }

        final String[] args = invocation.arguments();
        if (args.length == 0) {
            help(invocation);
            return;
        }

        switch (args[0].toLowerCase()) {
            case "start" -> {
                if (args.length < 3) {
                    help(invocation);
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
                final VelocityDevModeManager.Session s = dev.getSession(player.getUniqueId());
                if (s == null) {
                    invocation.source().sendMessage(Component.text("[AsyncAnticheat Dev] No active session."));
                } else {
                    invocation.source().sendMessage(Component.text("[AsyncAnticheat Dev] Active: label=" + s.label + " state=" + s.cheatState +
                            " elapsed=" + s.elapsedSeconds + "s/" + s.durationSeconds + "s toggle=" + s.toggleSeconds + "s warmup=" + s.warmupSeconds + "s"));
                }
            }
            default -> help(invocation);
        }
    }

    @Override
    public boolean hasPermission(Invocation invocation) {
        return invocation.source().hasPermission("asyncanticheat.dev");
    }

    @Override
    public List<String> suggest(Invocation invocation) {
        final String[] args = invocation.arguments();
        if (args.length <= 1) {
            return List.of("start", "stop", "status");
        }
        return List.of();
    }

    private static int parseInt(@NotNull String s, int def) {
        try {
            return Integer.parseInt(s);
        } catch (Exception ignored) {
            return def;
        }
    }

    private static void help(Invocation invocation) {
        invocation.source().sendMessage(Component.text("AsyncAnticheat dev mode (labeled recording)"));
        invocation.source().sendMessage(Component.text("/aacdev start <durationSeconds> <label> [warmupSeconds] [toggleSeconds]"));
        invocation.source().sendMessage(Component.text("/aacdev stop"));
        invocation.source().sendMessage(Component.text("/aacdev status"));
    }
}


