"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600 shadow-lg shadow-rose-500/25",
          variant === "secondary" &&
            "bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))]/80",
          variant === "ghost" && "hover:bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]",
          variant === "destructive" &&
            "bg-[rgb(var(--destructive))] text-white hover:bg-[rgb(var(--destructive))]/90",
          size === "default" && "h-10 px-4",
          size === "sm" && "h-9 px-3 text-xs",
          size === "lg" && "h-11 px-5",
          size === "icon" && "h-10 w-10",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";


