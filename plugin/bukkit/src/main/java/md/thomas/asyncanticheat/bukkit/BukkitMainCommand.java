package md.thomas.asyncanticheat.bukkit;

import md.thomas.asyncanticheat.core.AsyncAnticheatService;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Main /aac command handler with subcommands:
 * - /aac link - Show dashboard link status
 * - /aac record <player> <type> [label] - Start recording
 * - /aac record stop [player] - Stop recording
 * - /aac record status - Show active recordings
 */
final class BukkitMainCommand implements CommandExecutor, TabCompleter {

    private static final List<String> CHEAT_TYPES = Arrays.asList(
            "killaura", "speed", "fly", "reach", "autoclicker",
            "aimbot", "xray", "scaffold", "bhop", "nofall",
            "antiknockback", "other"
    );

    private final AsyncAnticheatService service;
    private final RecordingManager recordingManager;

    BukkitMainCommand(@NotNull AsyncAnticheatService service, @NotNull RecordingManager recordingManager) {
        this.service = service;
        this.recordingManager = recordingManager;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (args.length == 0) {
            return showStatus(sender);
        }

        final String sub = args[0].toLowerCase();
        switch (sub) {
            case "link", "status" -> {
                return showStatus(sender);
            }
            case "record", "rec" -> {
                return handleRecord(sender, Arrays.copyOfRange(args, 1, args.length));
            }
            case "token" -> {
                return handleToken(sender, Arrays.copyOfRange(args, 1, args.length));
            }
            default -> {
                return showHelp(sender);
            }
        }
    }

    private boolean showStatus(@NotNull CommandSender sender) {
        if (service.isDashboardRegistered()) {
            sender.sendMessage("§a[AsyncAnticheat] §fDashboard: §aregistered");
        } else if (service.isWaitingForDashboardRegistration()) {
            sender.sendMessage("§a[AsyncAnticheat] §fDashboard: §ewaiting for registration");
            sender.sendMessage("§7Link this server: §f" + service.getClaimUrl());
        } else {
            sender.sendMessage("§a[AsyncAnticheat] §fDashboard: §cnot configured");
            sender.sendMessage("§7Link this server: §f" + service.getClaimUrl());
        }
        return true;
    }

    private boolean handleToken(@NotNull CommandSender sender, @NotNull String[] args) {
        if (!sender.hasPermission("asyncanticheat.admin")) {
            sender.sendMessage("§c[AsyncAnticheat] Missing permission: asyncanticheat.admin");
            return true;
        }

        if (args.length == 0) {
            sender.sendMessage("§a[AsyncAnticheat] §fUsage: §f/aac token <token>");
            sender.sendMessage("§7Use this to link to an existing server entry in the dashboard.");
            sender.sendMessage("§7Get the token from your dashboard server settings.");
            return true;
        }

        final String token = args[0];
        if (token.length() < 10) {
            sender.sendMessage("§c[AsyncAnticheat] Token appears invalid (too short). Please check and try again.");
            return true;
        }

        service.updateToken(token);
        sender.sendMessage("§a[AsyncAnticheat] §fToken updated successfully!");
        sender.sendMessage("§7The server will now use the new token for API communication.");
        sender.sendMessage("§7Check status with: §f/aac status");
        return true;
    }

    private boolean handleRecord(@NotNull CommandSender sender, @NotNull String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("§c[AsyncAnticheat] This command must be run by a player.");
            return true;
        }

        if (!player.hasPermission("asyncanticheat.record")) {
            sender.sendMessage("§c[AsyncAnticheat] Missing permission: asyncanticheat.record");
            return true;
        }

        if (args.length == 0) {
            return showRecordHelp(sender);
        }

