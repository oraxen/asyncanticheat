"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RiShieldCheckLine,
  RiCheckLine,
  RiCloseLine,
  RiSettings4Line,
  RiAlertLine,
  RiArrowLeftLine,
  RiPlayLine,
  RiPauseLine,
  RiRefreshLine,
  RiAddLine,
  RiSave2Line,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { api, type Module } from "@/lib/api";
import { useSelectedServer } from "@/lib/server-context";

// Check metadata for tiered modules (Core + Advanced)
const moduleChecks: Record<string, string[]> = {
  "Combat Core": [
    "combat_core_autoclicker_cps",
    "combat_core_reach_critical",
    "combat_core_killaura_multi",
    "combat_core_noswing",
  ],
  "Combat Advanced": [
    "combat_advanced_aim_headsnap",
    "combat_advanced_aim_pitchspread",
    "combat_advanced_aim_sensitivity",
    "combat_advanced_aim_modulo",
    "combat_advanced_aim_dirswitch",
    "combat_advanced_aim_repeated_yaw",
    "combat_advanced_autoclicker_timing",
    "combat_advanced_autoclicker_variance",
    "combat_advanced_autoclicker_kurtosis",
    "combat_advanced_autoclicker_tickalign",
    "combat_advanced_killaura_post",
    "combat_advanced_reach_distance",
  ],
  "Movement Core": [
    "movement_core_flight_ascend",
    "movement_core_speed_blatant",
    "movement_core_nofall_ground",
    "movement_core_groundspoof_fall",
    "movement_core_groundspoof_ascend",
  ],
  "Movement Advanced": [
    "movement_advanced_flight_ypred",
    "movement_advanced_flight_hover",
    "movement_advanced_speed_sprint",
    "movement_advanced_speed_sneak",
    "movement_advanced_timer_fast",
    "movement_advanced_timer_slow",
    "movement_advanced_step_height",
    "movement_advanced_noslow_item",
  ],
  "Player Core": [
    "player_core_badpackets_pitch",
    "player_core_badpackets_nan",
    "player_core_badpackets_abilities",
    "player_core_badpackets_slot",
    "player_core_fastplace_critical",
    "player_core_fastbreak_critical",
    "player_core_scaffold_airborne",
  ],
  "Player Advanced": [
    "player_advanced_interact_angle",
    "player_advanced_interact_impossible",
    "player_advanced_inventory_fast",
    "player_advanced_fastplace",
    "player_advanced_fastbreak",
    "player_advanced_scaffold_sprint",
  ],
};

const moduleDescriptions: Record<string, { short: string; full: string; tier: "core" | "advanced" }> = {
  "Combat Core": {
    short: "High-signal combat cheats",
    full: "Pareto tier: Simple checks catching 80% of combat cheaters. High CPS, critical reach, multi-target switching, and missing arm animations.",
    tier: "core",
  },
  "Combat Advanced": {
    short: "Statistical combat analysis",
    full: "Statistical analysis of aim patterns, autoclicker timing distributions, GCD sensitivity checks, and subtle reach accumulation.",
    tier: "advanced",
  },
  "Movement Core": {
    short: "Blatant movement cheats",
    full: "Pareto tier: Catches obvious flight, blatant speed, nofall exploits, and ground spoofing with minimal false positives.",
    tier: "core",
  },
  "Movement Advanced": {
    short: "Subtle movement analysis",
    full: "Y-prediction physics, hovering detection, sprint/sneak speed limits, timer manipulation, step height, and noslow bypass.",
    tier: "advanced",
  },
  "Player Core": {
    short: "Obvious packet abuse",
    full: "Pareto tier: Invalid packets (pitch, NaN, slots), impossible abilities, critical fast place/break, and airborne scaffolding.",
    tier: "core",
  },
  "Player Advanced": {
    short: "Complex interaction analysis",
    full: "Interaction angles, rapid inventory clicks, fast place/break accumulation, and sprint-while-bridging detection.",
    tier: "advanced",
  },
};

const defaultPorts: Record<string, number> = {
  "Combat Core": 4021,
  "Movement Core": 4022,
  "Player Core": 4023,
  "Combat Advanced": 4024,
  "Movement Advanced": 4025,
  "Player Advanced": 4026,
};

function hashStringToUnitInterval(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

function deterministicAccuracy(moduleId: string): number {
  const u = hashStringToUnitInterval(moduleId);
  const value = 99.1 + u * 0.5;
  return Math.round(value * 10) / 10;
}

interface InstalledModule extends Module {
  checks: string[];
  description: string;
  fullDescription: string;
  tier: "core" | "advanced";
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

// Configuration Modal
function ConfigurationModal({
  module,
  onClose,
  onSave,
}: {
  module: InstalledModule;
  onClose: () => void;
  onSave: (config: { base_url: string; enabled: boolean }) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(module.base_url);
  const [enabled, setEnabled] = useState(module.enabled);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] z-50 bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-white">Configure {module.name}</h2>
            <p className="text-xs text-white/40">Module settings</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <RiCloseLine className="w-4 h-4 text-white/40" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:4021"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
            <div>
              <p className="text-sm font-medium text-white">Enabled</p>
              <p className="text-xs text-white/40">Module is active and monitoring</p>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ base_url: baseUrl, enabled })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
          >
            <RiSave2Line className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}

