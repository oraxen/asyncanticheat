package md.thomas.asyncanticheat.bukkit;

import org.bukkit.Bukkit;
import org.bukkit.entity.Entity;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.lang.reflect.Method;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Utility class for scheduling tasks that works on both Bukkit/Paper and Folia servers.
 * On Folia, this uses the GlobalRegionScheduler, AsyncScheduler, and EntityScheduler APIs.
 * On regular Bukkit/Paper, this falls back to the standard BukkitScheduler.
 */
public final class SchedulerUtil {

    private static Object globalRegionScheduler;
    private static Object asyncScheduler;
    private static Method globalRunMethod;
    private static Method globalRunDelayedMethod;
    private static Method globalRunAtFixedRateMethod;
    private static Method asyncRunMethod;
    private static Method asyncRunDelayedMethod;
    private static Method asyncRunAtFixedRateMethod;
    private static Method entityRunMethod;
    private static Method entityRunDelayedMethod;
    private static Method entityRunAtFixedRateMethod;
    private static Method taskCancelMethod;

    private static boolean foliaInitialized = false;
    private static Exception foliaInitException = null;

    static {
        if (VersionUtil.isFoliaServer()) {
            try {
                initializeFoliaSchedulers();
                foliaInitialized = true;
            } catch (Exception e) {
                foliaInitException = e;
                foliaInitialized = false;
                System.err.println("[AsyncAnticheat] CRITICAL: Failed to initialize Folia scheduler APIs!");
                System.err.println("[AsyncAnticheat] This will cause scheduling errors. Please report this issue.");
                e.printStackTrace();
            }
        }
    }

    /**
     * Throws an exception if running on Folia but scheduler initialization failed.
     */
    private static void ensureFoliaReady() {
        if (VersionUtil.isFoliaServer() && !foliaInitialized) {
            throw new IllegalStateException(
                    "Folia scheduler initialization failed. Cannot schedule tasks. " +
                            "See startup logs for the original error.",
                    foliaInitException
            );
        }
    }

    private static void initializeFoliaSchedulers() throws Exception {
        // Get the GlobalRegionScheduler
        Method getGlobalRegionScheduler = Bukkit.class.getMethod("getGlobalRegionScheduler");
        globalRegionScheduler = getGlobalRegionScheduler.invoke(null);

        // Get the AsyncScheduler
        Method getAsyncScheduler = Bukkit.class.getMethod("getAsyncScheduler");
        asyncScheduler = getAsyncScheduler.invoke(null);

        // Get GlobalRegionScheduler methods
        Class<?> globalSchedulerClass = globalRegionScheduler.getClass();
        globalRunMethod = globalSchedulerClass.getMethod("run", Plugin.class, Consumer.class);
        globalRunDelayedMethod = globalSchedulerClass.getMethod("runDelayed", Plugin.class, Consumer.class, long.class);
        globalRunAtFixedRateMethod = globalSchedulerClass.getMethod("runAtFixedRate", Plugin.class, Consumer.class, long.class, long.class);

        // Get AsyncScheduler methods
        Class<?> asyncSchedulerClass = asyncScheduler.getClass();
        asyncRunMethod = asyncSchedulerClass.getMethod("runNow", Plugin.class, Consumer.class);
        asyncRunDelayedMethod = asyncSchedulerClass.getMethod("runDelayed", Plugin.class, Consumer.class, long.class, TimeUnit.class);
        asyncRunAtFixedRateMethod = asyncSchedulerClass.getMethod("runAtFixedRate", Plugin.class, Consumer.class, long.class, long.class, TimeUnit.class);

        // Get ScheduledTask cancel method
        Class<?> scheduledTaskClass = Class.forName("io.papermc.paper.threadedregions.scheduler.ScheduledTask");
        taskCancelMethod = scheduledTaskClass.getMethod("cancel");

        // Get Entity scheduler methods
        Class<?> entitySchedulerClass = Class.forName("io.papermc.paper.threadedregions.scheduler.EntityScheduler");
        entityRunMethod = entitySchedulerClass.getMethod("run", Plugin.class, Consumer.class, Runnable.class);
        entityRunDelayedMethod = entitySchedulerClass.getMethod("runDelayed", Plugin.class, Consumer.class, Runnable.class, long.class);
        entityRunAtFixedRateMethod = entitySchedulerClass.getMethod("runAtFixedRate", Plugin.class, Consumer.class, Runnable.class, long.class, long.class);
    }

    private SchedulerUtil() {
        // Utility class
    }

    // ==================== GLOBAL/SYNC TASKS ====================

