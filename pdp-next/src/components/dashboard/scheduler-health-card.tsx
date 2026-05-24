"use client";

import { useEffect, useMemo, useState } from "react";

type ReminderSummaryResponse = {
  ok: boolean;
  hours: number;
  since: string;
  totalRows: number;
  totals: {
    sent: number;
    failed: number;
    skipped: number;
  };
  byType: Record<string, { sent: number; failed: number; skipped: number }>;
};

type WindowHours = 24 | 168 | 336;

export function SchedulerHealthCard() {
  const [windowHours, setWindowHours] = useState<WindowHours>(24);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReminderSummaryResponse | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadSummary = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/notifications/reminders/summary-proxy?hours=${windowHours}`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | ReminderSummaryResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error || "Could not load scheduler summary.");
        }

        if (!isCancelled) {
          setSummary(payload as ReminderSummaryResponse);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setSummary(null);
          setError(loadError instanceof Error ? loadError.message : "Could not load scheduler summary.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      isCancelled = true;
    };
  }, [windowHours]);

  const totalByType = useMemo(() => {
    if (!summary) {
      return [] as Array<{ type: string; totals: { sent: number; failed: number; skipped: number } }>;
    }

    return Object.entries(summary.byType)
      .map(([type, totals]) => ({ type, totals }))
      .sort((left, right) => {
        const leftTotal = left.totals.sent + left.totals.failed + left.totals.skipped;
        const rightTotal = right.totals.sent + right.totals.failed + right.totals.skipped;
        return rightTotal - leftTotal;
      })
      .slice(0, 4);
  }, [summary]);

  return (
    <section className="pdp-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Scheduler Health</h2>
        <select
          className="pdp-control rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          value={String(windowHours)}
          onChange={(event) => setWindowHours(Number(event.target.value) as WindowHours)}
          aria-label="Scheduler summary window"
        >
          <option value="24">24h</option>
          <option value="168">7d</option>
          <option value="336">14d</option>
        </select>
      </div>

      {isLoading ? <p className="mt-3 text-sm text-slate-700">Loading scheduler summary...</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {summary ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <HealthMetric label="Sent" value={summary.totals.sent} />
            <HealthMetric label="Failed" value={summary.totals.failed} />
            <HealthMetric label="Skipped" value={summary.totals.skipped} />
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top reminder activity</p>
            {totalByType.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">No reminder rows in this window.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {totalByType.map((entry) => (
                  <li key={entry.type} className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{formatReminderType(entry.type)}</span>
                    <span>
                      S:{entry.totals.sent} F:{entry.totals.failed} K:{entry.totals.skipped}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function HealthMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="pdp-card rounded-xl p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function formatReminderType(type: string) {
  if (type === "daily_agenda") {
    return "Daily agenda";
  }
  if (type === "weekly_review") {
    return "Weekly review";
  }
  if (type === "due_tasks") {
    return "Due tasks";
  }
  if (type === "test") {
    return "Test";
  }
  return type;
}
