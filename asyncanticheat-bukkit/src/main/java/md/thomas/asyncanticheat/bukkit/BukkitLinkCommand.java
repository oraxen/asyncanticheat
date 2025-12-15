package md.thomas.asyncanticheat.bukkit;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.jetbrains.annotations.NotNull;

final class BukkitLinkCommand implements CommandExecutor {

    private final AsyncAnticheatService service;

    BukkitLinkCommand(@NotNull AsyncAnticheatService service) {
        this.service = service;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (service.isDashboardRegistered()) {
            sender.sendMessage("[AsyncAnticheat] Dashboard: registered");
            return true;
        }

        sender.sendMessage("[AsyncAnticheat] Dashboard: not configured yet.");
        sender.sendMessage("[AsyncAnticheat] Link this server by opening:");
        sender.sendMessage(service.getClaimUrl());
        return true;
    }
}

