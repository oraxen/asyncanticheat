"use client";

import { useState } from "react";
import {
  RiLinksLine,
  RiNotification3Line,
  RiDeleteBin6Line,
} from "@remixicon/react";
import { cn } from "@/lib/utils";

// Toggle Switch Component
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        checked ? "bg-indigo-500" : "bg-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifications, setNotifications] = useState({
    critical: true,
    high: true,
    medium: false,
    low: false,
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--foreground))]">Settings</h1>
        <p className="text-sm text-[rgb(var(--foreground-secondary))] mt-1">
          Configure your server connection and preferences
        </p>
      </div>

      {/* Webhook Section */}
      <div className="rounded-lg border border-[rgb(var(--border))] surface-1">
        <div className="flex items-start gap-3 p-4 border-b border-[rgb(var(--border))]">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10">
            <RiLinksLine className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[rgb(var(--foreground))]">Webhook</h3>
            <p className="text-xs text-[rgb(var(--foreground-tertiary))]">
              Receive real-time notifications for findings
            </p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[rgb(var(--foreground-secondary))] block mb-1.5">
              Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-md border border-[rgb(var(--border))] surface-2 px-3 py-2 text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground-muted))] focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
            <p className="text-xs text-[rgb(var(--foreground-muted))] mt-1">
              Supports Discord, Slack, or any HTTP endpoint
            </p>
          </div>
          <button
            disabled={!webhookUrl}
            className="rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--foreground-secondary))] hover:border-[rgb(var(--border-elevated))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Test Webhook
          </button>
        </div>
      </div>

      {/* Notification Thresholds */}
      <div className="rounded-lg border border-[rgb(var(--border))] surface-1">
        <div className="flex items-start gap-3 p-4 border-b border-[rgb(var(--border))]">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10">
            <RiNotification3Line className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[rgb(var(--foreground))]">Notification Thresholds</h3>
            <p className="text-xs text-[rgb(var(--foreground-tertiary))]">
              Choose which severity levels trigger notifications
            </p>
          </div>
        </div>
        <div className="divide-y divide-[rgb(var(--border))]">
          {(["critical", "high", "medium", "low"] as const).map((level) => (
            <div key={level} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[rgb(var(--foreground-secondary))] capitalize">{level}</span>
              <Toggle
                checked={notifications[level]}
                onChange={(v) => setNotifications((prev) => ({ ...prev, [level]: v }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5">
        <div className="flex items-start gap-3 p-4 border-b border-red-500/20">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500/10">
            <RiDeleteBin6Line className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[rgb(var(--foreground))]">Danger Zone</h3>
            <p className="text-xs text-[rgb(var(--foreground-tertiary))]">
              Irreversible actions
            </p>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[rgb(var(--foreground-secondary))]">Delete Server</p>
              <p className="text-xs text-[rgb(var(--foreground-muted))]">
                Permanently delete this server and all its data
              </p>
            </div>
            <button className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors">
              Delete Server
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
