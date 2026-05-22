"use client";

import { useEffect, useState } from "react";
import { dataRepository } from "@/lib/data/repository";

export function OfflineSyncStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(() => dataRepository.getOfflineMutationCount());
  const [isFlushing, setIsFlushing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onOnline = () => {
      setIsOnline(true);
      void flushQueue("Back online. Syncing queued writes...");
    };

    const onOffline = () => {
      setIsOnline(false);
      setSyncMessage("Offline mode: writes are being queued locally.");
    };

    const unsubscribe = dataRepository.subscribeOfflineMutationCount((count) => {
      setPendingCount(count);
    });

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function flushQueue(startMessage?: string) {
    setIsFlushing(true);
    if (startMessage) {
      setSyncMessage(startMessage);
    }

    try {
      const result = await dataRepository.flushOfflineMutations();
      if (result.failed > 0) {
        setSyncMessage(`Sync paused with ${result.remaining} write(s) still queued.`);
      } else if (result.processed > 0) {
        setSyncMessage(`Synced ${result.processed} queued write(s).`);
      } else if (result.remaining > 0) {
        setSyncMessage(`${result.remaining} queued write(s) waiting for connectivity.`);
      } else {
        setSyncMessage("All queued writes are synced.");
      }
    } catch {
      setSyncMessage("Sync failed. We will retry when the connection stabilizes.");
    } finally {
      setIsFlushing(false);
    }
  }

  const statusTone = !isOnline
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : pendingCount > 0
      ? "border-blue-300 bg-blue-50 text-blue-900"
      : "border-emerald-300 bg-emerald-50 text-emerald-900";

  return (
    <section className={`rounded-2xl border p-4 shadow-sm ${statusTone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Offline Sync Status</h2>
          <p className="mt-1 text-sm">
            {isOnline ? "Online" : "Offline"} | Pending queued writes: {pendingCount}
          </p>
          {syncMessage ? <p className="mt-1 text-xs">{syncMessage}</p> : null}
        </div>

        <button
          type="button"
          disabled={isFlushing || pendingCount === 0 || !isOnline}
          onClick={() => void flushQueue()}
          className="rounded-lg border border-current px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFlushing ? "Syncing..." : "Sync Now"}
        </button>
      </div>
    </section>
  );
}
