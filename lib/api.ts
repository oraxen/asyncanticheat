// AsyncAntiCheat API Client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

// Types
export interface DashboardStats {
  total_findings: number;
  active_modules: number;
  players_monitored: number;
  findings_today: number;
}

export interface Finding {
  id: string;
  player_uuid: string | null;
  player_name: string | null;
  detector_name: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string | null;
  // When the backend aggregates spammy detectors, multiple triggers within a minute
  // collapse into one row and this indicates how many times it fired.
  occurrences?: number;
  created_at: string;
}

export interface Player {
  uuid: string;
  username: string;
  findings_count: number;
  highest_severity: string;
  last_seen: string;
  detectors: string[];
}

export interface ActivePlayer {
  uuid: string;
  username: string;
  last_seen: string;
}

export interface Module {
  id: string;
  name: string;
  base_url: string;
  enabled: boolean;
  healthy: boolean;
  last_error: string | null;
  detections: number;
}

export interface Server {
  id: string;
  name: string | null;
  platform: string | null;
  last_seen_at: string;
}

export interface ConnectionStatus {
  plugin_last_seen_ms: number;
  plugin_online: boolean;
  server_ping_ms: number | null;
  server_reachable: boolean;
  server_address: string | null;
}

export interface ConnectionMetrics {
  // API latency (measured from dashboard)
  apiLatencyMs: number;
  // Plugin heartbeat info (from API)
  pluginLastSeenMs: number;
  pluginOnline: boolean;
  // Server TCP ping (from API to MC server)
  serverPingMs: number | null;
  serverReachable: boolean;
  serverAddress: string | null;
}

// API Response types
interface StatsResponse {
  ok: boolean;
  stats: DashboardStats;
}

interface FindingsResponse {
  ok: boolean;
  findings: Finding[];
  total: number;
}

interface PlayersResponse {
  ok: boolean;
  players: Player[];
  active_players: ActivePlayer[];
}

interface ModulesResponse {
  ok: boolean;
  modules: Module[];
}

interface StatusResponse {
  ok: boolean;
  status: ConnectionStatus;
}

