"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-[rgb(var(--card))] px-3 py-2 text-sm ring-offset-background placeholder:text-[rgb(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";


