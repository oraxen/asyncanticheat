"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { RiSearchLine, RiCloseLine, RiTimeLine, RiAlertLine, RiArrowLeftLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

// Extended mock data with timestamps and more findings per player
const mockFindings = [
  { id: "1", player: "xX_Hacker_Xx", detector: "fight_speed", severity: "high" as const, message: "18.5 APS", time: "10:30", date: "Today" },
  { id: "2", player: "SuspiciousPlayer", detector: "moving_speed", severity: "medium" as const, message: "15.2 b/s", time: "10:25", date: "Today" },
  { id: "3", player: "TestUser123", detector: "fight_reach", severity: "high" as const, message: "4.8 blocks", time: "10:22", date: "Today" },
  { id: "4", player: "CoolGamer", detector: "moving_nofall", severity: "low" as const, message: "No fall damage", time: "10:18", date: "Today" },
  { id: "5", player: "AnotherPlayer", detector: "fight_angle", severity: "medium" as const, message: "45° snap", time: "10:15", date: "Today" },
  { id: "6", player: "xX_Hacker_Xx", detector: "fight_reach", severity: "critical" as const, message: "6.2 blocks", time: "10:12", date: "Today" },
  { id: "7", player: "xX_Hacker_Xx", detector: "fight_angle", severity: "high" as const, message: "87° rotation", time: "09:45", date: "Today" },
  { id: "8", player: "xX_Hacker_Xx", detector: "moving_speed", severity: "medium" as const, message: "12.3 b/s", time: "09:30", date: "Today" },
  { id: "9", player: "SuspiciousPlayer", detector: "fight_speed", severity: "high" as const, message: "16.2 APS", time: "09:15", date: "Today" },
  { id: "10", player: "TestUser123", detector: "moving_nofall", severity: "low" as const, message: "No fall damage", time: "08:50", date: "Today" },
  { id: "11", player: "xX_Hacker_Xx", detector: "fight_speed", severity: "critical" as const, message: "22.1 APS", time: "16:30", date: "Yesterday" },
  { id: "12", player: "xX_Hacker_Xx", detector: "moving_fly", severity: "high" as const, message: "Flight detected", time: "14:20", date: "Yesterday" },
  { id: "13", player: "SuspiciousPlayer", detector: "fight_reach", severity: "medium" as const, message: "4.2 blocks", time: "12:45", date: "Yesterday" },
];

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

// Get unique players with their stats
function getPlayerStats(findings: typeof mockFindings) {
  const playerMap = new Map<string, { 
    name: string; 
    totalFindings: number; 
    highestSeverity: string;
    lastSeen: string;
    detectors: Set<string>;
  }>();
  
  const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
  
  findings.forEach(f => {
    const existing = playerMap.get(f.player);
    if (existing) {
      existing.totalFindings++;
      if (severityRank[f.severity] > severityRank[existing.highestSeverity as keyof typeof severityRank]) {
        existing.highestSeverity = f.severity;
      }
      existing.detectors.add(f.detector);
    } else {
      playerMap.set(f.player, {
        name: f.player,
        totalFindings: 1,
        highestSeverity: f.severity,
        lastSeen: `${f.date} ${f.time}`,
        detectors: new Set([f.detector]),
      });
    }
  });
  
  return Array.from(playerMap.values()).sort((a, b) => b.totalFindings - a.totalFindings);
}