    /**
     * Runs a task on the next server tick (global region on Folia, main thread on Bukkit).
     */
    public static ScheduledTask runTask(@NotNull Plugin plugin, @NotNull Runnable runnable) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Consumer<Object> consumer = task -> runnable.run();
                Object task = globalRunMethod.invoke(globalRegionScheduler, plugin, consumer);
                return new ScheduledTask(task);
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTask(plugin, runnable);
        return new ScheduledTask(task);
    }

    /**
     * Runs a task after the specified delay in ticks.
     */
    public static ScheduledTask runTaskLater(@NotNull Plugin plugin, long delayTicks, @NotNull Runnable runnable) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Consumer<Object> consumer = task -> runnable.run();
                Object task = globalRunDelayedMethod.invoke(globalRegionScheduler, plugin, consumer, Math.max(1, delayTicks));
                return new ScheduledTask(task);
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia delayed task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTaskLater(plugin, runnable, delayTicks);
        return new ScheduledTask(task);
    }

    /**
     * Runs a task repeatedly with the specified delay and period in ticks.
     */
    public static ScheduledTask runTaskTimer(@NotNull Plugin plugin, long delayTicks, long periodTicks, @NotNull Runnable runnable) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Consumer<Object> consumer = task -> runnable.run();
                Object task = globalRunAtFixedRateMethod.invoke(globalRegionScheduler, plugin, consumer, Math.max(1, delayTicks), Math.max(1, periodTicks));
                return new ScheduledTask(task);
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia timer task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTaskTimer(plugin, runnable, delayTicks, periodTicks);
        return new ScheduledTask(task);
    }

    // ==================== ASYNC TASKS ====================

    /**
     * Runs a task asynchronously.
     */
    public static ScheduledTask runTaskAsync(@NotNull Plugin plugin, @NotNull Runnable runnable) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Consumer<Object> consumer = task -> runnable.run();
                Object task = asyncRunMethod.invoke(asyncScheduler, plugin, consumer);
                return new ScheduledTask(task);
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia async task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTaskAsynchronously(plugin, runnable);
        return new ScheduledTask(task);
    }

    /**
     * Runs a task asynchronously after the specified delay in ticks.
     */
    public static ScheduledTask runTaskLaterAsync(@NotNull Plugin plugin, long delayTicks, @NotNull Runnable runnable) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Consumer<Object> consumer = task -> runnable.run();
                long delayMs = delayTicks * 50;
                Object task = asyncRunDelayedMethod.invoke(asyncScheduler, plugin, consumer, delayMs, TimeUnit.MILLISECONDS);
                return new ScheduledTask(task);
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia async delayed task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, runnable, delayTicks);
        return new ScheduledTask(task);
    }

    /**
     * Runs a task asynchronously with the specified delay and period in ticks.
     */
    public static ScheduledTask runTaskTimerAsync(@NotNull Plugin plugin, long delayTicks, long periodTicks, @NotNull Runnable runnable) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Consumer<Object> consumer = task -> runnable.run();
                long delayMs = delayTicks * 50;
                long periodMs = periodTicks * 50;
                Object task = asyncRunAtFixedRateMethod.invoke(asyncScheduler, plugin, consumer, delayMs, periodMs, TimeUnit.MILLISECONDS);
                return new ScheduledTask(task);
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia async timer task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, runnable, delayTicks, periodTicks);
        return new ScheduledTask(task);
    }

    // ==================== ENTITY-BASED TASKS (Entity Scheduler) ====================

    /**
     * Runs a task for a specific entity (uses EntityScheduler on Folia).
     * This ensures the task runs on the thread that owns the entity.
     * If the entity is retired before execution, the task is silently skipped.
     *
     * @param plugin   The plugin owning the task
     * @param entity   The entity to schedule the task for
     * @param runnable The task to run
     * @return The scheduled task, or null if the entity was already retired
     */
    @Nullable
    public static ScheduledTask runForEntity(@NotNull Plugin plugin, @NotNull Entity entity, @NotNull Runnable runnable) {
        return runForEntity(plugin, entity, runnable, null);
    }

    /**
     * Runs a task for a specific entity (uses EntityScheduler on Folia).
     * This ensures the task runs on the thread that owns the entity.
     *
     * @param plugin   The plugin owning the task
     * @param entity   The entity to schedule the task for
     * @param runnable The task to run
     * @param retired  The runnable to run if the entity is retired (removed) before the task runs
     * @return The scheduled task, or null if the entity was already retired
     */
    @Nullable
    public static ScheduledTask runForEntity(@NotNull Plugin plugin, @NotNull Entity entity, @NotNull Runnable runnable, @Nullable Runnable retired) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Method getSchedulerMethod = Entity.class.getMethod("getScheduler");
                Object entityScheduler = getSchedulerMethod.invoke(entity);
                Consumer<Object> consumer = task -> runnable.run();
                Object task = entityRunMethod.invoke(entityScheduler, plugin, consumer, retired);
                return task != null ? new ScheduledTask(task) : null;
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia entity task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTask(plugin, runnable);
        return new ScheduledTask(task);
    }

    /**
     * Runs a task for a specific entity after the specified delay in ticks.
     *
     * @param plugin     The plugin owning the task
     * @param entity     The entity to schedule the task for
     * @param delayTicks The delay in ticks
     * @param runnable   The task to run
     * @param retired    The runnable to run if the entity is retired
     * @return The scheduled task, or null if the entity was already retired
     */
    @Nullable
    public static ScheduledTask runForEntityLater(@NotNull Plugin plugin, @NotNull Entity entity, long delayTicks, @NotNull Runnable runnable, @Nullable Runnable retired) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Method getSchedulerMethod = Entity.class.getMethod("getScheduler");
                Object entityScheduler = getSchedulerMethod.invoke(entity);
                Consumer<Object> consumer = task -> runnable.run();
                Object task = entityRunDelayedMethod.invoke(entityScheduler, plugin, consumer, retired, Math.max(1, delayTicks));
                return task != null ? new ScheduledTask(task) : null;
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia entity delayed task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTaskLater(plugin, runnable, delayTicks);
        return new ScheduledTask(task);
    }

    /**
     * Runs a task for a specific entity repeatedly with the specified delay and period in ticks.
     *
     * @param plugin      The plugin owning the task
     * @param entity      The entity to schedule the task for
     * @param delayTicks  The initial delay in ticks
     * @param periodTicks The period in ticks
     * @param runnable    The task to run
     * @param retired     The runnable to run if the entity is retired
     * @return The scheduled task, or null if the entity was already retired
     */
    @Nullable
    public static ScheduledTask runForEntityTimer(@NotNull Plugin plugin, @NotNull Entity entity, long delayTicks, long periodTicks, @NotNull Runnable runnable, @Nullable Runnable retired) {
        if (VersionUtil.isFoliaServer() && foliaInitialized) {
            try {
                Method getSchedulerMethod = Entity.class.getMethod("getScheduler");
                Object entityScheduler = getSchedulerMethod.invoke(entity);
                Consumer<Object> consumer = task -> runnable.run();
                Object task = entityRunAtFixedRateMethod.invoke(entityScheduler, plugin, consumer, retired, Math.max(1, delayTicks), Math.max(1, periodTicks));
                return task != null ? new ScheduledTask(task) : null;
            } catch (Exception e) {
                throw new RuntimeException("Failed to schedule Folia entity timer task", e);
            }
        }
        ensureFoliaReady();
        BukkitTask task = Bukkit.getScheduler().runTaskTimer(plugin, runnable, delayTicks, periodTicks);
        return new ScheduledTask(task);
    }

    /**
     * Cancels a task by its ID (Bukkit only, no-op on Folia).
     */
    public static void cancelTask(int taskId) {
        if (!VersionUtil.isFoliaServer()) {
            Bukkit.getScheduler().cancelTask(taskId);
        }
    }

    /**
     * Wrapper class for scheduled tasks that works with both Bukkit and Folia.
     */
    public static class ScheduledTask {
        private final Object task;
        private final boolean isFolia;

        public ScheduledTask(Object task) {
            this.task = task;
            this.isFolia = VersionUtil.isFoliaServer() && !(task instanceof BukkitTask);
        }

        /**
         * Cancels this scheduled task.
         */
        public void cancel() {
            if (task == null) return;

            if (isFolia) {
                try {
                    if (taskCancelMethod != null) {
                        taskCancelMethod.invoke(task);
                    }
                } catch (Exception e) {
                    throw new RuntimeException("Failed to cancel Folia task", e);
                }
            } else if (task instanceof BukkitTask bukkitTask) {
                bukkitTask.cancel();
            }
        }

        /**
         * Gets the task ID (Bukkit only, returns -1 on Folia).
         */
        public int getTaskId() {
            if (!isFolia && task instanceof BukkitTask bukkitTask) {
                return bukkitTask.getTaskId();
            }
            return -1;
        }

        /**
         * Checks if the task is cancelled.
         */
        public boolean isCancelled() {
            if (task == null) return true;

            if (isFolia) {
                try {
                    Method isCancelledMethod = task.getClass().getMethod("isCancelled");
                    return (boolean) isCancelledMethod.invoke(task);
                } catch (Exception e) {
                    return false;
                }
            } else if (task instanceof BukkitTask bukkitTask) {
                return bukkitTask.isCancelled();
            }
            return false;
        }

        /**
         * Gets the underlying task object.
         */
        public Object getTask() {
            return task;
        }
    }
}
