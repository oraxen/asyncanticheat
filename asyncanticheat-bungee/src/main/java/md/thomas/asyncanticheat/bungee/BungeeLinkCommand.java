package md.thomas.asyncanticheat.bungee;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import net.md_5.bungee.api.ChatColor;
import net.md_5.bungee.api.CommandSender;
import net.md_5.bungee.api.chat.TextComponent;
import net.md_5.bungee.api.plugin.Command;
import org.jetbrains.annotations.NotNull;

final class BungeeLinkCommand extends Command {

    private final AsyncAnticheatService service;

    BungeeLinkCommand(@NotNull AsyncAnticheatService service) {
        super("aac", null, "asyncanticheat");
        this.service = service;
    }

    @Override
    public void execute(CommandSender sender, String[] args) {
        if (service.isDashboardRegistered()) {
            sender.sendMessage(new TextComponent(ChatColor.GREEN + "[AsyncAnticheat] Dashboard: registered"));
            return;
        }

        sender.sendMessage(new TextComponent(ChatColor.YELLOW + "[AsyncAnticheat] Dashboard: not configured yet."));
        sender.sendMessage(new TextComponent(ChatColor.YELLOW + "[AsyncAnticheat] Link this server by opening:"));
        sender.sendMessage(new TextComponent(ChatColor.AQUA + service.getClaimUrl()));
    }
}

