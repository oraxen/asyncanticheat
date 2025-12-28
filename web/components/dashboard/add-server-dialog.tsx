"use client";

import { useState } from "react";
import { RiCloseLine, RiServerLine } from "@remixicon/react";

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
}

export function AddServerDialog({ open, onOpenChange, onAdd }: AddServerDialogProps) {
  const [name, setName] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-sm mx-4 rounded-lg border border-[rgb(var(--border))] surface-1 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/10">
              <RiServerLine className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[rgb(var(--foreground))]">Add Server</h2>
              <p className="text-xs text-[rgb(var(--foreground-tertiary))]">Connect a Minecraft server</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-white/[0.06] transition-colors"
          >
            <RiCloseLine className="h-4 w-4 text-[rgb(var(--foreground-muted))]" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-[rgb(var(--foreground-secondary))] block mb-1.5">
              Server Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Minecraft Server"
              autoFocus
              className="w-full rounded-md border border-[rgb(var(--border))] surface-2 px-3 py-2 text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground-muted))] focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          
          <p className="text-xs text-[rgb(var(--foreground-muted))]">
            After adding, you&apos;ll receive configuration instructions for your AsyncAnticheat plugin.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-md border border-[rgb(var(--border))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground-secondary))] hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
