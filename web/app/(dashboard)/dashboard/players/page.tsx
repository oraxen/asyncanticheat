"use client";

import { useState, useMemo, useCallback } from "react";
import {
  RiSearchLine,
  RiAlertLine,
  RiSpyLine,
  RiUserLine,
  RiPlayCircleLine,
  RiStopCircleLine,
  RiArrowRightLine,
  RiCloseLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useSelectedServer } from "@/lib/server-context";
import {
  ReportUndetectedCheatDialog,
  type PlayerSession,
} from "@/components/dashboard/report-undetected-cheat-dialog";
import Link from "next/link";
import { PlayersSkeleton } from "@/components/ui/skeleton";
import { usePlayers } from "@/lib/hooks/use-dashboard-data";

// Types for player data
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

const severityColors = {
  low: "text-blue-400",
  medium: "text-amber-400",
  high: "text-red-400",
  critical: "text-red-300",
};

const severityBgs = {
  low: "bg-blue-500/10",
  medium: "bg-amber-500/10",
  high: "bg-red-500/10",
  critical: "bg-red-400/10",
};

const severityDots = {
  low: "bg-blue-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
  critical: "bg-red-400",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSessionDuration(
  startStr: string,
  endStr: string | null
): string {
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function formatDate(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) return { date: "Today", time };
  if (isYesterday) return { date: "Yesterday", time };
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time,
  };
}

