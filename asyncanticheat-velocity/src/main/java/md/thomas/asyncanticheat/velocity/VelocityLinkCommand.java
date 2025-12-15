package md.thomas.asyncanticheat.velocity;

import com.velocitypowered.api.command.SimpleCommand;
import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import net.kyori.adventure.text.Component;
import org.jetbrains.annotations.NotNull;

final class VelocityLinkCommand implements SimpleCommand {

    private final AsyncAnticheatService service;

    VelocityLinkCommand(@NotNull AsyncAnticheatService service) {
        this.service = service;
    }

    @Override
    public void execute(Invocation invocation) {
        if (service.isDashboardRegistered()) {
            invocation.source().sendMessage(Component.text("[AsyncAnticheat] Dashboard: registered"));
            return;
        }

        invocation.source().sendMessage(Component.text("[AsyncAnticheat] Dashboard: not configured yet."));
        invocation.source().sendMessage(Component.text("[AsyncAnticheat] Link this server by opening:"));
        invocation.source().sendMessage(Component.text(service.getClaimUrl()));
    }
}

