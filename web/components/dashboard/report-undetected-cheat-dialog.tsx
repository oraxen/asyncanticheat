"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RiSpyLine, RiLoader4Line, RiCheckLine } from "@remixicon/react";
import { createClient } from "@/lib/supabase/client";

export interface PlayerSession {
  id: string;
  player_uuid: string;
  player_name: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
}

interface ReportUndetectedCheatDialogProps {
  player: { uuid: string; name: string } | null;
  session: PlayerSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
}

const CHEAT_TYPES = [
  { value: "killaura", label: "KillAura / Combat" },
  { value: "speed", label: "Speed Hack" },
  { value: "fly", label: "Fly Hack" },
  { value: "reach", label: "Reach" },
  { value: "autoclicker", label: "Auto Clicker" },
  { value: "aimbot", label: "Aimbot" },
  { value: "xray", label: "X-Ray" },
  { value: "scaffold", label: "Scaffold" },
  { value: "bhop", label: "Bunny Hop" },
  { value: "nofall", label: "No Fall" },
  { value: "antiknockback", label: "Anti Knockback" },
  { value: "other", label: "Other" },
];

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSessionTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function ReportUndetectedCheatDialog({
  player,
  session,
  open,
  onOpenChange,
  serverId,
}: ReportUndetectedCheatDialogProps) {
  const [cheatType, setCheatType] = useState("");
  const [cheatDescription, setCheatDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize times based on session
  useEffect(() => {
    if (session) {
      const start = new Date(session.started_at);
      setStartTime(formatDateTimeLocal(start));
      
      if (session.ended_at) {
        const end = new Date(session.ended_at);
        setEndTime(formatDateTimeLocal(end));
      } else {
        setEndTime("");
      }
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !cheatType || !startTime) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from("undetected_cheat_reports")
        .insert({
          server_id: serverId,
          player_uuid: player.uuid,
          session_id: session?.session_id ?? null,
          reporter_user_id: user?.id ?? null,
          cheat_type: cheatType,
          cheat_description: cheatDescription || null,
          occurred_at_start: new Date(startTime).toISOString(),
          occurred_at_end: endTime ? new Date(endTime).toISOString() : null,
          additional_context: additionalContext || null,
          evidence_url: evidenceUrl || null,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setSubmitted(true);
      setTimeout(() => {
        onOpenChange(false);
        // Reset form after dialog closes
        setTimeout(() => {
          setCheatType("");
          setCheatDescription("");
          setStartTime("");
          setEndTime("");
          setAdditionalContext("");
          setEvidenceUrl("");
          setSubmitted(false);
        }, 200);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const sessionStart = session ? new Date(session.started_at) : null;
  const sessionEnd = session?.ended_at ? new Date(session.ended_at) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiSpyLine className="h-5 w-5 text-red-400" />
            Report Undetected Cheat
          </DialogTitle>
          <DialogDescription>
            Help us catch cheaters we missed. Your report will be reviewed.
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
              Thank you for helping keep the server fair.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4">
              {/* Player Info */}
              {player && (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40">Player</span>
                    <span className="text-[10px] text-white/30 font-mono">
                      {player.uuid.slice(0, 8)}...
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">{player.name}</p>
                  {session && (
                    <p className="text-xs text-white/50 mt-1">
                      Session: {formatSessionTime(session.started_at)}
                      {session.ended_at && ` — ${formatSessionTime(session.ended_at)}`}
                    </p>
                  )}
                </div>
              )}

              {/* Cheat Type */}
              <div className="space-y-2">
                <Label htmlFor="cheatType">Type of cheat suspected *</Label>
                <Select value={cheatType} onValueChange={setCheatType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cheat type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CHEAT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="cheatDescription">
                  Describe what you observed
                </Label>
                <Textarea
                  id="cheatDescription"
                  value={cheatDescription}
                  onChange={(e) => setCheatDescription(e.target.value)}
                  placeholder="e.g., Player was hitting from impossible angles, moving faster than sprinting..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Timeframe */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Started at *</Label>
                  <input
                    type="datetime-local"
                    id="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    min={sessionStart ? formatDateTimeLocal(sessionStart) : undefined}
                    max={sessionEnd ? formatDateTimeLocal(sessionEnd) : undefined}
                    className={cn(
                      "flex h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white",
                      "focus:outline-none focus:border-indigo-500/50 transition-colors",
                      "[color-scheme:dark]"
                    )}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Ended at (approx)</Label>
                  <input
                    type="datetime-local"
                    id="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    min={startTime || undefined}
                    max={sessionEnd ? formatDateTimeLocal(sessionEnd) : undefined}
                    className={cn(
                      "flex h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white",
                      "focus:outline-none focus:border-indigo-500/50 transition-colors",
                      "[color-scheme:dark]"
                    )}
                  />
                </div>
              </div>

              {/* Evidence URL */}
              <div className="space-y-2">
                <Label htmlFor="evidenceUrl">Evidence URL (optional)</Label>
                <input
                  type="url"
                  id="evidenceUrl"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="Link to video or screenshot..."
                  className={cn(
                    "flex h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-white/30",
                    "focus:outline-none focus:border-indigo-500/50 transition-colors"
                  )}
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
                disabled={submitting || !cheatType || !startTime}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  "bg-red-500 text-white hover:bg-red-600",
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
