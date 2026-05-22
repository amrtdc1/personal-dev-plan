"use client";

import { useEffect, useState } from "react";
import { dataRepository } from "@/lib/data/repository";

export function OfflineSyncStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(() => dataRepository.getOfflineMutationCount());
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

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm">
        <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
        Offline mode{pendingCount > 0 ? ` · ${pendingCount} queued` : ""}
      </div>
    </div>
  );
}