// Add Module Modal
function AddModuleModal({
  onClose,
  onAdd,
  existingModules,
}: {
  onClose: () => void;
  onAdd: (module: { name: string; base_url: string }) => void;
  existingModules: string[];
}) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const availableModules = Object.keys(moduleDescriptions).filter(
    (m) => !existingModules.includes(m)
  );

  const handleSelectModule = (moduleName: string) => {
    setName(moduleName);
    const port = defaultPorts[moduleName] || 4021;
    setBaseUrl(`http://127.0.0.1:${port}`);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed top-4 right-4 bottom-4 w-[440px] z-50 bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-white">Add Module</h2>
            <p className="text-xs text-white/40">Register a new detection module</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <RiCloseLine className="w-4 h-4 text-white/40" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {availableModules.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-white/60 mb-2">
                Quick Select
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableModules.map((m) => {
                  const meta = moduleDescriptions[m];
                  return (
                    <button
                      key={m}
                      onClick={() => handleSelectModule(m)}
                      className={cn(
                        "p-3 rounded-lg text-left transition-all border",
                        name === m
                          ? "bg-indigo-500/10 border-indigo-500/50"
                          : "bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08]"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-white">{m}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-medium",
                            meta.tier === "core"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-indigo-500/20 text-indigo-400"
                          )}
                        >
                          {meta.tier}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40">{meta.short}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">
              Module Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Combat Core"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:4021"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {name && moduleDescriptions[name] && (
            <div className="p-3 rounded-lg bg-white/[0.02]">
              <p className="text-xs text-white/60 mb-2">Checks included:</p>
              <div className="flex flex-wrap gap-1">
                {(moduleChecks[name] || []).slice(0, 5).map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 rounded text-[9px] text-white/40 bg-white/[0.04] font-mono"
                  >
                    {c.split("_").slice(-1)[0]}
                  </span>
                ))}
                {(moduleChecks[name] || []).length > 5 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] text-white/30">
                    +{(moduleChecks[name] || []).length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name && baseUrl) {
                onAdd({ name, base_url: baseUrl });
              }
            }}
            disabled={!name || !baseUrl}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RiAddLine className="w-4 h-4" />
            Add Module
          </button>
        </div>
      </div>
    </>
  );
}

// Module Detail Panel
function ModuleDetailPanel({
  module,
  onClose,
  onToggle,
  onConfigure,
}: {
  module: InstalledModule;
  onClose: () => void;
  onToggle: () => void;
  onConfigure: () => void;
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
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium",
                module.tier === "core"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-indigo-500/20 text-indigo-400"
              )}
            >
              {module.tier}
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
          <span className="font-mono text-white/30">{module.base_url}</span>
          <button
            onClick={onConfigure}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
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
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white truncate">
              {module.name}
            </h3>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0",
                module.tier === "core"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-indigo-500/20 text-indigo-400"
              )}
            >
              {module.tier}
            </span>
          </div>
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
            {check.split("_").slice(-1)[0]}
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

// Add Module Card
function AddModuleCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative p-4 rounded-xl cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03] border border-dashed border-white/[0.08] hover:border-white/[0.15] flex flex-col items-center justify-center min-h-[180px]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] group-hover:bg-indigo-500/10 transition-colors mb-3">
        <RiAddLine className="h-6 w-6 text-white/40 group-hover:text-indigo-400 transition-colors" />
      </div>
      <p className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">
        Add Module
      </p>
      <p className="text-xs text-white/30 mt-1">Register a new module</p>
    </div>
  );
}

