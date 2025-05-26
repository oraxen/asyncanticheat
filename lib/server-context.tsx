"use client";

import { createContext, useContext, ReactNode } from "react";

interface ServerContextValue {
  selectedServerId: string | null;
}

const ServerContext = createContext<ServerContextValue | null>(null);

export function ServerProvider({
  children,
  selectedServerId,
}: {
  children: ReactNode;
  selectedServerId: string | null;
}) {
  return (
    <ServerContext.Provider value={{ selectedServerId }}>
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

