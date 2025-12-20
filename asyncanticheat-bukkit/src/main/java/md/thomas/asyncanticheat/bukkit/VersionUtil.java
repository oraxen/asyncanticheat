package md.thomas.asyncanticheat.bukkit;

/**
 * Utility class for detecting server version and platform features.
 */
public final class VersionUtil {
    
    private static final boolean IS_FOLIA;

    static {
        boolean folia = false;
        try {
            Class.forName("io.papermc.paper.threadedregions.RegionizedServer");
            folia = true;
        } catch (ClassNotFoundException ignored) {
        }
        IS_FOLIA = folia;
    }

    private VersionUtil() {
        // Utility class
    }

    /**
     * Checks if the server is running Folia.
     * 
     * @return true if running on Folia, false otherwise
     */
    public static boolean isFoliaServer() {
        return IS_FOLIA;
    }
}
