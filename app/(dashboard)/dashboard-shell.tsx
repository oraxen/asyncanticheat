"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ServerProvider } from "@/lib/server-context";
import { api } from "@/lib/api";
import {
  loadServerWorkspaces,
  saveServerWorkspaces,
  getSelectedWorkspaceId,
  setSelectedWorkspaceId,
  newWorkspaceId,
} from "@/lib/server-store";
import { createClient } from "@/lib/supabase/client";
import type { ServerWorkspace } from "@/types/supabase";
import type { User } from "@supabase/supabase-js";

interface DashboardShellProps {
  children: React.ReactNode;
  user: User;
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const router = useRouter();
  const [servers, setServers] = useState<ServerWorkspace[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let list = loadServerWorkspaces();
      if (list.length === 0) {
        // Create default local server entry (fallback when API unreachable)
        const defaultServer: ServerWorkspace = {
          id: newWorkspaceId(),
          name: "My Server",
          created_at: new Date().toISOString(),
        };
        list = [defaultServer];
        saveServerWorkspaces(list);
        setSelectedWorkspaceId(defaultServer.id);
      }

      // Prefer servers discovered from the API (real plugin server_id values).
      // Fallback to local storage when API is unavailable.
      try {
        const remoteServers = await api.getServers();
        if (remoteServers.length > 0) {
          const merged: ServerWorkspace[] = remoteServers.map((s) => {
            const local = list.find((l) => l.id === s.id);
            return {
              id: s.id,
              name:
                local?.name ||
                s.name ||
                `Server ${s.id.slice(0, 8)}`,
              created_at: local?.created_at || s.last_seen_at || new Date().toISOString(),
            };
          });

          // Keep any purely-local entries that aren't in the remote list (optional)
          for (const local of list) {
            if (!merged.some((m) => m.id === local.id)) {
              merged.push(local);
            }
          }

          list = merged;
          saveServerWorkspaces(list);
        }
      } catch {
        // ignore; keep local list
      }

      if (cancelled) return;

      setServers(list);
      // Verify stored selection exists in list, fallback to first server
      const storedId = getSelectedWorkspaceId();
      const validId =
        storedId && list.some((s) => s.id === storedId)
          ? storedId
          : (list[0]?.id ?? null);
      setSelectedServerId(validId);
      setMounted(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleServersChange = (updated: ServerWorkspace[]) => {
    setServers(updated);
    saveServerWorkspaces(updated);
  };

  const handleServerSelect = (id: string) => {
    setSelectedServerId(id);
    setSelectedWorkspaceId(id);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen surface-0">
        <div className="w-56 glass border-r border-white/[0.06]" />
        <main className="flex-1 p-6" />
      </div>
    );
  }

  return (
    <ServerProvider selectedServerId={selectedServerId}>
      <div className="flex min-h-screen surface-0">
        <Sidebar
          servers={servers}
          selectedServerId={selectedServerId}
          onServersChange={handleServersChange}
          onServerSelect={handleServerSelect}
          user={user}
          onSignOut={handleSignOut}
        />
        <main className="flex-1 ml-56 p-6">{children}</main>
      </div>
    </ServerProvider>
  );
}
