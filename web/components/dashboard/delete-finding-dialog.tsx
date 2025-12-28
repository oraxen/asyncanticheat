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
import { cn } from "@/lib/utils";
import { RiDeleteBinLine, RiLoader4Line, RiCheckLine, RiAlertLine } from "@remixicon/react";
import type { Finding } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useInvalidateFindingsCache } from "@/lib/hooks/use-dashboard-data";

interface DeleteFindingDialogProps {
  finding: Finding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string | null;
  onDeleteSuccess?: (findingId: string) => void;
}

export function DeleteFindingDialog({
  finding,
  open,
  onOpenChange,
  serverId,
  onDeleteSuccess,
}: DeleteFindingDialogProps) {
  const { invalidateAll } = useInvalidateFindingsCache(serverId);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens or finding changes
  useEffect(() => {
    if (open) {
      setDeleting(false);
      setDeleted(false);
      setError(null);
    }
  }, [open, finding?.id]);

  const handleDelete = async () => {
    if (!finding) return;

    setDeleting(true);
    setError(null);

    try {
      const supabase = createClient();

      // First delete any associated false positive reports
      await supabase
        .from("false_positive_reports")
        .delete()
        .eq("finding_id", finding.id);

      // Then delete the finding itself
      const { error: deleteError } = await supabase
        .from("findings")
        .delete()
        .eq("id", finding.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Notify parent of successful delete
      onDeleteSuccess?.(finding.id);

      // Invalidate all finding-related caches to refresh players, stats, etc.
      invalidateAll();

      setDeleted(true);
      setTimeout(() => {
        onOpenChange(false);
        // Reset state after dialog closes
        setTimeout(() => {
          setDeleted(false);
        }, 200);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete finding");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiDeleteBinLine className="h-5 w-5 text-red-400" />
            Delete Finding
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The finding will be permanently removed.
          </DialogDescription>
        </DialogHeader>

        {deleted ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 mb-4">
              <RiCheckLine className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              Finding Deleted
            </h3>
            <p className="text-sm text-white/50">
              The finding has been permanently removed.
            </p>
          </div>
        ) : (
          <div>
            <div className="px-6 py-4 space-y-4">
              {/* Warning Banner */}
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <RiAlertLine className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-300">
                  This will permanently delete this finding and any associated false positive reports.
                </div>
              </div>

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
                  {finding.player_name && (
                    <p className="text-xs text-white/40 mt-1">
                      Player: {finding.player_name}
                    </p>
                  )}
                </div>
              )}

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
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white/80 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  "bg-red-500 text-white hover:bg-red-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center gap-2"
                )}
              >
                {deleting ? (
                  <>
                    <RiLoader4Line className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <RiDeleteBinLine className="h-4 w-4" />
                    Delete Finding
                  </>
                )}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
