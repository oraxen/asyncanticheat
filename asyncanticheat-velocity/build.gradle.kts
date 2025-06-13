// Velocity module - Velocity support

tasks.shadowJar {
    relocate("com.github.retrooper.packetevents", "md.thomas.asyncanticheat.velocity.shaded.packetevents.api")
    relocate("io.github.retrooper.packetevents", "md.thomas.asyncanticheat.velocity.shaded.packetevents.impl")
    // Don't use minimize() - it strips classes needed by PacketEvents reflection/service-loading
}