// Player Detail Sidebar
function PlayerDetailSidebar({
  player,
  onClose,
  serverId,
  onReportCheat,
}: {
  player: PlayerWithStats;
  onClose: () => void;
  serverId: string;
  onReportCheat: (
    player: { uuid: string; name: string },
    session: PlayerSession | null
  ) => void;
}) {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 p-5 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white truncate">
              {player.name}
            </h2>
            {player.is_online && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 font-mono mt-0.5 truncate">
            {player.uuid}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors group"
        >
          <RiCloseLine className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 p-5">
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RiAlertLine className="w-4 h-4 text-white/40" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Findings
            </span>
          </div>
          <p className="text-2xl font-light text-white tabular-nums">
            {player.findings_count}
          </p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RiPlayCircleLine className="w-4 h-4 text-white/40" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Sessions
            </span>
          </div>
          <p className="text-2xl font-light text-white tabular-nums">
            {player.sessions.length}
          </p>
        </div>
      </div>

      {/* Severity & Actions */}
      <div className="px-5 pb-4 flex items-center gap-2">
        {player.highest_severity && (
          <span
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide",
              severityBgs[player.highest_severity],
              severityColors[player.highest_severity]
            )}
          >
            {player.highest_severity} severity
          </span>
        )}
        <div className="flex-1" />
        <Link
          href={`/dashboard/findings?player=${encodeURIComponent(player.name)}`}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
        >
          View Findings
          <RiArrowRightLine className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-medium text-white/60">
            Recent Sessions
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <div className="space-y-2">
          {player.sessions.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              No sessions recorded yet
            </div>
          ) : (
            player.sessions.map((session) => {
              const { date, time } = formatDate(session.started_at);
              const duration = formatSessionDuration(
                session.started_at,
                session.ended_at
              );
              const isActive = !session.ended_at;

              return (
                <div
                  key={session.id}
                  className="group p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <RiPlayCircleLine className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <RiStopCircleLine className="w-4 h-4 text-white/30" />
                      )}
                      <span className="text-sm font-medium text-white">
                        {date}
                      </span>
                      <span className="text-xs text-white/40">{time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          isActive ? "text-emerald-400" : "text-white/50"
                        )}
                      >
                        {duration}
                      </span>
                    </div>
                  </div>

                  {/* Report Button */}
                  <button
                    onClick={() =>
                      onReportCheat(
                        { uuid: player.uuid, name: player.name },
                        session
                      )
                    }
                    className="w-full mt-2 py-2 rounded-lg border border-white/[0.06] hover:border-red-500/30 bg-white/[0.02] hover:bg-red-500/10 text-white/50 hover:text-red-400 text-xs font-medium transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
                  >
                    <RiSpyLine className="w-3.5 h-3.5" />
                    Report undetected cheat in this session
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Report without session */}
        <button
          onClick={() =>
            onReportCheat({ uuid: player.uuid, name: player.name }, null)
          }
          className="w-full mt-4 py-3 rounded-lg border border-dashed border-white/[0.08] hover:border-red-500/30 bg-transparent hover:bg-red-500/5 text-white/40 hover:text-red-400 text-xs font-medium transition-all flex items-center justify-center gap-2"
        >
          <RiSpyLine className="w-3.5 h-3.5" />
          Report undetected cheat (general)
        </button>
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const selectedServerId = useSelectedServer();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "flagged">("all");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithStats | null>(
    null
  );

  // Use SWR hook for cached data fetching
  const { players, error, isLoading: loading } = usePlayers(selectedServerId);

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPlayer, setReportPlayer] = useState<{
    uuid: string;
    name: string;
  } | null>(null);
  const [reportSession, setReportSession] = useState<PlayerSession | null>(
    null
  );

  const handleReportCheat = useCallback(
    (player: { uuid: string; name: string }, session: PlayerSession | null) => {
      setReportPlayer(player);
      setReportSession(session);
      setReportDialogOpen(true);
    },
    []
  );

  // Filter players
  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !player.name.toLowerCase().includes(searchLower) &&
          !player.uuid.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Status filter
      if (filter === "online" && !player.is_online) return false;
      if (filter === "flagged" && player.findings_count === 0) return false;

      return true;
    });
  }, [players, search, filter]);

  // Stats
  const stats = useMemo(() => {
    const online = players.filter((p) => p.is_online).length;
    const flagged = players.filter((p) => p.findings_count > 0).length;
    const total = players.length;
    return { online, flagged, total };
  }, [players]);

  if (!selectedServerId) {
    return (
      <div className="h-screen -m-6 flex items-center justify-center">
        <div className="max-w-md w-full glass-panel rounded-2xl p-8 border border-white/[0.08]">
          <h1 className="text-xl font-semibold text-white">
            No server selected
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Select a server from the sidebar to view player sessions.
          </p>
        </div>
      </div>
    );
  }

  // Show skeleton while loading
  if (loading) {
    return <PlayersSkeleton />;
  }

  return (
    <div className="h-screen -m-6 flex flex-col relative">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Players</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Recent player sessions and activity
            </p>
          </div>
          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white/50">{stats.online} online</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-white/50">{stats.flagged} flagged</span>
            </div>
            <div className="flex items-center gap-2">
              <RiUserLine className="w-3.5 h-3.5 text-white/40" />
              <span className="text-white/50">{stats.total} total</span>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player name or UUID..."
              className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.02]">
            {(["all", "online", "flagged"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                  filter === f
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="m-5">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      {!error && (
        <div className="flex-1 overflow-y-auto">
          {filteredPlayers.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              {players.length === 0 ? (
                <>
                  <RiUserLine className="w-12 h-12 text-white/20" />
                  <div className="text-center">
                    <p className="text-white/50 text-sm font-medium">No players yet</p>
                    <p className="text-white/30 text-xs mt-1">
                      Players will appear here once they join your server
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-white/40 text-sm">No players match your filters</p>
              )}
            </div>
          )}

          {/* Player Grid */}
          {filteredPlayers.length > 0 && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPlayers.map((player) => (
              <button
                key={player.uuid}
                onClick={() => setSelectedPlayer(player)}
                className={cn(
                  "group p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all text-left cursor-pointer",
                  selectedPlayer?.uuid === player.uuid &&
                    "border-indigo-500/50 bg-white/[0.04]"
                )}
              >
                {/* Player Header */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center overflow-hidden">
                      <img
                        src={`https://mc-heads.net/avatar/${player.uuid}/40`}
                        alt={player.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          // Show the fallback icon
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback)
                            (fallback as HTMLElement).style.display = "block";
                        }}
                      />
                      <RiUserLine className="w-5 h-5 text-white/30 absolute hidden" />
                    </div>
                    {player.is_online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0c0c10]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {player.name}
                    </h3>
                    <p className="text-[10px] text-white/40">
                      {formatRelativeTime(player.last_seen_at)}
                    </p>
                  </div>

                  {/* Severity Badge */}
                  {player.highest_severity && (
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        severityDots[player.highest_severity]
                      )}
                    />
                  )}
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-white/50">
                    <RiAlertLine className="w-3.5 h-3.5" />
                    <span className="tabular-nums">
                      {player.findings_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/50">
                    <RiPlayCircleLine className="w-3.5 h-3.5" />
                    <span className="tabular-nums">
                      {player.sessions.length}
                    </span>
                  </div>
                  <div className="flex-1" />
                  <span className="text-[10px] text-white/30 group-hover:text-indigo-400 transition-colors">
                    View →
                  </span>
                </div>
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Player Detail Sidebar */}
      {selectedPlayer && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setSelectedPlayer(null)}
          />
          {/* Panel */}
          <div className="absolute top-4 right-4 bottom-4 w-[420px] z-50 bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-slide-in-right">
            <PlayerDetailSidebar
              player={selectedPlayer}
              onClose={() => setSelectedPlayer(null)}
              serverId={selectedServerId}
              onReportCheat={handleReportCheat}
            />
          </div>
        </>
      )}

      {/* Report Undetected Cheat Dialog */}
      {selectedServerId && (
        <ReportUndetectedCheatDialog
          player={reportPlayer}
          session={reportSession}
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          serverId={selectedServerId}
        />
      )}
    </div>
  );
}
