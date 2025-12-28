package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;

import java.util.Locale;

/**
 * Conservative default packet allow-list meant to match NoCheatPlus-relevant signal without flooding bandwidth.
 *
 * This uses name-based heuristics (string contains) because PacketEvents' {@code PacketType} names differ across
 * protocol versions and platforms.
 */
final class DefaultPacketAllowList {
    private DefaultPacketAllowList() {}

    static boolean matches(@NotNull String packetTypeString) {
        final String s = packetTypeString.toUpperCase(Locale.ROOT);

        // Synthetic packets (always allow)
        if (s.equals("PLAYER_STATE")) {
            return true;
        }

        // Movement / sync
        if (containsAny(s,
                "POSITION",
                "ROTATION",
                "LOOK",
                "FLYING",
                "ABILIT",
                "KEEP_ALIVE",
                "PING",
                "PONG",
                "TELEPORT",
                "CONFIRM",
                // Entity sync needed for reach/direction-style checks in async modules.
                "SPAWN_",
                "DESTROY_ENTITIES",
                "ENTITY_TELEPORT",
                "ENTITY_RELATIVE_MOVE",
                "ENTITY_RELATIVE_MOVE_AND_ROTATION",
                "ENTITY_POSITION_SYNC"
        )) {
            return true;
        }

        // Combat
        if (containsAny(s,
                "USE_ENTITY",
                "INTERACT_ENTITY",
                "ENTITY_ACTION",
                "ARM_ANIMATION",
                "SWING"
        )) {
            return true;
        }

        // Blocks / digging / placing / using items
        if (containsAny(s,
                "PLAYER_DIGGING",
                "BLOCK_DIG",
                "BLOCK_PLACE",
                "USE_ITEM",
                "USE_ITEM_ON",
                "INTERACT_BLOCK"
        )) {
            return true;
        }

        // Inventory
        if (containsAny(s,
                "WINDOW_CLICK",
                "CLICK_WINDOW",
                "CLOSE_WINDOW",
                "HELD_ITEM_SLOT",
                "SET_CREATIVE_SLOT"
        )) {
            return true;
        }

        return false;
    }

    private static boolean containsAny(String s, String... needles) {
        for (String n : needles) {
            if (s.contains(n)) return true;
        }
        return false;
    }
}


