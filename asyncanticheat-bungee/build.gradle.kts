// Bungee module - BungeeCord support

tasks.shadowJar {
    relocate("com.github.retrooper.packetevents", "md.thomas.asyncanticheat.bungee.shaded.packetevents.api")
    relocate("io.github.retrooper.packetevents", "md.thomas.asyncanticheat.bungee.shaded.packetevents.impl")
    // NOTE: Do NOT use minimize() with PacketEvents - it strips classes used via reflection/service-loading
    // and causes runtime ClassNotFoundException during packet injection
}



