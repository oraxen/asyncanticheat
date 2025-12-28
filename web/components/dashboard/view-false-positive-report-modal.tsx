"use client";

import { useState, useEffect } from "react";
import {
  RiFlagFill,
  RiCloseLine,
  RiLoader4Line,
  RiDeleteBinLine,
  RiSave2Line,
  RiFileCopyLine,
  RiCheckLine,
} from "@remixicon/react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface FalsePositiveReport {
  id: string;
  finding_id: string;
  server_id: string;
  player_activity: string | null;
  suspected_cause: string | null;
  additional_context: string | null;
  created_at: string;
  reporter_user_id: string | null;
}

interface ViewFalsePositiveReportModalProps {
  finding: Finding;
  onClose: () => void;
  serverId: string;
  onReportDeleted?: (findingId: string) => void;
  onReportUpdated?: () => void;
}

export function ViewFalsePositiveReportModal({
  finding,
  onClose,
  serverId,
  onReportDeleted,
  onReportUpdated,
}: ViewFalsePositiveReportModalProps) {
  const [report, setReport] = useState<FalsePositiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [playerActivity, setPlayerActivity] = useState("");
  const [suspectedCause, setSuspectedCause] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch the report on mount
  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("false_positive_reports")
          .select("*")
          .eq("finding_id", finding.id)
          .eq("server_id", serverId)
          .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        setReport(data);
        setPlayerActivity(data.player_activity || "");
        setSuspectedCause(data.suspected_cause || "");
        setAdditionalContext(data.additional_context || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch report");
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [finding.id, serverId]);

  const handleSave = async () => {
    if (!report) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("false_positive_reports")
        .update({
          player_activity: playerActivity || null,
          suspected_cause: suspectedCause || null,
          additional_context: additionalContext || null,
        })
        .eq("id", report.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setReport({
        ...report,
        player_activity: playerActivity || null,
        suspected_cause: suspectedCause || null,
        additional_context: additionalContext || null,
      });
      setIsEditing(false);
      onReportUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!report) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this false positive report?"
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("false_positive_reports")
        .delete()
        .eq("id", report.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      onReportDeleted?.(finding.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete report");
    } finally {
      setDeleting(false);
    }
  };

  const copyFindingId = async () => {
    try {
      await navigator.clipboard.writeText(finding.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = finding.id;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cancelEdit = () => {
    if (report) {
      setPlayerActivity(report.player_activity || "");
      setSuspectedCause(report.suspected_cause || "");
      setAdditionalContext(report.additional_context || "");
    }
    setIsEditing(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[85vh] z-[60] bg-[#0c0c10] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <RiFlagFill className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                False Positive Report
              </h2>
              <p className="text-xs text-white/40">
                Reported detection details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RiLoader4Line className="w-6 h-6 text-white/40 animate-spin" />
            </div>
          ) : error && !report ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* Finding Info */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40">Detection</span>
                  <button
                    onClick={copyFindingId}
                    className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 font-mono transition-colors cursor-pointer"
                    title="Copy finding ID"
                  >
                    {copied ? (
                      <>
                        <RiCheckLine className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <RiFileCopyLine className="w-3 h-3" />
                        <span>{finding.id}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm font-medium text-white mb-1">
                  {finding.title}
                </p>
                <p className="text-xs text-white/50 font-mono">
                  {finding.detector_name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-white/40">
                    Player: {finding.player_name || "Unknown"}
                  </span>
                  <span className="text-xs text-white/30">•</span>
                  <span className="text-xs text-white/40">
                    {finding.occurrences && finding.occurrences > 1
                      ? `${finding.occurrences} occurrences`
                      : "1 occurrence"}
                  </span>
                </div>
              </div>

              {/* Report Details */}
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="playerActivity">
                      What was the player doing?
                    </Label>
                    <Textarea
                      id="playerActivity"
                      value={playerActivity}
                      onChange={(e) => setPlayerActivity(e.target.value)}
                      placeholder="e.g., Using an elytra, fighting mobs..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="suspectedCause">
                      Suspected cause of false positive
                    </Label>
                    <Textarea
                      id="suspectedCause"
                      value={suspectedCause}
                      onChange={(e) => setSuspectedCause(e.target.value)}
                      placeholder="e.g., High ping, server lag..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additionalContext">
                      Additional context (optional)
                    </Label>
                    <Textarea
                      id="additionalContext"
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      placeholder="Any other relevant information..."
                      className="min-h-[60px]"
                    />
                  </div>
                </>
              ) : (
                <>
                  {report?.player_activity && (
                    <div className="space-y-1.5">
                      <span className="text-xs text-white/40">
                        What was the player doing?
                      </span>
                      <p className="text-sm text-white/80 p-3 rounded-lg bg-white/[0.02]">
                        {report.player_activity}
                      </p>
                    </div>
                  )}

                  {report?.suspected_cause && (
                    <div className="space-y-1.5">
                      <span className="text-xs text-white/40">
                        Suspected cause
                      </span>
                      <p className="text-sm text-white/80 p-3 rounded-lg bg-white/[0.02]">
                        {report.suspected_cause}
                      </p>
                    </div>
                  )}

                  {report?.additional_context && (
                    <div className="space-y-1.5">
                      <span className="text-xs text-white/40">
                        Additional context
                      </span>
                      <p className="text-sm text-white/80 p-3 rounded-lg bg-white/[0.02]">
                        {report.additional_context}
                      </p>
                    </div>
                  )}

                  {!report?.player_activity &&
                    !report?.suspected_cause &&
                    !report?.additional_context && (
                      <div className="text-sm text-white/40 text-center py-4">
                        No details were provided for this report.
                      </div>
                    )}

                  {report?.created_at && (
                    <div className="text-xs text-white/30 text-center pt-2">
                      Reported on{" "}
                      {new Date(report.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </>
              )}

              {error && report && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && report && (
          <div className="flex items-center justify-between p-5 border-t border-white/[0.06]">
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                "text-red-400 hover:bg-red-500/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {deleting ? (
                <RiLoader4Line className="w-4 h-4 animate-spin" />
              ) : (
                <RiDeleteBinLine className="w-4 h-4" />
              )}
              Delete Report
            </button>

            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                      "bg-indigo-500 text-white hover:bg-indigo-600",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {saving ? (
                      <RiLoader4Line className="w-4 h-4 animate-spin" />
                    ) : (
                      <RiSave2Line className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] text-white hover:bg-white/[0.10] transition-colors cursor-pointer"
                  >
                    Edit Report
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
