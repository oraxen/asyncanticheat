"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  RiHome5Line,
  RiShieldCheckLine,
  RiAlertLine,
  RiSettings4Line,
  RiAddLine,
  RiServerLine,
  RiCheckLine,
  RiArrowDownSLine,
  RiLogoutBoxRLine,
  RiUserLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import type { ServerWorkspace } from "@/types/supabase";
import type { User } from "@supabase/supabase-js";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: RiHome5Line },
  { name: "Modules", href: "/dashboard/modules", icon: RiShieldCheckLine },
  { name: "Findings", href: "/dashboard/findings", icon: RiAlertLine },
  { name: "Settings", href: "/dashboard/settings", icon: RiSettings4Line },
];

interface SidebarProps {
  servers: ServerWorkspace[];
  selectedServerId: string | null;
  onServerSelect: (serverId: string) => void;
  user?: User;
  onSignOut?: () => void;
}

export function Sidebar({
  servers,
  selectedServerId,
  onServerSelect,
  user,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col glass border-r border-white/[0.06]">
        {/* Logo */}
        <div className="flex h-14 items-center px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
              <span className="text-xs font-bold text-white">A</span>
            </div>
            <span className="text-sm font-semibold text-white">AsyncAC</span>
          </Link>
        </div>

        {/* Server Selector */}
        <div className="px-3 pb-3">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left",
                "bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06]",
                "transition-colors"
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20">
                <RiServerLine className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <span className="flex-1 text-sm font-medium text-white truncate">
                {selectedServer?.name || "Select server"}
              </span>
              <RiArrowDownSLine
                className={cn(
                  "h-4 w-4 text-white/40 transition-transform",
                  dropdownOpen && "rotate-180"
                )}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 rounded-lg bg-[#1a1a1f] border border-white/10 py-1.5 shadow-2xl animate-fade-in z-[100]">
                {servers.map((server) => (
                  <button
                    key={server.id}
                    onClick={() => {
                      onServerSelect(server.id);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                      "hover:bg-white/[0.06] transition-colors",
                      server.id === selectedServerId && "bg-white/[0.04]"
                    )}
                  >
                    <RiServerLine className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="flex-1 text-sm text-white/80 truncate">
                      {server.name}
                    </span>
                    {server.id === selectedServerId && (
                      <RiCheckLine className="h-4 w-4 text-indigo-400" />
                    )}
                  </button>
                ))}
                <div className="my-1.5 border-t border-white/[0.06]" />
                <Link
                  onClick={() => {
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.06] transition-colors"
                  href="/register-server"
                >
                  <RiAddLine className="h-3.5 w-3.5 text-white/40" />
                  <span className="text-sm text-white/50">Link server</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        {user && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5 border border-white/[0.04]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20">
                {user.user_metadata?.avatar_url ? (
                  <Image
                    src={user.user_metadata.avatar_url}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full"
                    unoptimized
                  />
                ) : (
                  <RiUserLine className="h-4 w-4 text-indigo-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">
                  {user.user_metadata?.full_name ||
                    user.user_metadata?.user_name ||
                    user.email?.split("@")[0] ||
                    "User"}
                </p>
                <p className="text-xs text-white/40 truncate">{user.email}</p>
              </div>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="p-1.5 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white/80 transition-colors"
                  title="Sign out"
                >
                  <RiLogoutBoxRLine className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-xs text-white/30">AsyncAnticheat v0.1.0</p>
        </div>
      </aside>
    </>
  );
}
