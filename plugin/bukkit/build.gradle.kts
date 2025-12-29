// Bukkit module - Paper/Spigot support

tasks.shadowJar {
    // Relocate Hopper to avoid conflicts with other plugins using it
    relocate("md.thomas.hopper", "md.thomas.asyncanticheat.bukkit.shaded.hopper")
    // Relocate bStats to avoid conflicts with other plugins
    relocate("org.bstats", "md.thomas.asyncanticheat.bukkit.shaded.bstats")
    // NOTE: PacketEvents is no longer shaded - it's downloaded at runtime via Hopper
}

