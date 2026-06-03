"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Check, Loader2, RotateCcw, X } from "lucide-react";

export function CalendarFeedRotationControl({
  isLoading,
  onRotate,
  onPrepareRotate,
}: {
  isLoading: boolean;
  onRotate: () => Promise<boolean>;
  onPrepareRotate?: () => void;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  async function handlePrimaryClick() {
    if (!isConfirmOpen) {
      onPrepareRotate?.();
      setIsConfirmOpen(true);
      return;
    }

    const didRotate = await onRotate();
    if (didRotate) {
      setIsConfirmOpen(false);
    }
  }

  return (
    <>
      <IconButton
        onClick={() => void handlePrimaryClick()}
        disabled={isLoading}
        title={isLoading ? "Rotating..." : "Revoke & Rotate URL"}
        variant="danger"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      </IconButton>

      {isConfirmOpen ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Confirm revoke</p>
          <p className="mt-1 text-xs text-amber-900">
            This will immediately invalidate the currently shared calendar URL.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <IconButton
              onClick={() => void handlePrimaryClick()}
              disabled={isLoading}
              title="Confirm revoke & rotate"
              variant="danger"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </IconButton>
            <IconButton
              onClick={() => setIsConfirmOpen(false)}
              disabled={isLoading}
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ) : null}
    </>
  );
}