// Mock data for demo mode
const MOCK_PLAYERS: Player[] = [
  { uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", username: "xX_Hacker_Xx", findings_count: 23, highest_severity: "critical", last_seen: new Date(Date.now() - 30 * 60000).toISOString(), detectors: ["fight_speed", "fight_reach", "fight_angle"] },
  { uuid: "b2c3d4e5-f6a7-8901-bcde-f12345678901", username: "SuspiciousPlayer", findings_count: 8, highest_severity: "high", last_seen: new Date(Date.now() - 35 * 60000).toISOString(), detectors: ["moving_speed", "fight_speed"] },
  { uuid: "c3d4e5f6-a7b8-9012-cdef-123456789012", username: "TestUser123", findings_count: 15, highest_severity: "high", last_seen: new Date(Date.now() - 38 * 60000).toISOString(), detectors: ["fight_reach", "moving_nofall"] },
  { uuid: "d4e5f6a7-b8c9-0123-def0-234567890123", username: "CoolGamer", findings_count: 3, highest_severity: "low", last_seen: new Date(Date.now() - 42 * 60000).toISOString(), detectors: ["moving_nofall"] },
];

const MOCK_FINDINGS: Finding[] = [
  { id: "1", player_uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", player_name: "xX_Hacker_Xx", detector_name: "fight_speed", severity: "high", title: "18.5 APS", description: "Attack speed exceeds normal limits", created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: "2", player_uuid: "b2c3d4e5-f6a7-8901-bcde-f12345678901", player_name: "SuspiciousPlayer", detector_name: "moving_speed", severity: "medium", title: "15.2 b/s", description: "Movement speed above threshold", created_at: new Date(Date.now() - 35 * 60000).toISOString() },
  { id: "3", player_uuid: "c3d4e5f6-a7b8-9012-cdef-123456789012", player_name: "TestUser123", detector_name: "fight_reach", severity: "high", title: "4.8 blocks", description: "Combat reach extended", created_at: new Date(Date.now() - 38 * 60000).toISOString() },
  { id: "4", player_uuid: "d4e5f6a7-b8c9-0123-def0-234567890123", player_name: "CoolGamer", detector_name: "moving_nofall", severity: "low", title: "No fall damage", description: "Player took no fall damage", created_at: new Date(Date.now() - 42 * 60000).toISOString() },
  { id: "5", player_uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", player_name: "xX_Hacker_Xx", detector_name: "fight_reach", severity: "critical", title: "6.2 blocks", description: "Extreme combat reach", created_at: new Date(Date.now() - 48 * 60000).toISOString() },
  { id: "6", player_uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", player_name: "xX_Hacker_Xx", detector_name: "fight_angle", severity: "high", title: "87° rotation", description: "Impossible head rotation", created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "7", player_uuid: "b2c3d4e5-f6a7-8901-bcde-f12345678901", player_name: "SuspiciousPlayer", detector_name: "fight_speed", severity: "high", title: "16.2 APS", description: "Auto-clicker pattern detected", created_at: new Date(Date.now() - 2.75 * 3600000).toISOString() },
  { id: "8", player_uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", player_name: "xX_Hacker_Xx", detector_name: "fight_speed", severity: "critical", title: "22.1 APS", description: "Extreme attack speed", created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
];

const MOCK_MODULES: Module[] = [
  { id: "1", name: "NCP Core", base_url: "http://127.0.0.1:4010", enabled: true, healthy: true, last_error: null, detections: 847 },
  { id: "2", name: "Demo Module", base_url: "http://127.0.0.1:4011", enabled: true, healthy: true, last_error: null, detections: 156 },
  { id: "3", name: "Inventory Guard", base_url: "http://127.0.0.1:4012", enabled: false, healthy: true, last_error: null, detections: 234 },
];

const MOCK_STATS: DashboardStats = {
  total_findings: 1247,
  active_modules: 2,
  players_monitored: 4,
  findings_today: 12,
};

// API Client
class ApiClient {
  private baseUrl: string;
  private useMockData: boolean = false;
  private lastApiLatencyMs: number = 0;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const start = performance.now();
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      this.lastApiLatencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.useMockData = false;
      return data;
    } catch (error) {
      this.lastApiLatencyMs = Math.round(performance.now() - start);
      // Fall back to mock data if API is unavailable
      console.warn("API unavailable, using mock data:", error);
      this.useMockData = true;
      throw error;
    }
  }

  // Get the last API request latency
  getLastApiLatency(): number {
    return this.lastApiLatencyMs;
  }

  // Get all servers
  async getServers(): Promise<Server[]> {
    try {
      // Servers are fetched via Next.js (server-side auth) so we only return servers linked to the current user.
      const res = await fetch("/api/servers", {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { ok: boolean; servers: Server[] };
      if (!json.ok) {
        throw new Error("failed_to_load_servers");
      }
      return json.servers ?? [];
    } catch {
      return [];
    }
  }

  // Get dashboard stats for a server
  async getStats(serverId: string): Promise<DashboardStats> {
    try {
      const response = await this.fetch<StatsResponse>(
        `/dashboard/${serverId}/stats`
      );
      return response.stats;
    } catch {
      return MOCK_STATS;
    }
  }

  // Get findings for a server
  async getFindings(
    serverId: string,
    params?: {
      severity?: string;
      player?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ findings: Finding[]; total: number }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.severity) searchParams.set("severity", params.severity);
      if (params?.player) searchParams.set("player", params.player);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());

      const query = searchParams.toString();
      const path = `/dashboard/${serverId}/findings${query ? `?${query}` : ""}`;

      const response = await this.fetch<FindingsResponse>(path);
      return { findings: response.findings, total: response.total };
    } catch {
      let findings = MOCK_FINDINGS;
      if (params?.severity) {
        findings = findings.filter(f => f.severity === params.severity);
      }
      if (params?.player) {
        const wanted = params.player.toLowerCase();
        findings = findings.filter(f => (f.player_name || "Unknown").toLowerCase() === wanted);
      }
      return { findings, total: findings.length };
    }
  }

  // Get players for a server
  async getPlayers(
    serverId: string
  ): Promise<{ players: Player[]; activePlayers: ActivePlayer[] }> {
    try {
      const response = await this.fetch<PlayersResponse>(
        `/dashboard/${serverId}/players`
      );
      return {
        players: response.players,
        activePlayers: response.active_players || [],
      };
    } catch {
      return { players: MOCK_PLAYERS, activePlayers: [] };
    }
  }

  // Get modules for a server
  async getModules(serverId: string): Promise<Module[]> {
    try {
      const response = await this.fetch<ModulesResponse>(
        `/dashboard/${serverId}/modules`
      );
      return response.modules;
    } catch {
      return MOCK_MODULES;
    }
  }

  // Toggle module enabled state
  async toggleModule(
    serverId: string,
    moduleId: string,
    enabled: boolean
  ): Promise<void> {
    try {
      await this.fetch(`/dashboard/${serverId}/modules/${moduleId}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
    } catch {
      // In mock mode, just log the toggle
      console.log(`Mock toggle: ${moduleId} -> ${enabled}`);
    }
  }

  // Get connection status and metrics
  async getConnectionStatus(serverId: string): Promise<ConnectionMetrics> {
    try {
      const response = await this.fetch<StatusResponse>(
        `/dashboard/${serverId}/status`
      );
      return {
        apiLatencyMs: this.lastApiLatencyMs,
        pluginLastSeenMs: response.status.plugin_last_seen_ms,
        pluginOnline: response.status.plugin_online,
        serverPingMs: response.status.server_ping_ms,
        serverReachable: response.status.server_reachable,
        serverAddress: response.status.server_address,
      };
    } catch {
      // Return mock data when API unavailable
      return {
        apiLatencyMs: this.lastApiLatencyMs || -1,
        pluginLastSeenMs: -1,
        pluginOnline: false,
        serverPingMs: null,
        serverReachable: false,
        serverAddress: null,
      };
    }
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for custom instances
export { ApiClient };