        final String sub = args[0].toLowerCase();
        switch (sub) {
            case "stop" -> {
                return handleRecordStop(player, Arrays.copyOfRange(args, 1, args.length));
            }
            case "status", "list" -> {
                return handleRecordStatus(player);
            }
            default -> {
                // args[0] is the player name, args[1] is cheat type
                return handleRecordStart(player, args);
            }
        }
    }

    private boolean handleRecordStart(@NotNull Player recorder, @NotNull String[] args) {
        if (args.length < 2) {
            return showRecordHelp(recorder);
        }

        final String targetName = args[0];
        final Player target = Bukkit.getPlayer(targetName);
        if (target == null) {
            recorder.sendMessage("§c[AsyncAnticheat] Player not found: " + targetName);
            return true;
        }

        final String cheatType = args[1].toLowerCase();
        final String label = args.length > 2 ? String.join(" ", Arrays.copyOfRange(args, 2, args.length)) : null;

        if (recordingManager.startRecording(target, recorder, cheatType, label)) {
            // Success message is sent by RecordingManager
        } else {
            recorder.sendMessage("§c[AsyncAnticheat] Already recording " + target.getName() +
                    ". Use §f/aac record stop " + target.getName() + " §cfirst.");
        }
        return true;
    }

    private boolean handleRecordStop(@NotNull Player recorder, @NotNull String[] args) {
        if (args.length == 0) {
            // Stop all recordings by this recorder
            final Map<UUID, RecordingManager.Recording> active = recordingManager.getActiveRecordings();
            int stopped = 0;
            for (Map.Entry<UUID, RecordingManager.Recording> entry : active.entrySet()) {
                if (entry.getValue().recorderUuid.equals(recorder.getUniqueId())) {
                    final Player target = Bukkit.getPlayer(entry.getKey());
                    if (target != null) {
                        recordingManager.stopRecording(target, recorder);
                        stopped++;
                    }
                }
            }
            if (stopped == 0) {
                recorder.sendMessage("§c[AsyncAnticheat] No active recordings to stop.");
            } else {
                recorder.sendMessage("§a[AsyncAnticheat] §fStopped " + stopped + " recording(s).");
            }
            return true;
        }

        final String targetName = args[0];
        final Player target = Bukkit.getPlayer(targetName);
        if (target == null) {
            recorder.sendMessage("§c[AsyncAnticheat] Player not found: " + targetName);
            return true;
        }

        if (recordingManager.stopRecording(target, recorder)) {
            // Success message is sent by RecordingManager
        } else {
            recorder.sendMessage("§c[AsyncAnticheat] Not currently recording " + target.getName());
        }
        return true;
    }

    private boolean handleRecordStatus(@NotNull Player player) {
        final Map<UUID, RecordingManager.Recording> active = recordingManager.getActiveRecordings();
        if (active.isEmpty()) {
            player.sendMessage("§a[AsyncAnticheat] §fNo active recordings.");
            return true;
        }

        player.sendMessage("§a[AsyncAnticheat] §fActive recordings:");
        for (RecordingManager.Recording recording : active.values()) {
            final Duration elapsed = Duration.between(recording.startedAt, Instant.now());
            final String elapsedStr = formatDuration(elapsed);
            player.sendMessage(String.format("  §e%s §7- §c%s §7by §f%s §7(%s)",
                    recording.playerName,
                    recording.cheatType,
                    recording.recorderName,
                    elapsedStr
            ));
        }
        return true;
    }

    private static String formatDuration(Duration duration) {
        final long seconds = duration.getSeconds();
        if (seconds < 60) {
            return seconds + "s";
        } else if (seconds < 3600) {
            return (seconds / 60) + "m " + (seconds % 60) + "s";
        } else {
            return (seconds / 3600) + "h " + ((seconds % 3600) / 60) + "m";
        }
    }

    private boolean showRecordHelp(@NotNull CommandSender sender) {
        sender.sendMessage("§a[AsyncAnticheat] §fRecording commands:");
        sender.sendMessage("  §f/aac record <player> <type> [label] §7- Start recording");
        sender.sendMessage("  §f/aac record stop [player] §7- Stop recording");
        sender.sendMessage("  §f/aac record status §7- Show active recordings");
        sender.sendMessage("§7Cheat types: " + String.join(", ", CHEAT_TYPES));
        return true;
    }

    private boolean showHelp(@NotNull CommandSender sender) {
        sender.sendMessage("§a[AsyncAnticheat] §fCommands:");
        sender.sendMessage("  §f/aac §7- Show dashboard status");
        sender.sendMessage("  §f/aac token <token> §7- Set API token (link to existing server)");
        sender.sendMessage("  §f/aac record <player> <type> [label] §7- Start recording");
        sender.sendMessage("  §f/aac record stop [player] §7- Stop recording");
        sender.sendMessage("  §f/aac record status §7- Show active recordings");
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command,
                                                 @NotNull String alias, @NotNull String[] args) {
        final List<String> completions = new ArrayList<>();

        if (args.length == 1) {
            completions.addAll(Arrays.asList("link", "record", "status", "token"));
            return filter(completions, args[0]);
        }

        if (args.length >= 2 && args[0].equalsIgnoreCase("record")) {
            if (args.length == 2) {
                // /aac record <tab>
                completions.add("stop");
                completions.add("status");
                // Add online player names
                completions.addAll(Bukkit.getOnlinePlayers().stream()
                        .map(Player::getName)
                        .collect(Collectors.toList()));
                return filter(completions, args[1]);
            }

            if (args.length == 3) {
                if (args[1].equalsIgnoreCase("stop")) {
                    // /aac record stop <tab> - show players being recorded
                    completions.addAll(recordingManager.getActiveRecordings().values().stream()
                            .map(r -> r.playerName)
                            .collect(Collectors.toList()));
                } else {
                    // /aac record <player> <tab> - show cheat types
                    completions.addAll(CHEAT_TYPES);
                }
                return filter(completions, args[2]);
            }
        }

        return completions;
    }

    private static List<String> filter(List<String> options, String prefix) {
        return options.stream()
                .filter(s -> s.toLowerCase().startsWith(prefix.toLowerCase()))
                .collect(Collectors.toList());
    }
}

