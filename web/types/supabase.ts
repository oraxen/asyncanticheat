// AsyncAnticheat Dashboard Types

export interface Server {
  id: string;
  name: string;
  api_key?: string;
  callback_url?: string;
  created_at: string;
  updated_at?: string;
}

// Alias for local workspace storage
export type ServerWorkspace = Server;

export interface ServerModule {
  id: string;
  server_id: string;
  name: string;
  base_url: string;
  enabled: boolean;
  transform: string;
  created_at: string;
  updated_at: string;
  last_healthcheck_at?: string;
  last_healthcheck_ok?: boolean;
  consecutive_failures: number;
  last_error?: string;
}

export interface Finding {
  id: string;
  server_id: string;
  player_uuid: string;
  player_name?: string;
  detector: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Player {
  uuid: string;
  username: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface BatchIndex {
  id: string;
  server_id: string;
  session_id: string;
  received_at: string;
  object_key: string;
  payload_bytes: number;
}

export interface HourlyAggregate {
  id: string;
  server_id: string;
  hour: string;
  total_batches: number;
  total_bytes: number;
  total_findings: number;
  findings_by_severity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  unique_players: number;
}

