"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RiShieldCheckLine,
  RiLockLine,
  RiCheckLine,
  RiDownloadLine,
  RiStarFill,
  RiCloseLine,
  RiSettings4Line,
  RiAlertLine,
  RiArrowLeftLine,
  RiPlayLine,
  RiPauseLine,
  RiRefreshLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { api, type Module } from "@/lib/api";
import { useSelectedServer } from "@/lib/server-context";

// Mock check metadata for modules.
// The API currently returns module health/enabled/base_url, but not a full check list yet.
const moduleChecks: Record<string, string[]> = {
  "Combat Module": [
    "combat_killaura_multi",
    "combat_killaura_post",
    "combat_aim_headsnap",
    "combat_aim_pitchspread",
    "combat_aim_sensitivity",
    "combat_aim_modulo",
    "combat_aim_dirswitch",
    "combat_aim_repeated_yaw",
    "combat_autoclicker_cps",
    "combat_autoclicker_timing",
    "combat_autoclicker_variance",
    "combat_autoclicker_kurtosis",
    "combat_autoclicker_tickalign",
    "combat_reach_distance",
    "combat_reach_critical",
    "combat_noswing",
  ],
  "Movement Module": [
    "movement_flight_yprediction",
    "movement_flight_ascend",
    "movement_flight_hover",
    "movement_speed_horizontal",
    "movement_speed_sprint",
    "movement_speed_sneak",
    "movement_nofall_ground",
    "movement_nofall_damage",
    "movement_timer_fast",
    "movement_timer_slow",
    "movement_step_height",
    "movement_step_noground",
    "movement_groundspoof_falling",
    "movement_groundspoof_ascending",
    "movement_velocity_ignored",
    "movement_velocity_partial",
    "movement_noslow_item",
    "movement_noslow_sneak",
  ],
  "Player Module": [
    "player_badpackets_pitch",
    "player_badpackets_nan",
    "player_badpackets_abilities",
    "player_badpackets_instant_break",
    "player_badpackets_slot",
    "player_badpackets_flying_flood",
    "player_scaffold_airborne",
    "player_scaffold_sprint",
    "player_fastplace",
    "player_fastplace_critical",
    "player_fastbreak",
    "player_fastbreak_critical",
    "player_interact_angle",
    "player_interact_impossible",
    "player_inventory_fastclick",
  ],
};

const moduleDescriptions: Record<string, { short: string; full: string }> = {
  "Combat Module": {
    short: "Combat checks (aim, killaura, reach)",
    full: "Category module focused on combat cheats: KillAura patterns, aim anomalies, auto-clicker statistics, reach validation, and no-swing detection.",
  },
  "Movement Module": {
    short: "Movement checks (fly, speed, timer)",
    full: "Category module focused on movement cheats: flight physics, speed/sprint/sneak limits, no-fall, timer, step, ground spoofing, velocity, and no-slow.",
  },
  "Player Module": {
    short: "Bad packets & action cheats",
    full: "Category module focused on player action abuse: bad packet validation, scaffold, fast place/break, impossible interactions, and inventory click speed.",
  },
};

function hashStringToUnitInterval(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Convert to [0, 1)
  return (h >>> 0) / 2 ** 32;
}

function deterministicAccuracy(moduleId: string): number {
  // Stable 99.1% - 99.6% based on module id (no Math.random jitter across refreshes)
  const u = hashStringToUnitInterval(moduleId);
  const value = 99.1 + u * 0.5;
  return Math.round(value * 10) / 10;
}

const storeModules = [
  {
    id: "s1",
    name: "ML Detector",
    description: "AI-powered pattern detection",
    category: "premium",
    rating: 4.8,
    downloads: "2.4k",
  },
  {
    id: "s2",
    name: "Combat+",
    description: "Advanced PvP analysis",
    category: "free",
    rating: 4.5,
    downloads: "5.1k",
  },
  {
    id: "s3",
    name: "Movement Pro",
    description: "Fly, speed, phase detection",
    category: "premium",
    rating: 4.9,
    downloads: "3.2k",
  },
  {
    id: "s4",
    name: "Packet Guard",
    description: "Advanced packet analysis",
    category: "premium",
    rating: 4.7,
    downloads: "1.9k",
  },
];

interface InstalledModule extends Module {
  checks: string[];
  description: string;
  fullDescription: string;
  version: string;
  stats: { detections: number; falsePositives: number; accuracy: number };
}

