"use client";

import { useState } from "react";

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
      <button
        type="button"
        onClick={() => void handlePrimaryClick()}
        className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
        disabled={isLoading}
      >
        {isLoading ? "Rotating..." : "Revoke & Rotate URL"}
      </button>

      {isConfirmOpen ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Confirm revoke</p>
          <p className="mt-1 text-xs text-amber-900">
            This will immediately invalidate the currently shared calendar URL.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handlePrimaryClick()}
              className="rounded-full bg-amber-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-amber-600"
              disabled={isLoading}
            >
              Confirm revoke & rotate
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="rounded-full border border-amber-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900 transition hover:bg-amber-100"
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}