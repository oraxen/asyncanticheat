package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

public interface AcLogger {
    void info(@NotNull String message);

    void warn(@NotNull String message);

    void error(@NotNull String message, @Nullable Throwable t);
}