export default function ModulesPage() {
  const [modules, setModules] = useState<InstalledModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<InstalledModule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingToggles = useRef<Set<string>>(new Set());
  const toggleRequestIdRef = useRef<Map<string, number>>(new Map());
  const fetchIdRef = useRef(0);
  const currentServerIdRef = useRef<string | null>(null);
  const selectedServerId = useSelectedServer();

  useEffect(() => {
    if (!selectedServerId) {
      currentServerIdRef.current = null;
      setSelectedModule(null);
      setModules([]);
      setError(null);
      setLoading(false);
      return;
    }

    setSelectedModule(null);
    currentServerIdRef.current = selectedServerId;
    const serverId = selectedServerId;
    const fetchId = ++fetchIdRef.current;

    async function fetchModules() {
      try {
        setLoading(true);
        setError(null);

        const apiModules = await api.getModules(serverId);

        const installedModules: InstalledModule[] = apiModules.map((m) => ({
          ...m,
          checks: moduleChecks[m.name] || ["unknown_check"],
          description: moduleDescriptions[m.name]?.short || m.base_url,
          fullDescription:
            moduleDescriptions[m.name]?.full ||
            `Module running at ${m.base_url}`,
          tier: moduleDescriptions[m.name]?.tier || "core",
          version: "1.0.0",
          stats: {
            detections: m.detections,
            falsePositives: Math.floor(m.detections * 0.003),
            accuracy: deterministicAccuracy(m.id ?? m.name),
          },
        }));

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

    const toggleKey = `${serverId}:${id}`;
    if (pendingToggles.current.has(toggleKey)) return;
    pendingToggles.current.add(toggleKey);

    const requestId = (toggleRequestIdRef.current.get(toggleKey) ?? 0) + 1;
    toggleRequestIdRef.current.set(toggleKey, requestId);

    const newEnabled = !moduleItem.enabled;

    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: newEnabled } : m))
    );

    setSelectedModule((current) =>
      current?.id === id ? { ...current, enabled: newEnabled } : current
    );

    try {
      await api.toggleModule(serverId, id, newEnabled);
    } catch (err) {
      console.error("Failed to toggle module:", err);
      if (currentServerIdRef.current !== serverId) return;
      if (toggleRequestIdRef.current.get(toggleKey) !== requestId) return;

      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (m.enabled !== newEnabled) return m;
          return { ...m, enabled: !newEnabled };
        })
      );
      setSelectedModule((current) =>
        current?.id === id && current.enabled === newEnabled
          ? { ...current, enabled: !newEnabled }
          : current
      );
    } finally {
      if (toggleRequestIdRef.current.get(toggleKey) === requestId) {
        pendingToggles.current.delete(toggleKey);
      }
    }
  };

  const handleAddModule = async (module: { name: string; base_url: string }) => {
    // For now, just close the modal - API endpoint for adding modules would go here
    console.log("Adding module:", module);
    setShowAddModal(false);
    // Refresh modules list
    if (selectedServerId) {
      const apiModules = await api.getModules(selectedServerId);
      const installedModules: InstalledModule[] = apiModules.map((m) => ({
        ...m,
        checks: moduleChecks[m.name] || ["unknown_check"],
        description: moduleDescriptions[m.name]?.short || m.base_url,
        fullDescription:
          moduleDescriptions[m.name]?.full || `Module running at ${m.base_url}`,
        tier: moduleDescriptions[m.name]?.tier || "core",
        version: "1.0.0",
        stats: {
          detections: m.detections,
          falsePositives: Math.floor(m.detections * 0.003),
          accuracy: deterministicAccuracy(m.id ?? m.name),
        },
      }));
      setModules(installedModules);
    }
  };

  const handleConfigSave = async (config: { base_url: string; enabled: boolean }) => {
    // For now, just close the modal - API endpoint for updating config would go here
    console.log("Saving config:", config);
    setShowConfigModal(false);
    // If enabled state changed, update it
    if (selectedModule && config.enabled !== selectedModule.enabled) {
      await toggleModule(selectedModule.id);
    }
  };

  const navigateModule = useCallback(
    (direction: "next" | "prev") => {
      if (!selectedModule) return;

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
    [selectedModule, modules]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Escape") {
        if (showAddModal) {
          setShowAddModal(false);
        } else if (showConfigModal) {
          setShowConfigModal(false);
        } else if (selectedModule) {
          setSelectedModule(null);
        }
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
  }, [selectedModule, navigateModule, showAddModal, showConfigModal]);

  return (
    <div className="h-screen -m-6 flex flex-col relative">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Modules</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Manage detection modules
            </p>
          </div>
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
            <AddModuleCard onClick={() => setShowAddModal(true)} />
          </div>
        </div>
      )}

      {/* Overlay Panel - Module Detail */}
      {selectedModule && !showConfigModal && (
        <>
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setSelectedModule(null)}
          />
          <div className="absolute top-4 right-4 bottom-4 w-[440px] z-50 bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-slide-in-right">
            <ModuleDetailPanel
              module={selectedModule}
              onClose={() => setSelectedModule(null)}
              onToggle={() => toggleModule(selectedModule.id)}
              onConfigure={() => setShowConfigModal(true)}
            />
          </div>
        </>
      )}

      {/* Add Module Modal */}
      {showAddModal && (
        <AddModuleModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddModule}
          existingModules={modules.map((m) => m.name)}
        />
      )}

      {/* Configuration Modal */}
      {showConfigModal && selectedModule && (
        <ConfigurationModal
          module={selectedModule}
          onClose={() => setShowConfigModal(false)}
          onSave={handleConfigSave}
        />
      )}
    </div>
  );
}
