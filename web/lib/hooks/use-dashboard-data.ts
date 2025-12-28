"use client";

import useSWR, { SWRConfiguration } from "swr";
import {
  api,
  type DashboardStats,
  type Finding,
  type Module,
  type BuiltinModuleInfo,
  type ConnectionMetrics,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

// Default SWR config for dashboard data
// - dedupingInterval: Prevent duplicate requests within 5 seconds
// - revalidateOnFocus: Revalidate when window regains focus
// - revalidateOnReconnect: Revalidate when network reconnects
// - keepPreviousData: Keep showing previous data while revalidating (key for smooth UX)
const defaultConfig: SWRConfiguration = {
  dedupingInterval: 5000,
  revalidateOnFocus: false, // Don't spam API on tab focus
  revalidateOnReconnect: true,
  keepPreviousData: true,
  errorRetryCount: 2,
};

// Helper to create a time-aware cache key that forces revalidation after stale time
// This isn't strictly necessary with SWR but helps ensure we don't serve very stale data
function createCacheKey(base: string, serverId: string | null): string | null {
  if (!serverId) return null;
  return `${base}:${serverId}`;
}

/**
 * Hook for fetching dashboard stats
 * Auto-refreshes every 30 seconds for real-time updates
 */
export function useDashboardStats(serverId: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    createCacheKey("dashboard-stats", serverId),
    async () => {
      if (!serverId) return null;
      return api.getStats(serverId);
    },
    {
      ...defaultConfig,
      refreshInterval: 30000, // Refresh every 30 seconds for real-time stats
    }
  );

  return {
    stats: data as DashboardStats | null,
    error,
    isLoading: isLoading && !data, // Only show loading on first load
    isValidating, // True when revalidating in background
    mutate,
  };
}

/**
 * Hook for fetching connection metrics
 * Auto-refreshes every 10 seconds for real-time connection status
 */
