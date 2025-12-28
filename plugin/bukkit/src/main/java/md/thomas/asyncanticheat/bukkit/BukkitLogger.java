package md.thomas.asyncanticheat.bukkit;

import md.thomas.asyncanticheat.core.AcLogger;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.logging.Level;
import java.util.logging.Logger;

final class BukkitLogger implements AcLogger {

    private final Logger logger;

    BukkitLogger(@NotNull Logger logger) {
        this.logger = logger;
    }

    @Override
    public void info(@NotNull String message) {
        logger.info(message);
    }

    @Override
    public void warn(@NotNull String message) {
        logger.warning(message);
    }

    @Override
    public void error(@NotNull String message, @Nullable Throwable t) {
        logger.log(Level.SEVERE, message, t);
    }
}


