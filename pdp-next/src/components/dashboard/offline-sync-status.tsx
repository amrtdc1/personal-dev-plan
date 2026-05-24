"use client";

import { useEffect, useState } from "react";
import { dataRepository } from "@/lib/data/repository";
import {
  formatOfflineOperationLabel,
  getOfflineSyncFailureState,
  subscribeOfflineSyncFailureState,
} from "@/lib/offline/sync-status";

export function OfflineSyncStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(() => dataRepository.getOfflineMutationCount());
  const [isRetrying, setIsRetrying] = useState(false);
  const [failureState, setFailureState] = useState(() => getOfflineSyncFailureState());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onOnline = () => {
      setIsOnline(true);
      void dataRepository.flushOfflineMutations();
    };

    const onOffline = () => {
      setIsOnline(false);
    };

    const unsubscribe = dataRepository.subscribeOfflineMutationCount((count) => {
      setPendingCount(count);
    });
    const unsubscribeFailure = subscribeOfflineSyncFailureState((nextFailure) => {
      setFailureState(nextFailure);
    });

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      unsubscribe();
      unsubscribeFailure();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const hasFailure = Boolean(failureState.failedOperation);

  async function handleRetrySync() {
    if (isRetrying) {
      return;
    }

    setIsRetrying(true);

    try {
      await dataRepository.flushOfflineMutations();
      setPendingCount(dataRepository.getOfflineMutationCount());
    } finally {
      setIsRetrying(false);
    }
  }

  if (isOnline && !hasFailure) {
    return null;
  }

  const failedLabel = formatOfflineOperationLabel(failureState.failedOperation);
  const friendlyFailureReason = getFriendlySyncFailureReason(failureState.failedError);
  const hasQueuedChanges = pendingCount > 0;
  const statusClassName = isOnline
    ? "border-rose-300 bg-rose-50 text-rose-900"
    : "border-amber-300 bg-amber-50 text-amber-900";
  const dotClassName = isOnline ? "bg-rose-500" : "bg-amber-500";

  return (
    <div className="flex justify-end">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${statusClassName}`}
        title={isOnline && hasFailure ? failureState.failedError ?? undefined : undefined}
      >
        <span className={`size-2 rounded-full ${dotClassName}`} aria-hidden="true" />
        {!isOnline ? `Offline mode${hasQueuedChanges ? ` · ${pendingCount} queued` : ""}` : null}
        {isOnline && hasFailure ? `Sync issue on ${failedLabel}` : null}
        {isOnline && hasFailure ? `: ${friendlyFailureReason}` : null}
        {isOnline && hasFailure && hasQueuedChanges ? (
          <button
            type="button"
            onClick={() => void handleRetrySync()}
            disabled={isRetrying}
            className="ml-1 rounded-full border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRetrying ? "Retrying..." : "Retry now"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getFriendlySyncFailureReason(error: string | null) {
  if (!error) {
    return "Try syncing again.";
  }

  const normalized = error.toLowerCase();

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("offline") ||
    normalized.includes("timeout")
  ) {
    return "Connection issue. Reconnect and retry.";
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("forbidden") ||
    normalized.includes("unauthorized")
  ) {
    return "Access issue. Sign in again, then retry.";
  }

  if (
    normalized.includes("schema") ||
    normalized.includes("attribute") ||
    normalized.includes("missing in your schema")
  ) {
    return "Data schema mismatch. Refresh the app and retry.";
  }

  if (normalized.includes("restore window") && normalized.includes("expired")) {
    return "Restore window expired for this item.";
  }

  if (normalized.includes("not loaded") || normalized.includes("not found")) {
    return "The item changed on another device. Refresh and retry.";
  }

  return "Unexpected sync issue. Try syncing again.";
}
