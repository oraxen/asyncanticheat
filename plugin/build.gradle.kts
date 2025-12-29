import java.text.SimpleDateFormat
import java.util.Date

plugins {
    // New maintained Shadow plugin (supports newer Java classfile versions).
    id("com.gradleup.shadow") version "8.3.2"
    id("java")
}

val pluginVersion: String by project

allprojects {
    apply(plugin = "java")
    apply(plugin = "com.gradleup.shadow")

    group = "md.thomas.asyncanticheat"
    version = pluginVersion

    java {
        toolchain {
            // Use JDK 21 toolchain (required to compile against Paper 1.21+ APIs).
            languageVersion.set(JavaLanguageVersion.of(21))
        }
    }

    tasks.withType<JavaCompile>().configureEach {
        options.encoding = "UTF-8"
        // Require Java 21 bytecode across all platforms.
        options.release.set(21)
    }

    tasks.processResources {
        expand(mapOf("version" to pluginVersion))
    }

    repositories {
        mavenLocal()
        mavenCentral()
        // Paper/Spigot
        maven { url = uri("https://repo.papermc.io/repository/maven-public/") }
        maven { url = uri("https://hub.spigotmc.org/nexus/content/repositories/snapshots/") }
        maven { url = uri("https://oss.sonatype.org/content/repositories/snapshots") }
        // Velocity
        // PacketEvents + bStats
        maven { url = uri("https://repo.codemc.io/repository/maven-releases/") }
        maven { url = uri("https://repo.codemc.io/repository/maven-snapshots/") }
        // Hopper (runtime dependency downloader)
        maven { url = uri("https://repo.oraxen.com/releases") }
    }
}

project(":core") {
    dependencies {
        implementation("com.google.code.gson:gson:2.10.1")
        implementation("org.yaml:snakeyaml:2.2")
        compileOnly("org.jetbrains:annotations:24.0.1")
    }
}

project(":bukkit") {
    dependencies {
        compileOnly("io.papermc.paper:paper-api:1.21.1-R0.1-SNAPSHOT")
        compileOnly("org.jetbrains:annotations:24.0.1")
        implementation(project(path = ":core", configuration = "shadow"))

        // PacketEvents (compileOnly - downloaded at runtime via Hopper)
        compileOnly("com.github.retrooper:packetevents-spigot:2.7.0")

        // Hopper - runtime dependency downloader (paper module includes bukkit)
        implementation("md.thomas.hopper:hopper-paper:1.4.1")
    }
}


tasks.shadowJar {
    // Keep dependencies isolated from the server/proxy classpath where possible.
    relocate("org.yaml.snakeyaml", "md.thomas.asyncanticheat.shaded.snakeyaml")
    relocate("com.google.gson", "md.thomas.asyncanticheat.shaded.gson")

    manifest {
        attributes(
            "Built-By" to System.getProperty("user.name"),
            "Version" to pluginVersion,
            "Build-Timestamp" to SimpleDateFormat("yyyy-MM-dd' 'HH:mm:ss.SSSZ").format(Date()),
            "Created-By" to "Gradle ${gradle.gradleVersion}",
            "Build-Jdk" to "${System.getProperty("java.version")} (${System.getProperty("java.vendor")} ${System.getProperty("java.vm.version")})",
            "Build-OS" to "${System.getProperty("os.name")} ${System.getProperty("os.arch")} ${System.getProperty("os.version")}"
        )
    }
    archiveFileName.set("async-anticheat-${pluginVersion}.jar")
}

dependencies {
    implementation(project(path = ":core", configuration = "shadow"))
    implementation(project(path = ":bukkit", configuration = "shadow"))
}

tasks.build {
    dependsOn(tasks.shadowJar)
}