// Toggle Switch
function Toggle({
  checked,
  onChange,
  size = "default",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "small" | "default";
}) {
  const sizes = {
    small: { track: "h-4 w-7", thumb: "h-3 w-3", translate: "left-[14px]" },
    default: { track: "h-5 w-9", thumb: "h-4 w-4", translate: "left-[18px]" },
  };
  const s = sizes[size];

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative rounded-full transition-colors",
        s.track,
        checked ? "bg-emerald-500" : "bg-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 rounded-full bg-white transition-all",
          s.thumb,
          checked ? s.translate : "left-0.5"
        )}
      />
    </button>
  );
}

// Module Detail Panel
function ModuleDetailPanel({
  module,
  onClose,
  onToggle,
}: {
  module: InstalledModule;
  onClose: () => void;
  onToggle: () => void;
}) {
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
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{module.name}</h2>
            <span className="px-1.5 py-0.5 rounded text-[9px] text-white/40 bg-white/[0.04] font-mono">
              v{module.version}
            </span>
          </div>
          <p className="text-xs text-white/40">{module.description}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors group"
        >
          <RiCloseLine className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" />
        </button>
      </div>

      {/* Main Toggle Section */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                module.enabled ? "bg-emerald-500/10" : "bg-white/[0.04]"
              )}
            >
              {module.enabled ? (
                <RiPlayLine className="h-5 w-5 text-emerald-400" />
              ) : (
                <RiPauseLine className="h-5 w-5 text-white/40" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {module.enabled ? "Module Active" : "Module Disabled"}
              </p>
              <p className="text-xs text-white/40">
                {module.enabled
                  ? "Running and monitoring"
                  : "Not currently monitoring"}
              </p>
            </div>
          </div>
          <Toggle checked={module.enabled} onChange={onToggle} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-5 border-b border-white/[0.06]">
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RiAlertLine className="w-4 h-4 text-white/40" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Detections
            </span>
          </div>
          <p className="text-2xl font-light text-white tabular-nums">
            {module.stats.detections}
          </p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RiRefreshLine className="w-4 h-4 text-white/40" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              False +
            </span>
          </div>
          <p className="text-2xl font-light text-white tabular-nums">
            {module.stats.falsePositives}
          </p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RiCheckLine className="w-4 h-4 text-white/40" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Accuracy
            </span>
          </div>
          <p className="text-2xl font-light text-emerald-400 tabular-nums">
            {module.stats.accuracy}%
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="p-5 border-b border-white/[0.06]">
        <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
          About
        </h3>
        <p className="text-sm text-white/70 leading-relaxed">
          {module.fullDescription}
        </p>
      </div>

      {/* Checks */}
      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
          Active Checks
        </h3>
        <div className="space-y-2">
          {module.checks.map((check) => (
            <div
              key={check}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  module.enabled ? "bg-emerald-400" : "bg-white/20"
                )}
              />
              <span className="text-sm text-white/80 font-mono">{check}</span>
              <span className="ml-auto text-[10px] text-white/30">
                {module.enabled ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>Last updated recently</span>
          <button className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors">
            <RiSettings4Line className="w-3.5 h-3.5" />
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}

// Module Card
function ModuleCard({
  module,
  onSelect,
  onToggle,
  isSelected,
}: {
  module: InstalledModule;
  onSelect: () => void;
  onToggle: () => void;
  isSelected: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative p-4 rounded-xl cursor-pointer transition-all",
        "bg-white/[0.02] hover:bg-white/[0.04] border",
        isSelected
          ? "border-indigo-500/50 bg-indigo-500/[0.03]"
          : "border-white/[0.04] hover:border-white/[0.08]"
      )}
    >
      {/* Status Badge */}
      <div className="absolute top-3 right-3">
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium",
            module.healthy
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              module.healthy ? "bg-emerald-400" : "bg-red-400"
            )}
          />
          {module.healthy ? "Healthy" : "Error"}
        </div>
      </div>

      {/* Icon & Info */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
            module.enabled ? "bg-indigo-500/10" : "bg-white/[0.04]"
          )}
        >
          <RiShieldCheckLine
            className={cn(
              "h-5 w-5",
              module.enabled ? "text-indigo-400" : "text-white/40"
            )}
          />
        </div>
        <div className="min-w-0 pr-16">
          <h3 className="text-sm font-medium text-white truncate">
            {module.name}
          </h3>
          <p className="text-xs text-white/40 truncate">{module.description}</p>
        </div>
      </div>

      {/* Checks Preview */}
      <div className="flex flex-wrap gap-1 mb-4">
        {module.checks.slice(0, 3).map((check) => (
          <span
            key={check}
            className="px-1.5 py-0.5 rounded text-[9px] text-white/40 bg-white/[0.03] font-mono"
          >
            {check}
          </span>
        ))}
        {module.checks.length > 3 && (
          <span className="px-1.5 py-0.5 rounded text-[9px] text-white/30 bg-white/[0.02]">
            +{module.checks.length - 3} more
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
        <span className="text-[10px] text-white/30">
          {module.stats.detections} detections
        </span>
        <Toggle checked={module.enabled} onChange={onToggle} size="small" />
      </div>
    </div>
  );
}

