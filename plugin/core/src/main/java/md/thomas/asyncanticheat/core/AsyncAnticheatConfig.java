package md.thomas.asyncanticheat.core;

import org.jetbrains.annotations.NotNull;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.Writer;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class AsyncAnticheatConfig {

    private static final String DEFAULT_API_URL = "https://api.asyncanticheat.com";
    private static final String DEFAULT_DASHBOARD_URL = "https://asyncanticheat.com";
    private static final int DEFAULT_TIMEOUT_SECONDS = 10;
    private static final int DEFAULT_FLUSH_INTERVAL_MS = 1_000;
    private static final int DEFAULT_SPOOL_MAX_MB = 256;
    private static final double DEFAULT_SAMPLE_RATE = 1.0;

    private String apiUrl = DEFAULT_API_URL;
    private String apiToken = "";
    private int timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;

    // Dashboard linking
    private String dashboardUrl = DEFAULT_DASHBOARD_URL;

    private String spoolDirName = "spool";
    private int spoolMaxMb = DEFAULT_SPOOL_MAX_MB;
    private int flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS;
    private String dropPolicy = "drop_oldest"; // drop_oldest | drop_newest

    private List<String> enabledPackets = List.of();  // empty => allow all (subject to disabled)
    private List<String> disabledPackets = List.of();
    private double sampleRate = DEFAULT_SAMPLE_RATE;

    private boolean redactChat = true;

    // Dev mode (labeled data capture helpers)
    private boolean devModeEnabled = false;
    private int devDefaultDurationSeconds = 60;
    private int devDefaultWarmupSeconds = 3;
    private int devDefaultToggleSeconds = 10;
    
    // Player exemptions (based on NoCheatPlus patterns)
    private ExemptionConfig exemptionConfig = new ExemptionConfig();

    @NotNull
    public static AsyncAnticheatConfig load(@NotNull File dataFolder, @NotNull AcLogger logger) {
        if (!dataFolder.exists() && !dataFolder.mkdirs()) {
            logger.warn("[AsyncAnticheat] Failed to create data folder: " + dataFolder.getAbsolutePath());
        }

        final File configFile = new File(dataFolder, "config.yml");
        final AsyncAnticheatConfig config = new AsyncAnticheatConfig();
        if (!configFile.exists()) {
            // Generate a per-server secret token on first install.
            config.apiToken = generateToken();
            config.save(configFile, logger);
            return config;
        }

        try (InputStream input = new FileInputStream(configFile)) {
            final Yaml yaml = new Yaml();
            final Map<String, Object> data = yaml.load(input);
            if (data != null) {
                config.loadFromMap(data, logger);
            }
        } catch (Exception e) {
            logger.error("[AsyncAnticheat] Failed to load config.yml", e);
        }

        // If the user deleted the token (or an old config had none), regenerate once and persist.
        if (config.apiToken == null || config.apiToken.isBlank()) {
            config.apiToken = generateToken();
            logger.warn("[AsyncAnticheat] api.token was empty; generated a new token and saved config.yml. You must re-link this server on the dashboard.");
            config.save(configFile, logger);
        }
        return config;
    }

    @SuppressWarnings("unchecked")
    private void loadFromMap(@NotNull Map<String, Object> data, @NotNull AcLogger logger) {
        final Map<String, Object> api = (Map<String, Object>) data.get("api");
        if (api != null) {
            apiUrl = getString(api, "url", apiUrl);
            apiToken = getString(api, "token", apiToken);
            timeoutSeconds = getInt(api, "timeout_seconds", timeoutSeconds);
        }

        final Map<String, Object> dashboard = (Map<String, Object>) data.get("dashboard");
        if (dashboard != null) {
            dashboardUrl = getString(dashboard, "url", dashboardUrl);
        }

        final Map<String, Object> spool = (Map<String, Object>) data.get("spool");
        if (spool != null) {
            spoolDirName = getString(spool, "dir", spoolDirName);
            spoolMaxMb = getInt(spool, "max_mb", spoolMaxMb);
            flushIntervalMs = getInt(spool, "flush_interval_ms", flushIntervalMs);
            dropPolicy = getString(spool, "drop_policy", dropPolicy);
        }

        final Map<String, Object> capture = (Map<String, Object>) data.get("capture");
        if (capture != null) {
            enabledPackets = getStringList(capture, "enabled_packets", enabledPackets);
            disabledPackets = getStringList(capture, "disabled_packets", disabledPackets);
            sampleRate = getDouble(capture, "sample_rate", sampleRate);
        }

        final Map<String, Object> privacy = (Map<String, Object>) data.get("privacy");
        if (privacy != null) {
            redactChat = getBoolean(privacy, "redact_chat", redactChat);
        }

        final Map<String, Object> dev = (Map<String, Object>) data.get("dev");
        if (dev != null) {
            devModeEnabled = getBoolean(dev, "enabled", devModeEnabled);
            devDefaultDurationSeconds = getInt(dev, "default_duration_seconds", devDefaultDurationSeconds);
            devDefaultWarmupSeconds = getInt(dev, "default_warmup_seconds", devDefaultWarmupSeconds);
            devDefaultToggleSeconds = getInt(dev, "default_toggle_seconds", devDefaultToggleSeconds);
        }
        
        // Load exemption config (based on NoCheatPlus patterns)
        final Map<String, Object> exemptions = (Map<String, Object>) data.get("exemptions");
        if (exemptions != null) {
            exemptionConfig.loadFromMap(exemptions);
        }

        if (sampleRate < 0.0 || sampleRate > 1.0) {
            logger.warn("[AsyncAnticheat] capture.sample_rate out of range (0..1), clamping: " + sampleRate);
            sampleRate = Math.max(0.0, Math.min(1.0, sampleRate));
        }
    }

    public void save(@NotNull File configFile, @NotNull AcLogger logger) {
        final Map<String, Object> root = new LinkedHashMap<>();

        final Map<String, Object> api = new LinkedHashMap<>();
        api.put("url", apiUrl);
        api.put("token", apiToken);
        api.put("timeout_seconds", timeoutSeconds);
        root.put("api", api);

        final Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("url", dashboardUrl);
        // Convenience: a copy/paste link (contains the secret token in the query string).
        // Treat it like a password.
        final String dashBase = dashboardUrl.trim().endsWith("/")
                ? dashboardUrl.trim().substring(0, dashboardUrl.trim().length() - 1)
                : dashboardUrl.trim();
        dashboard.put("link", dashBase + "/register-server?token=" + (apiToken == null ? "" : apiToken));
        root.put("dashboard", dashboard);

        final Map<String, Object> spool = new LinkedHashMap<>();
        spool.put("dir", spoolDirName);
        spool.put("max_mb", spoolMaxMb);
        spool.put("flush_interval_ms", flushIntervalMs);
        spool.put("drop_policy", dropPolicy);
        root.put("spool", spool);

        final Map<String, Object> capture = new LinkedHashMap<>();
        capture.put("enabled_packets", enabledPackets);
        capture.put("disabled_packets", disabledPackets);
        capture.put("sample_rate", sampleRate);
        root.put("capture", capture);

        final Map<String, Object> privacy = new LinkedHashMap<>();
        privacy.put("redact_chat", redactChat);
        root.put("privacy", privacy);

        final Map<String, Object> dev = new LinkedHashMap<>();
        dev.put("enabled", devModeEnabled);
        dev.put("default_duration_seconds", devDefaultDurationSeconds);
        dev.put("default_warmup_seconds", devDefaultWarmupSeconds);
        dev.put("default_toggle_seconds", devDefaultToggleSeconds);
        root.put("dev", dev);
        
        // Exemption settings (based on NoCheatPlus patterns)
        // These control when players are excluded from packet capture
        root.put("exemptions", exemptionConfig.toMap());

        try {
            if (!configFile.exists()) {
                final File parent = configFile.getParentFile();
                if (parent != null) {
                    parent.mkdirs();
                }
                configFile.createNewFile();
            }

            final DumperOptions options = new DumperOptions();
            options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
            options.setPrettyFlow(true);
            options.setIndent(2);
            options.setWidth(140);

            final Yaml yaml = new Yaml(options);
            try (Writer writer = new FileWriter(configFile)) {
                yaml.dump(root, writer);
            }
        } catch (Exception e) {
            logger.error("[AsyncAnticheat] Failed to save config.yml", e);
        }
    }

    private static String getString(Map<String, Object> map, String key, String def) {
        Object value = map.get(key);
        return value != null ? value.toString() : def;
    }

    private static int getInt(Map<String, Object> map, String key, int def) {
        Object value = map.get(key);
        if (value instanceof Number n) return n.intValue();
        try {
            return value == null ? def : Integer.parseInt(value.toString());
        } catch (Exception ignored) {
            return def;
        }
    }

    private static double getDouble(Map<String, Object> map, String key, double def) {
        Object value = map.get(key);
        if (value instanceof Number n) return n.doubleValue();
        try {
            return value == null ? def : Double.parseDouble(value.toString());
        } catch (Exception ignored) {
            return def;
        }
    }

    private static boolean getBoolean(Map<String, Object> map, String key, boolean def) {
        Object value = map.get(key);
        if (value instanceof Boolean b) return b;
        if (value == null) return def;
        return Boolean.parseBoolean(value.toString());
    }

    private static List<String> getStringList(Map<String, Object> map, String key, List<String> def) {
        Object value = map.get(key);
        if (value instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        if (value instanceof String s) {
            return List.of(s);
        }
        return def;
    }

    @NotNull public String getApiUrl() { return apiUrl; }
    @NotNull public String getApiToken() { return apiToken; }
    public int getTimeoutSeconds() { return timeoutSeconds; }
    @NotNull public String getDashboardUrl() { return dashboardUrl; }

    @NotNull public String getSpoolDirName() { return spoolDirName; }
    public int getSpoolMaxMb() { return spoolMaxMb; }
    public int getFlushIntervalMs() { return flushIntervalMs; }
    @NotNull public String getDropPolicy() { return dropPolicy; }

    @NotNull public List<String> getEnabledPackets() { return enabledPackets; }
    @NotNull public List<String> getDisabledPackets() { return disabledPackets; }
    public double getSampleRate() { return sampleRate; }

    public boolean isRedactChat() { return redactChat; }

    public boolean isDevModeEnabled() { return devModeEnabled; }
    public int getDevDefaultDurationSeconds() { return devDefaultDurationSeconds; }
    public int getDevDefaultWarmupSeconds() { return devDefaultWarmupSeconds; }
    public int getDevDefaultToggleSeconds() { return devDefaultToggleSeconds; }

    @NotNull public ExemptionConfig getExemptionConfig() { return exemptionConfig; }

    /**
     * Updates the API token. Call {@link #save(File, AcLogger)} afterwards to persist.
     */
    public void setApiToken(@NotNull String token) {
        this.apiToken = token;
    }

    @NotNull
    private static String generateToken() {
        // 32 bytes => 256-bit random token, URL-safe, no padding.
        final byte[] buf = new byte[32];
        new SecureRandom().nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}


