"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RiFlagLine, RiLoader4Line, RiCheckLine } from "@remixicon/react";
import type { Finding } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface ReportFalsePositiveDialogProps {
  finding: Finding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  onReportSuccess?: (findingId: string) => void;
}

export function ReportFalsePositiveDialog({
  finding,
  open,
  onOpenChange,
  serverId,
  onReportSuccess,
}: ReportFalsePositiveDialogProps) {
  const [playerActivity, setPlayerActivity] = useState("");
  const [suspectedCause, setSuspectedCause] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finding) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from("false_positive_reports")
        .insert({
          finding_id: finding.id,
          server_id: serverId,
          reporter_user_id: user?.id ?? null,
          player_activity: playerActivity || null,
          suspected_cause: suspectedCause || null,
          additional_context: additionalContext || null,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Notify parent of successful report
      onReportSuccess?.(finding.id);

      setSubmitted(true);
      setTimeout(() => {
        onOpenChange(false);
        // Reset form after dialog closes
        setTimeout(() => {
          setPlayerActivity("");
          setSuspectedCause("");
          setAdditionalContext("");
          setSubmitted(false);
        }, 200);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiFlagLine className="h-5 w-5 text-amber-400" />
            Report False Positive
          </DialogTitle>
          <DialogDescription>
            Help us improve detection accuracy by reporting findings that were incorrect.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 mb-4">
              <RiCheckLine className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              Report Submitted
            </h3>
            <p className="text-sm text-white/50">
              Thank you for helping improve our detection system.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4">
              {/* Finding Info */}
              {finding && (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40">Detection</span>
                    <span className="text-[10px] text-white/30 font-mono">
                      {finding.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {finding.title}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5 font-mono">
                    {finding.detector_name}
                  </p>
                </div>
              )}

              {/* Player Activity */}
              <div className="space-y-2">
                <Label htmlFor="playerActivity">
                  What was the player doing when flagged?
                </Label>
                <Textarea
                  id="playerActivity"
                  value={playerActivity}
                  onChange={(e) => setPlayerActivity(e.target.value)}
                  placeholder="e.g., Using an elytra, fighting mobs, building..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Suspected Cause */}
              <div className="space-y-2">
                <Label htmlFor="suspectedCause">
                  What might have caused the false positive?
                </Label>
                <Textarea
                  id="suspectedCause"
                  value={suspectedCause}
                  onChange={(e) => setSuspectedCause(e.target.value)}
                  placeholder="e.g., High ping, server lag, specific plugin interaction..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Additional Context */}
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

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (!playerActivity && !suspectedCause)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  "bg-indigo-500 text-white hover:bg-indigo-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center gap-2"
                )}
              >
                {submitting ? (
                  <>
                    <RiLoader4Line className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
