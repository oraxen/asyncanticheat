"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RiLinksLine,
  RiNotification3Line,
  RiDeleteBin6Line,
  RiLoader4Line,
  RiCheckLine,
  RiAlertLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useSelectedServer } from "@/lib/server-context";
import { SettingsSkeleton } from "@/components/ui/skeleton";

// Toggle Switch Component
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        checked ? "bg-indigo-500" : "bg-white/10",
        disabled && "opacity-50 cursor-not-allowed"
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

// Delete Confirmation Dialog
function DeleteDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  // Handle escape key to close dialog
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/60" onClick={loading ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-[rgb(var(--border))] surface-1 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <RiAlertLine className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[rgb(var(--foreground))]">
              Delete Server
            </h3>
            <p className="text-sm text-[rgb(var(--foreground-secondary))]">
              This action cannot be undone
            </p>
          </div>
        </div>
        <p className="text-sm text-[rgb(var(--foreground-secondary))] mb-6">
          Are you sure you want to delete this server? All associated data including
          findings, player records, and module configurations will be permanently removed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[rgb(var(--border))] px-4 py-2 text-sm font-medium text-[rgb(var(--foreground-secondary))] hover:border-[rgb(var(--border-elevated))] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <RiLoader4Line className="h-4 w-4 animate-spin" />}
            Delete Server
          </button>
        </div>
      </div>
    </div>
  );
}

interface ServerSettings {
  webhook_url: string | null;
  webhook_enabled: boolean;
  webhook_severity_levels: string[];
}

export default function SettingsPage() {
  const router = useRouter();
  const serverId = useSelectedServer();

  // Settings state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifications, setNotifications] = useState({
    critical: true,
    high: true,
    medium: false,
    low: false,
  });

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Track if settings have been modified
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<ServerSettings | null>(null);

  // Load settings
  const loadSettings = useCallback(async () => {
    if (!serverId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const settings = data.settings as ServerSettings;
          setWebhookUrl(settings.webhook_url || "");
          setNotifications({
            critical: settings.webhook_severity_levels.includes("critical"),
            high: settings.webhook_severity_levels.includes("high"),
            medium: settings.webhook_severity_levels.includes("medium"),
            low: settings.webhook_severity_levels.includes("low"),
          });
          setOriginalSettings(settings);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Check for changes
  useEffect(() => {
    if (!originalSettings) {
      setHasChanges(false);
      return;
    }

    const currentLevels = Object.entries(notifications)
      .filter(([, enabled]) => enabled)
      .map(([level]) => level)
      .sort();

    const originalLevels = [...originalSettings.webhook_severity_levels].sort();

    const urlChanged = (webhookUrl || null) !== (originalSettings.webhook_url || null);
    const levelsChanged = JSON.stringify(currentLevels) !== JSON.stringify(originalLevels);

    setHasChanges(urlChanged || levelsChanged);
  }, [webhookUrl, notifications, originalSettings]);

  // Save settings
  const handleSave = async () => {
    if (!serverId || !hasChanges) return;

    setSaving(true);
    try {
      const severityLevels = Object.entries(notifications)
        .filter(([, enabled]) => enabled)
        .map(([level]) => level);

      const res = await fetch(`/api/servers/${serverId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl || null,
          webhook_severity_levels: severityLevels,
        }),
      });

      if (res.ok) {
        // Reload to get fresh state
        await loadSettings();
        setHasChanges(false);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  // Test webhook
  const handleTestWebhook = async () => {
    if (!serverId || !webhookUrl) return;

    setTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const res = await fetch(`/api/servers/${serverId}/settings/test-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: webhookUrl }),
      });

      const data = await res.json();

      if (data.ok) {
        setWebhookTestResult({ ok: true, message: "Webhook sent successfully!" });
      } else {
        setWebhookTestResult({
          ok: false,
          message: data.details || data.error || "Failed to send webhook",
        });
      }
    } catch (err) {
      setWebhookTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to test webhook",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  // Delete server
  const handleDelete = async () => {
    if (!serverId) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Clear local storage and redirect
        const STORAGE_KEY = "async_anticheat_servers";
        const SELECTED_KEY = "async_anticheat_selected_server";
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const servers = JSON.parse(raw);
            const filtered = servers.filter((s: { id: string }) => s.id !== serverId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
          }
          localStorage.removeItem(SELECTED_KEY);
        } catch {
          // Ignore localStorage errors
        }

        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete server:", err);
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!serverId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="rounded-lg border border-[rgb(var(--border))] surface-1 p-8 text-center max-w-md">
          <p className="text-sm text-[rgb(var(--foreground-secondary))]">
            No server selected. Please select a server from the sidebar.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--foreground))]">Settings</h1>
          <p className="text-sm text-[rgb(var(--foreground-secondary))] mt-1">
            Configure your server connection and preferences
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving && <RiLoader4Line className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        )}
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestWebhook}
              disabled={!webhookUrl || testingWebhook}
              className="rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--foreground-secondary))] hover:border-[rgb(var(--border-elevated))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {testingWebhook && <RiLoader4Line className="h-3 w-3 animate-spin" />}
              Test Webhook
            </button>
            {webhookTestResult && (
              <span
                className={cn(
                  "text-xs flex items-center gap-1",
                  webhookTestResult.ok ? "text-green-400" : "text-red-400"
                )}
              >
                {webhookTestResult.ok ? (
                  <RiCheckLine className="h-3 w-3" />
                ) : (
                  <RiAlertLine className="h-3 w-3" />
                )}
                {webhookTestResult.message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notification Thresholds */}
      <div className="rounded-lg border border-[rgb(var(--border))] surface-1">
        <div className="flex items-start gap-3 p-4 border-b border-[rgb(var(--border))]">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10">
            <RiNotification3Line className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[rgb(var(--foreground))]">
              Notification Thresholds
            </h3>
            <p className="text-xs text-[rgb(var(--foreground-tertiary))]">
              Choose which severity levels trigger notifications
            </p>
          </div>
        </div>
        <div className="divide-y divide-[rgb(var(--border))]">
          {(["critical", "high", "medium", "low"] as const).map((level) => (
            <div key={level} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[rgb(var(--foreground-secondary))] capitalize">
                {level}
              </span>
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
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Delete Server
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
