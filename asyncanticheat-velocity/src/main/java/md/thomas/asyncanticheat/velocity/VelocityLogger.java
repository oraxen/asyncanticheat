package md.thomas.asyncanticheat.velocity;

import md.thomas.asyncanticheat.core.AcLogger;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;

final class VelocityLogger implements AcLogger {

    private final Logger logger;

    VelocityLogger(@NotNull Logger logger) {
        this.logger = logger;
    }

    @Override
    public void info(@NotNull String message) {
        logger.info(message);
    }

    @Override
    public void warn(@NotNull String message) {
        logger.warn(message);
    }

    @Override
    public void error(@NotNull String message, @Nullable Throwable t) {
        if (t == null) {
            logger.error(message);
        } else {
            logger.error(message, t);
        }
    }
}


