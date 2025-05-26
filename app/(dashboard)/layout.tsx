"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ServerProvider } from "@/lib/server-context";
import {
  loadServerWorkspaces,
  saveServerWorkspaces,
  getSelectedWorkspaceId,
  setSelectedWorkspaceId,
  newWorkspaceId,
} from "@/lib/server-store";
import type { ServerWorkspace } from "@/types/supabase";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [servers, setServers] = useState<ServerWorkspace[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let list = loadServerWorkspaces();
    if (list.length === 0) {
      // Create default server
      const defaultServer: ServerWorkspace = {
        id: newWorkspaceId(),
        name: "My Server",
        created_at: new Date().toISOString(),
      };
      list = [defaultServer];
      saveServerWorkspaces(list);
      setSelectedWorkspaceId(defaultServer.id);
    }
    setServers(list);
    // Verify stored selection exists in list, fallback to first server
    const storedId = getSelectedWorkspaceId();
    const validId =
      storedId && list.some((s) => s.id === storedId)
        ? storedId
        : (list[0]?.id ?? null);
    setSelectedServerId(validId);
    setMounted(true);
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
        />
        <main className="flex-1 ml-56 p-6">{children}</main>
      </div>
    </ServerProvider>
  );
}