export function useConnectionMetrics(serverId: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    createCacheKey("connection-metrics", serverId),
    async () => {
      if (!serverId) return null;
      return api.getConnectionStatus(serverId);
    },
    {
      ...defaultConfig,
      refreshInterval: 10000, // Refresh every 10 seconds for connection status
    }
  );

  return {
    metrics: data as ConnectionMetrics | null,
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching findings
 * Supports filtering by severity and player
 */
export function useFindings(
  serverId: string | null,
  params?: {
    severity?: string;
    player?: string;
    limit?: number;
  }
) {
  // Create a stable cache key that includes filter params
  const paramsKey = params
    ? `severity=${params.severity || ""}&player=${params.player || ""}&limit=${params.limit || 100}`
    : "";
  const cacheKey = serverId ? `findings:${serverId}:${paramsKey}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    cacheKey,
    async () => {
      if (!serverId) return { findings: [], total: 0 };
      return api.getFindings(serverId, {
        ...params,
        limit: params?.limit || 100,
      });
    },
    {
      ...defaultConfig,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  return {
    findings: (data?.findings || []) as Finding[],
    total: data?.total || 0,
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching players with their stats
 * Uses Supabase directly for player data (matches existing implementation)
 */
interface PlayerWithStats {
  uuid: string;
  name: string;
  first_seen_at: string;
  last_seen_at: string;
  findings_count: number;
  sessions: PlayerSession[];
  highest_severity: "low" | "medium" | "high" | "critical" | null;
  is_online: boolean;
}

interface PlayerSession {
  id: string;
  player_uuid: string;
  player_name: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
}

export function usePlayers(serverId: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    createCacheKey("players", serverId),
    async () => {
      if (!serverId) return [];

      const supabase = createClient();

      // Fetch server_players with player details
      const { data: serverPlayers, error: playersError } = await supabase
        .from("server_players")
        .select("*")
        .eq("server_id", serverId)
        .order("last_seen_at", { ascending: false })
        .limit(100);

      if (playersError) throw playersError;
      if (!serverPlayers || serverPlayers.length === 0) return [];

      // Fetch sessions for these players
      const playerUuids = serverPlayers.map((p) => p.player_uuid);
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("*")
        .eq("server_id", serverId)
        .in("player_uuid", playerUuids)
        .order("started_at", { ascending: false });

      if (sessionsError) throw sessionsError;

      // Fetch findings counts
      const { data: findings, error: findingsError } = await supabase
        .from("findings")
        .select("player_uuid, severity")
        .eq("server_id", serverId)
        .in("player_uuid", playerUuids);

      if (findingsError) throw findingsError;

      // Group sessions by player
      const sessionsByPlayer = new Map<string, PlayerSession[]>();
      sessions?.forEach((s) => {
        if (!s.player_uuid) return;
        const existing = sessionsByPlayer.get(s.player_uuid) ?? [];
        existing.push({
          id: s.id,
          player_uuid: s.player_uuid,
          player_name: "",
          session_id: s.session_id,
          started_at: s.started_at,
          ended_at: s.ended_at,
        });
        sessionsByPlayer.set(s.player_uuid, existing);
      });

      // Count findings and determine severity per player
      const findingsByPlayer = new Map<
        string,
        { count: number; highest: string | null }
      >();
      const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
      findings?.forEach((f) => {
        if (!f.player_uuid) return;
        const existing = findingsByPlayer.get(f.player_uuid) ?? {
          count: 0,
          highest: null,
        };
        existing.count++;
        if (
          f.severity &&
          (!existing.highest ||
            severityRank[f.severity as keyof typeof severityRank] >
              severityRank[existing.highest as keyof typeof severityRank])
        ) {
          existing.highest = f.severity;
        }
        findingsByPlayer.set(f.player_uuid, existing);
      });

      // Check which players are online (last seen within 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      // Build player stats
      const playerStats: PlayerWithStats[] = serverPlayers.map((sp) => {
        const findingsData = findingsByPlayer.get(sp.player_uuid);
        const playerSessions = sessionsByPlayer.get(sp.player_uuid) ?? [];

        // Update session player names
        playerSessions.forEach((s) => {
          s.player_name = sp.player_name;
        });

        return {
          uuid: sp.player_uuid,
          name: sp.player_name,
          first_seen_at: sp.first_seen_at,
          last_seen_at: sp.last_seen_at,
          findings_count: findingsData?.count ?? 0,
          sessions: playerSessions,
          highest_severity:
            (findingsData?.highest as PlayerWithStats["highest_severity"]) ??
            null,
          is_online: new Date(sp.last_seen_at).getTime() > fiveMinutesAgo,
        };
      });

      return playerStats;
    },
    {
      ...defaultConfig,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  return {
    players: (data || []) as PlayerWithStats[],
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching modules
 */
export function useModules(serverId: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    createCacheKey("modules", serverId),
    async () => {
      if (!serverId) return { modules: [], builtinModules: [] };
      return api.getModules(serverId);
    },
    {
      ...defaultConfig,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  return {
    modules: (data?.modules || []) as Module[],
    builtinModules: (data?.builtinModules || []) as BuiltinModuleInfo[],
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching recent findings (for dashboard sidebar)
 * Limited to most recent 20 findings
 */
export function useRecentFindings(serverId: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    createCacheKey("recent-findings", serverId),
    async () => {
      if (!serverId) return [];
      const result = await api.getFindings(serverId, { limit: 20 });
      return result.findings;
    },
    {
      ...defaultConfig,
      refreshInterval: 15000, // Refresh every 15 seconds for recent activity
    }
  );

  return {
    findings: (data || []) as Finding[],
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching false positive reports
 */
export function useFalsePositiveReports(serverId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    createCacheKey("false-positive-reports", serverId),
    async () => {
      if (!serverId) return new Set<string>();
      const supabase = createClient();
      const { data, error } = await supabase
        .from("false_positive_reports")
        .select("finding_id")
        .eq("server_id", serverId);

      if (error) {
        // Propagate error to SWR for proper error handling in UI
        // Don't silently convert to empty data as this masks RLS/permission misconfigurations
        throw new Error(`Failed to fetch false positive reports: ${error.message}`);
      }

      return new Set(data?.map((r) => r.finding_id) || []);
    },
    defaultConfig
  );

  return {
    reportedFindingIds: data || new Set<string>(),
    error,
    isLoading,
    mutate,
    // Helper to add a new report to the local cache
    addReport: (findingId: string) => {
      mutate((current) => {
        const newSet = new Set(current);
        newSet.add(findingId);
        return newSet;
      }, false);
    },
  };
}
