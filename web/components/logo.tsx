"use client";

import { cn } from "@/lib/utils";

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-xl bg-gradient-to-br from-violet-500/20 to-red-500/10 ring-1 ring-white/10",
        className
      )}
      style={{ width: size, height: size }}
      aria-label="AsyncAnticheat"
    >
      <div className="h-3.5 w-3.5 rounded-md bg-gradient-to-br from-violet-400 to-red-400 shadow-[0_0_30px_rgba(139,92,246,0.25)]" />
    </div>
  );
}


