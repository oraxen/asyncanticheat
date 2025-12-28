"use client";

import { createContext, useContext, ReactNode } from "react";

interface ServerContextValue {
  selectedServerId: string | null;
  refreshServers: () => Promise<void>;
}

const ServerContext = createContext<ServerContextValue | null>(null);

export function ServerProvider({
  children,
  selectedServerId,
  refreshServers,
}: {
  children: ReactNode;
  selectedServerId: string | null;
  refreshServers: () => Promise<void>;
}) {
  return (
    <ServerContext.Provider value={{ selectedServerId, refreshServers }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useSelectedServer(): string | null {
  const context = useContext(ServerContext);
  if (!context) {
    // Fallback for pages outside the provider (shouldn't happen in dashboard)
    return null;
  }
  return context.selectedServerId;
}

export function useRefreshServers(): () => Promise<void> {
  const context = useContext(ServerContext);
  if (!context) {
    // Return no-op if outside provider
    return async () => {};
  }
  return context.refreshServers;
}