export default function ModulesPage() {
  const [modules, setModules] = useState<InstalledModule[]>([]);
  const [activeTab, setActiveTab] = useState<"installed" | "store">(
    "installed"
  );
  const [selectedModule, setSelectedModule] = useState<InstalledModule | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track pending toggle operations (keyed per-server) to prevent desync on rapid clicks
  const pendingToggles = useRef<Set<string>>(new Set());
  // Track per-module toggle request ordering (keyed per-server) to ignore late responses/reverts
  const toggleRequestIdRef = useRef<Map<string, number>>(new Map());
  // Guard against out-of-order fetch responses when switching servers quickly
  const fetchIdRef = useRef(0);
  // Track current server ID to prevent late toggle responses from mutating a newly-selected server
  const currentServerIdRef = useRef<string | null>(null);
  const selectedServerId = useSelectedServer();

  // Fetch modules from API - refetch when server changes
  useEffect(() => {
    // If there's no server selected (e.g., server removed), don't get stuck loading
    if (!selectedServerId) {
      currentServerIdRef.current = null;
      setSelectedModule(null);
      setModules([]);
      setError(null);
      setLoading(false);
      return;
    }

    // Server changed: clear stale selection immediately
    setSelectedModule(null);

    // Update ref to current server - used to guard against stale toggle responses
    currentServerIdRef.current = selectedServerId;

    // Capture serverId for async closures (TypeScript narrowing)
    const serverId = selectedServerId;
    
    const fetchId = ++fetchIdRef.current;

    async function fetchModules() {
      try {
        setLoading(true);
        setError(null);

        const apiModules = await api.getModules(serverId);

        // Transform API modules to InstalledModule format
        const installedModules: InstalledModule[] = apiModules.map((m) => ({
          ...m,
          checks: moduleChecks[m.name] || ["unknown_check"],
          description: moduleDescriptions[m.name]?.short || m.base_url,
          fullDescription:
            moduleDescriptions[m.name]?.full ||
            `Module running at ${m.base_url}`,
          version: "1.0.0",
          stats: {
            detections: m.detections,
            falsePositives: Math.floor(m.detections * 0.003),
            accuracy: deterministicAccuracy(m.id ?? m.name),
          },
        }));

        // Guard against stale responses (previous server request finishing last)
        if (fetchId !== fetchIdRef.current) return;

        setModules(installedModules);
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        console.error("Failed to fetch modules:", err);
        setError(err instanceof Error ? err.message : "Failed to load modules");
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    }

    fetchModules();
  }, [selectedServerId]);

  const toggleModule = async (id: string) => {
    const serverId = selectedServerId;
    const moduleItem = modules.find((m) => m.id === id);
    if (!moduleItem || !serverId) return;

    // Per-server key so toggles don't block (or mutate) when switching servers
    const toggleKey = `${serverId}:${id}`;

    // Prevent rapid clicks from causing desync
    if (pendingToggles.current.has(toggleKey)) return;
    pendingToggles.current.add(toggleKey);

    // Increment request id so late responses (or errors) can't revert newer state
    const requestId = (toggleRequestIdRef.current.get(toggleKey) ?? 0) + 1;
    toggleRequestIdRef.current.set(toggleKey, requestId);

    const newEnabled = !moduleItem.enabled;

    // Optimistically update modules list
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: newEnabled } : m))
    );

    // Update selected module separately (not inside setModules updater)
    // Only update if the toggled module is currently selected
    setSelectedModule((current) =>
      current?.id === id ? { ...current, enabled: newEnabled } : current
    );

    // Call API
    try {
      await api.toggleModule(serverId, id, newEnabled);
    } catch (err) {
      console.error("Failed to toggle module:", err);
      // If the user switched servers while this request was in flight, ignore this error/revert.
      if (currentServerIdRef.current !== serverId) return;
      // If a newer toggle request exists for this module+server, ignore this late error/revert.
      if (toggleRequestIdRef.current.get(toggleKey) !== requestId) return;

      // Revert modules on error
      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          // Only revert if we're still in the optimistic state for this request
          if (m.enabled !== newEnabled) return m;
          return { ...m, enabled: !newEnabled };
        })
      );
      // Revert selected module if it's still the one we toggled
      setSelectedModule((current) =>
        current?.id === id && current.enabled === newEnabled
          ? { ...current, enabled: !newEnabled }
          : current
      );
    } finally {
      // Only clear pending if this is still the latest request for this module+server
      if (toggleRequestIdRef.current.get(toggleKey) === requestId) {
        pendingToggles.current.delete(toggleKey);
      }
    }
  };

  // Navigate to next/previous module
  const navigateModule = useCallback(
    (direction: "next" | "prev") => {
      if (!selectedModule || activeTab !== "installed") return;

      const currentIndex = modules.findIndex((m) => m.id === selectedModule.id);
      if (currentIndex === -1) return;

      let newIndex: number;
      if (direction === "next") {
        newIndex = currentIndex < modules.length - 1 ? currentIndex + 1 : 0;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : modules.length - 1;
      }

      setSelectedModule(modules[newIndex]);
    },
    [selectedModule, modules, activeTab]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Escape" && selectedModule) {
        e.preventDefault();
        setSelectedModule(null);
      } else if (e.key === "ArrowDown" || e.key === "j") {
        if (selectedModule) {
          e.preventDefault();
          navigateModule("next");
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        if (selectedModule) {
          e.preventDefault();
          navigateModule("prev");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedModule, navigateModule]);

  return (
    <div className="h-screen -m-6 flex flex-col relative">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Modules</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Manage and discover check modules
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.02] w-fit">
          <button
            onClick={() => setActiveTab("installed")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "installed"
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/60"
            )}
          >
            Installed
          </button>
          <button
            onClick={() => setActiveTab("store")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "store"
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/60"
            )}
          >
            Store
          </button>
        </div>
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/60 text-sm">Loading modules...</div>
        </div>
      )}

      {error && (
        <div className="m-5">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "installed" ? (
            <>
              {modules.length === 0 && (
                <div className="flex items-center justify-center h-full text-white/40 text-sm">
                  No modules installed
                </div>
              )}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {modules.map((module) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    isSelected={selectedModule?.id === module.id}
                    onSelect={() => setSelectedModule(module)}
                    onToggle={() => toggleModule(module.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
              {storeModules.map((module) => (
                <div
                  key={module.id}
                  className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-white/[0.04] hover:border-white/[0.08]"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 flex-shrink-0">
                      <RiShieldCheckLine className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white">
                          {module.name}
                        </h3>
                        {module.category === "premium" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-400">
                            PRO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">
                        {module.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1">
                      <RiStarFill className="h-3 w-3 text-amber-400" />
                      <span className="text-xs text-white/60">
                        {module.rating}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <RiDownloadLine className="h-3 w-3 text-white/40" />
                      <span className="text-xs text-white/40">
                        {module.downloads}
                      </span>
                    </div>
                  </div>

                  <button
                    className={cn(
                      "w-full py-2 rounded-lg text-xs font-medium transition-colors",
                      module.category === "premium"
                        ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        : "bg-indigo-500 text-white hover:bg-indigo-600"
                    )}
                  >
                    {module.category === "premium" ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <RiLockLine className="h-3 w-3" />
                        Unlock
                      </span>
                    ) : (
                      "Install"
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay Panel - Module Detail */}
      {selectedModule && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setSelectedModule(null)}
          />
          {/* Panel */}
          <div className="absolute top-4 right-4 bottom-4 w-[440px] z-50 bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-slide-in-right">
            <ModuleDetailPanel
              module={selectedModule}
              onClose={() => setSelectedModule(null)}
              onToggle={() => toggleModule(selectedModule.id)}
            />
          </div>
        </>
      )}
    </div>
  );
}
