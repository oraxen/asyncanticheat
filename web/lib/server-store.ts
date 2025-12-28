import type { ServerWorkspace } from "@/types/supabase";

const STORAGE_KEY = "async_anticheat_servers";
const SELECTED_KEY = "async_anticheat_selected_server";

export function loadServerWorkspaces(): ServerWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

export function saveServerWorkspaces(servers: ServerWorkspace[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
}

export function getSelectedWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SELECTED_KEY);
}

export function setSelectedWorkspaceId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELECTED_KEY, id);
}

export function newWorkspaceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `srv_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
