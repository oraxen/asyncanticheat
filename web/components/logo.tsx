"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="AsyncAnticheat"
      width={size}
      height={size}
      className={cn("[image-rendering:pixelated]", className)}
      unoptimized
    />
  );
}