// Player History Panel Component
function PlayerHistoryPanel({ 
  playerName, 
  findings, 
  onClose 
}: { 
  playerName: string; 
  findings: typeof mockFindings;
  onClose: () => void;
}) {
  const playerFindings = findings.filter(f => f.player === playerName);
  const stats = getPlayerStats(findings).find(p => p.name === playerName);
  
  // Group findings by date
  const groupedFindings = playerFindings.reduce((acc, finding) => {
    const date = finding.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(finding);
    return acc;
  }, {} as Record<string, typeof mockFindings>);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 p-5 border-b border-white/[0.06]">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors group"
        >
          <RiArrowLeftLine className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">{playerName}</h2>
          <p className="text-xs text-white/40">Player findings history</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors group"
        >
          <RiCloseLine className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 p-5">
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RiAlertLine className="w-4 h-4 text-white/40" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Total</span>
          </div>
          <p className="text-2xl font-light text-white tabular-nums">{stats?.totalFindings || 0}</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("w-2 h-2 rounded-full", severityDots[stats?.highestSeverity as keyof typeof severityDots] || "bg-white/20")} />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Severity</span>
          </div>
          <p className={cn("text-lg font-medium capitalize", severityColors[stats?.highestSeverity as keyof typeof severityColors] || "text-white/60")}>
            {stats?.highestSeverity || "None"}
          </p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RiTimeLine className="w-4 h-4 text-white/40" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Detectors</span>
          </div>
          <p className="text-2xl font-light text-white tabular-nums">{stats?.detectors.size || 0}</p>
        </div>
      </div>

      {/* Active Detectors */}
      <div className="px-5 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {Array.from(stats?.detectors || []).map(detector => (
            <span
              key={detector}
              className="px-2 py-1 rounded-md bg-white/[0.03] text-[10px] text-white/60 font-mono"
            >
              {detector}
            </span>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="space-y-6">
          {Object.entries(groupedFindings).map(([date, items]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-white/60">{date}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              
              {/* Timeline Items */}
              <div className="relative pl-4">
                {/* Vertical Line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-white/10 via-white/[0.06] to-transparent" />
                
                <div className="space-y-3">
                  {items.map((finding, idx) => (
                    <div
                      key={finding.id}
                      className="relative flex items-start gap-4 group"
                    >
                      {/* Timeline Dot */}
                      <div className="absolute -left-4 top-1.5">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full ring-2 ring-[#0a0a0f]",
                          severityDots[finding.severity]
                        )} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 ml-2 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.06]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-white/80">{finding.detector}</span>
                          <span className="text-[10px] text-white/30 tabular-nums">{finding.time}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm font-medium", severityColors[finding.severity])}>
                            {finding.message}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] uppercase font-medium tracking-wide",
                            severityBgs[finding.severity],
                            severityColors[finding.severity]
                          )}>
                            {finding.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FindingsPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Check for player query param on mount
  useEffect(() => {
    const playerParam = searchParams.get("player");
    if (playerParam) {
      setSelectedPlayer(playerParam);
      setSearch(playerParam);
    }
  }, [searchParams]);

  const filtered = mockFindings.filter((f) => {
    if (filter && f.severity !== filter) return false;
    if (search && !f.player.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Get unique players from filtered findings for keyboard navigation
  const uniquePlayers = useMemo(() => {
    const seen = new Set<string>();
    return filtered.filter(f => {
      if (seen.has(f.player)) return false;
      seen.add(f.player);
      return true;
    }).map(f => f.player);
  }, [filtered]);

  // Navigate to next/previous player
  const navigatePlayer = useCallback((direction: "next" | "prev") => {
    if (!selectedPlayer) return;
    
    const currentIndex = uniquePlayers.indexOf(selectedPlayer);
    if (currentIndex === -1) return;
    
    let newIndex: number;
    if (direction === "next") {
      newIndex = currentIndex < uniquePlayers.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : uniquePlayers.length - 1;
    }
    
    setSelectedPlayer(uniquePlayers[newIndex]);
  }, [selectedPlayer, uniquePlayers]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === "Escape" && selectedPlayer) {
        e.preventDefault();
        setSelectedPlayer(null);
        setSearch("");
      } else if (e.key === "ArrowDown" || e.key === "j") {
        if (selectedPlayer) {
          e.preventDefault();
          navigatePlayer("next");
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        if (selectedPlayer) {
          e.preventDefault();
          navigatePlayer("prev");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlayer, navigatePlayer]);

  return (
    <div className="h-screen -m-6 flex flex-col relative">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Findings</h1>
            <p className="text-sm text-white/50 mt-0.5">Detection events</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player..."
              className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.02]">
            {[null, "low", "medium", "high", "critical"].map((s) => (
              <button
                key={s ?? "all"}
                onClick={() => setFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                  filter === s
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                {s ?? "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content - All Findings */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((finding) => (
            <button
              key={finding.id}
              onClick={() => setSelectedPlayer(finding.player)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left",
                selectedPlayer === finding.player && "bg-white/[0.04]"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", severityDots[finding.severity])} />
              <div className="w-32 flex-shrink-0">
                <p className="text-sm text-white truncate">{finding.player}</p>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-white/50 font-mono">{finding.detector}</span>
              </div>
              <div className="w-24 text-right flex-shrink-0">
                <span className={cn("text-xs", severityColors[finding.severity])}>{finding.message}</span>
              </div>
              <div className="w-20 text-right flex-shrink-0">
                <span className="text-[10px] text-white/30">{finding.date}</span>
              </div>
              <div className="w-14 text-right flex-shrink-0">
                <span className="text-[10px] text-white/30 tabular-nums">{finding.time}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Overlay Panel - Player History */}
      {selectedPlayer && (
        <>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => {
              setSelectedPlayer(null);
              setSearch("");
            }}
          />
          {/* Panel */}
          <div className="absolute top-4 right-4 bottom-4 w-[480px] z-50 bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-slide-in-right">
            <PlayerHistoryPanel
              playerName={selectedPlayer}
              findings={mockFindings}
              onClose={() => {
                setSelectedPlayer(null);
                setSearch("");
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
