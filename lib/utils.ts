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
 * Get the module name from a detector name (essentially the scope).
 */
export function getModuleName(detectorName: string): DetectorScope {
  return parseDetectorName(detectorName).scope;
}

/**
 * Format module name for display.
 */
export function formatModuleName(scope: DetectorScope): string {
  return formatDetectorScope(scope);
}

/**
 * Get module-specific accent color for subtle UI hints.
 */
export function getModuleColor(scope: DetectorScope): string {
  switch (scope) {
    case "movement":
      return "text-blue-400/70";
    case "combat":
      return "text-red-400/70";
    case "player":
      return "text-purple-400/70";
    default:
      return "text-gray-400/70";
  }
}

/**
 * Get module-specific background color for badges.
 */
export function getModuleBgColor(scope: DetectorScope): string {
  switch (scope) {
    case "movement":
      return "bg-blue-500/10 border-blue-500/20";
    case "combat":
      return "bg-red-500/10 border-red-500/20";
    case "player":
      return "bg-purple-500/10 border-purple-500/20";
    default:
      return "bg-gray-500/10 border-gray-500/20";
  }
}


