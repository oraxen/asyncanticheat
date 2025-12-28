import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type DetectorTier = "core" | "advanced" | "legacy";
export type DetectorScope = "movement" | "combat" | "player" | "other";

export interface DetectorNameParts {
  scope: DetectorScope;
  tier: DetectorTier;
  category: string;
  check: string;
}

/**
 * Parse a finding detector id into (scope, tier, category, check).
 *
 * Supported patterns:
 * - tiered:  movement_core_flight_ascend
 * - tiered:  combat_advanced_aim_headsnap
 * - legacy:  movement_timer_slow
 */
export function parseDetectorName(detectorName: string): DetectorNameParts {
  const parts = detectorName.split("_").filter(Boolean);
  const scopeRaw = parts[0] ?? "other";
  // Backwards-compat aliases (older mock/demo naming).
  const scopeAlias =
    scopeRaw === "fight" ? "combat" : scopeRaw === "moving" ? "movement" : scopeRaw;
  const scope: DetectorScope =
    scopeAlias === "movement" || scopeAlias === "combat" || scopeAlias === "player"
      ? scopeAlias
      : "other";

  let tier: DetectorTier = "legacy";
  let categoryIdx = 1;
  if (parts[1] === "core" || parts[1] === "advanced") {
    tier = parts[1];
    categoryIdx = 2;
  }

  const category = parts[categoryIdx] ?? "misc";
  const check = parts.slice(categoryIdx + 1).join("_") || category;

  return { scope, tier, category, check };
}

function titleCaseToken(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function formatDetectorScope(scope: DetectorScope): string {
  switch (scope) {
    case "movement":
      return "Movement";
    case "combat":
      return "Combat";
    case "player":
      return "Player";
    default:
      return "Other";
  }
}

export function formatDetectorCategory(category: string): string {
  const overrides: Record<string, string> = {
    killaura: "KillAura",
    nofall: "NoFall",
    noslow: "NoSlow",
    noswing: "NoSwing",
    badpackets: "BadPackets",
    fastplace: "FastPlace",
    fastbreak: "FastBreak",
    groundspoof: "GroundSpoof",
    autoclicker: "AutoClicker",
  };
  return overrides[category] ?? titleCaseToken(category);
}

export function formatDetectorTier(tier: DetectorTier): string | null {
  if (tier === "legacy") return null;
  return titleCaseToken(tier);
}

/**
 * Get the module name from detector parts.
 * E.g., { scope: "combat", tier: "core" } → "Combat Core"
 *       { scope: "movement", tier: "legacy" } → "Movement"
 */
export function getModuleName(parts: DetectorNameParts): string {
  const scopeName = formatDetectorScope(parts.scope);
  if (parts.tier === "legacy") {
    return scopeName;
  }
  return `${scopeName} ${titleCaseToken(parts.tier)}`;
}

/**
 * Module color classes for subtle visual distinction.
 * Returns a background color class for the module badge.
 */
export function getModuleColorClass(parts: DetectorNameParts): string {
  const baseColors: Record<DetectorScope, string> = {
    combat: "bg-red-500/10 text-red-400/70",
    movement: "bg-blue-500/10 text-blue-400/70",
    player: "bg-emerald-500/10 text-emerald-400/70",
    other: "bg-white/[0.03] text-white/50",
  };
  return baseColors[parts.scope];
}


