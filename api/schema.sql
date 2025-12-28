-- async_anticheat_api schema
-- Philosophy: raw packet data lives in S3, Postgres holds only metadata/indexes/findings.

create extension if not exists pgcrypto;

--------------------------------------------------------------------------------
-- SERVERS: registered Minecraft servers sending data
--------------------------------------------------------------------------------
create table if not exists public.servers (
    id text primary key,                       -- server_id from plugin config
    name text,                                 -- human-friendly name (optional)
    platform text,                             -- bukkit, bungee, velocity
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

alter table public.servers
    add column if not exists callback_url text;

-- Registration / ownership (dashboard linking)
-- The plugin generates a per-server secret token and sends it as Bearer auth.
-- We store only a SHA-256 hash so the raw token never needs to live in the DB.
alter table public.servers
    add column if not exists auth_token_hash text;

alter table public.servers
    add column if not exists auth_token_first_seen_at timestamptz;

-- Supabase auth.users.id (UUID). Null means "not linked to any account yet".
alter table public.servers
    add column if not exists owner_user_id uuid;

-- Set when a server is linked to an account.
alter table public.servers
    add column if not exists registered_at timestamptz;

-- Webhook settings for real-time Discord/Slack/HTTP notifications
alter table public.servers
    add column if not exists webhook_url text;

alter table public.servers
    add column if not exists webhook_enabled boolean not null default false;

-- Array of severity levels to notify on: ['critical', 'high', 'medium', 'low']
alter table public.servers
    add column if not exists webhook_severity_levels text[] not null default array['critical', 'high']::text[];

--------------------------------------------------------------------------------
-- PLAYERS: unique player identities (by UUID)
--------------------------------------------------------------------------------
create table if not exists public.players (
    uuid uuid primary key,
    username text not null,                    -- last known username
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

create index if not exists idx_players_username on public.players (username);

--------------------------------------------------------------------------------
-- SERVER_PLAYERS: per-server last-seen tracking (for "active players" UI)
--------------------------------------------------------------------------------
create table if not exists public.server_players (
    server_id text not null references public.servers(id) on delete cascade,
    player_uuid uuid not null references public.players(uuid) on delete cascade,
    player_name text not null,                 -- last known username on this server
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    primary key (server_id, player_uuid)
);

create index if not exists idx_server_players_server_last_seen
    on public.server_players (server_id, last_seen_at desc);

--------------------------------------------------------------------------------
-- SESSIONS: a player's connection session on a server
--------------------------------------------------------------------------------
create table if not exists public.sessions (
    id uuid primary key default gen_random_uuid(),
    server_id text not null references public.servers(id),
    player_uuid uuid references public.players(uuid), -- nullable until identified
    session_id text not null,                  -- plugin-generated session token
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    unique (server_id, session_id)
);

create index if not exists idx_sessions_server on public.sessions (server_id, started_at desc);
create index if not exists idx_sessions_player on public.sessions (player_uuid, started_at desc);

--------------------------------------------------------------------------------
-- BATCH_INDEX: pointer to each uploaded batch stored in S3
--------------------------------------------------------------------------------
create table if not exists public.batch_index (
    id uuid primary key default gen_random_uuid(),
    received_at timestamptz not null default now(),
    server_id text not null references public.servers(id),
    session_id text not null,                  -- matches sessions.session_id
    s3_key text not null,                      -- object key in bucket
    payload_bytes int not null,                -- original compressed size
    event_count int,                           -- number of packet records (optional)
    min_ts bigint,                             -- earliest timestamp_ms in batch
    max_ts bigint                              -- latest timestamp_ms in batch
);

--------------------------------------------------------------------------------
-- SERVER_MODULES: per-server module subscriptions (HTTP fanout targets)
--------------------------------------------------------------------------------
create table if not exists public.server_modules (
    id uuid primary key default gen_random_uuid(),
    server_id text not null references public.servers(id) on delete cascade,
    name text not null,                         -- module name (unique per server)
    base_url text not null,                     -- e.g. http://127.0.0.1:4010
    enabled boolean not null default true,
    transform text not null default 'raw_ndjson_gz',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_healthcheck_at timestamptz,
    last_healthcheck_ok boolean,
    consecutive_failures int not null default 0,
    last_error text,
    unique (server_id, name)
);

create index if not exists idx_server_modules_server
    on public.server_modules (server_id, enabled);

--------------------------------------------------------------------------------
-- MODULE_DISPATCHES: audit/debugging for fanout attempts
--------------------------------------------------------------------------------
create table if not exists public.module_dispatches (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    batch_id uuid not null references public.batch_index(id) on delete cascade,
    server_id text not null references public.servers(id) on delete cascade,
    module_id uuid not null references public.server_modules(id) on delete cascade,
    status text not null,                       -- sent | failed
    http_status int,
    error text
);

create index if not exists idx_module_dispatches_batch
    on public.module_dispatches (batch_id, created_at desc);

create index if not exists idx_batch_index_server_time
    on public.batch_index (server_id, received_at desc);
create index if not exists idx_batch_index_session
    on public.batch_index (session_id, received_at desc);

--------------------------------------------------------------------------------
-- FINDINGS: detections/alerts produced by processors
--------------------------------------------------------------------------------
create table if not exists public.findings (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    server_id text not null references public.servers(id),
    player_uuid uuid references public.players(uuid),
    session_id text,
    detector_name text not null,               -- e.g. "speed_check", "killaura_ml"
    detector_version text,
    severity text not null default 'info',     -- info, warning, violation, ban
    title text not null,
    description text,
    evidence_s3_key text,                      -- optional link to relevant batch
    evidence_json jsonb,                       -- optional structured evidence
    -- Aggregation fields: we store one row per minute bucket per detector, and increment occurrences.
    occurrences integer not null default 1,
    window_start_at timestamptz not null default date_trunc('minute', now()),
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by text,
    status text not null default 'open'        -- open, confirmed, dismissed
);

create index if not exists idx_findings_server on public.findings (server_id, created_at desc);
create index if not exists idx_findings_player on public.findings (player_uuid, created_at desc);
create index if not exists idx_findings_status on public.findings (status, created_at desc);
create index if not exists idx_findings_server_last_seen on public.findings (server_id, last_seen_at desc);
create index if not exists idx_findings_player_last_seen on public.findings (player_uuid, last_seen_at desc);
create unique index if not exists uq_findings_agg_minute
    on public.findings (server_id, player_uuid, detector_name, window_start_at)
    where player_uuid is not null;

--------------------------------------------------------------------------------
-- DETECTOR_CONFIGS: per-server processor/detector settings
--------------------------------------------------------------------------------
create table if not exists public.detector_configs (
    id uuid primary key default gen_random_uuid(),
    server_id text not null references public.servers(id),
    detector_name text not null,
    enabled boolean not null default true,
    config_json jsonb not null default '{}',
    updated_at timestamptz not null default now(),
    unique (server_id, detector_name)
);

--------------------------------------------------------------------------------
-- AGGREGATES: pre-computed metrics for dashboards
--------------------------------------------------------------------------------
create table if not exists public.aggregates_hourly (
    id uuid primary key default gen_random_uuid(),
    server_id text not null references public.servers(id),
    hour timestamptz not null,                 -- truncated to hour
    packets_received bigint not null default 0,
    bytes_received bigint not null default 0,
    unique_players int not null default 0,
    findings_count int not null default 0,
    unique (server_id, hour)
);

create index if not exists idx_aggregates_hourly_server
    on public.aggregates_hourly (server_id, hour desc);

--------------------------------------------------------------------------------
-- MODULE_PLAYER_STATE: persistent per-player state for modules
--------------------------------------------------------------------------------
-- This enables NCP-style checks that need to track violation levels,
-- attack history, movement patterns, etc. across batch boundaries.
--
-- Each module can store arbitrary JSON state per player per server.
-- Modules are responsible for reading/updating their own state via callbacks.
--------------------------------------------------------------------------------
create table if not exists public.module_player_state (
    id uuid primary key default gen_random_uuid(),
    server_id text not null references public.servers(id) on delete cascade,
    player_uuid uuid not null references public.players(uuid) on delete cascade,
    module_name text not null,                 -- e.g. "angle_check", "speed_check"
    state_json jsonb not null default '{}',    -- arbitrary module-specific state
    updated_at timestamptz not null default now(),
    unique (server_id, player_uuid, module_name)
);

create index if not exists idx_module_player_state_lookup
    on public.module_player_state (server_id, module_name, player_uuid);

-- Example state_json for an angle check module:
-- {
--   "vl": 15.5,                    -- violation level
--   "last_attack_ts": 1702500000,  -- timestamp of last attack
--   "last_yaw": 45.2,              -- yaw at last attack
--   "last_target_id": 12345,       -- entity ID of last target
--   "recent_attacks": [            -- sliding window of recent attacks
--     {"ts": 1702499900, "yaw_diff": 30.5, "target_switched": true},
--     ...
--   ]
-- }

--------------------------------------------------------------------------------
-- MODULE_GLOBAL_STATE: persistent global state for modules (non-player-specific)
--------------------------------------------------------------------------------
create table if not exists public.module_global_state (
    id uuid primary key default gen_random_uuid(),
    server_id text not null references public.servers(id) on delete cascade,
    module_name text not null,
    state_json jsonb not null default '{}',
    updated_at timestamptz not null default now(),
    unique (server_id, module_name)
);

create index if not exists idx_module_global_state_lookup
    on public.module_global_state (server_id, module_name);

--------------------------------------------------------------------------------
-- FALSE_POSITIVE_REPORTS: user reports for findings marked as false positives
--------------------------------------------------------------------------------
create table if not exists public.false_positive_reports (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    finding_id uuid not null references public.findings(id) on delete cascade,
    server_id text not null references public.servers(id) on delete cascade,
    reporter_user_id uuid,                       -- auth.users.id (nullable if anonymous)
    player_activity text,                        -- what was the player doing
    suspected_cause text,                        -- suspected cause of false positive
    additional_context text                      -- any other info
);

create index if not exists idx_false_positive_reports_finding
    on public.false_positive_reports (finding_id);

create index if not exists idx_false_positive_reports_server
    on public.false_positive_reports (server_id, created_at desc);

--------------------------------------------------------------------------------
-- CHEAT_OBSERVATIONS: unified observations from dashboard, in-game, or API
--------------------------------------------------------------------------------
-- This table stores cheat observations: recordings, undetected cheats, or
-- false positive reports. Sources: 'dashboard', 'ingame', 'api'.
--------------------------------------------------------------------------------
create table if not exists public.cheat_observations (
    id uuid primary key default gen_random_uuid(),
    server_id text not null references public.servers(id) on delete cascade,
    observation_type text not null check (observation_type in ('false_positive', 'undetected', 'recording')),
    source text not null default 'dashboard' check (source in ('dashboard', 'ingame', 'api')),
    player_uuid uuid not null,                   -- target player UUID
    player_name text,                            -- last known username at observation time
    cheat_type text,                             -- e.g. 'killaura', 'speed', 'fly'
    label text,                                  -- custom label/notes
    started_at timestamptz,                      -- when observation started
    ended_at timestamptz,                        -- when observation ended
    finding_id uuid references public.findings(id) on delete set null,  -- linked finding (for false_positive)
    player_activity text,                        -- what was the player doing
    suspected_cause text,                        -- suspected cause (for false_positive)
    session_id text,                             -- link to sessions.session_id
    additional_context text,                     -- any other info
    evidence_url text,                           -- URL to video/screenshot evidence
    reporter_user_id uuid,                       -- dashboard user who reported (auth.users.id)
    recorded_by_uuid uuid,                       -- staff member who recorded (player UUID)
    recorded_by_name text,                       -- staff member username
    status text not null default 'new' check (status in ('new', 'pending', 'reviewed', 'confirmed', 'resolved', 'dismissed')),
    admin_notes text,                            -- internal notes from reviewers
    reviewed_at timestamptz,                     -- when observation was reviewed
    reviewed_by uuid,                            -- auth.users.id of reviewer
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_cheat_observations_server
    on public.cheat_observations (server_id, created_at desc);

create index if not exists idx_cheat_observations_player
    on public.cheat_observations (player_uuid, created_at desc);

create index if not exists idx_cheat_observations_type
    on public.cheat_observations (observation_type, status);

create index if not exists idx_cheat_observations_finding
    on public.cheat_observations (finding_id);
