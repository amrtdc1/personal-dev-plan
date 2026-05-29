"use client";

import { useEffect, useMemo, useState } from "react";
import type { DailyFocusPlan, PlanningCommitment, PlanningCycle, Task } from "@/lib/domain/types";

type FocusTodayPanelProps = {
  tasks: Task[];
  onOpenTask?: (taskId: string) => void;
};

export function FocusTodayPanel({ tasks, onOpenTask }: FocusTodayPanelProps) {
  const [weeklyCycles, setWeeklyCycles] = useState<PlanningCycle[]>([]);
  const [weeklyCommitments, setWeeklyCommitments] = useState<PlanningCommitment[]>([]);
  const [handoffCycleId, setHandoffCycleId] = useState<string | null>(null);
  const [dailyFocusPlan, setDailyFocusPlan] = useState<DailyFocusPlan | null>(null);
  const [selectedCommitmentIds, setSelectedCommitmentIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [dailyFocusNotes, setDailyFocusNotes] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const candidateTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.deletedAt === null && task.status !== "done")
        .sort((left, right) => {
          if (left.dueDate && right.dueDate) {
            return left.dueDate.localeCompare(right.dueDate);
          }
          if (left.dueDate) {
            return -1;
          }
          if (right.dueDate) {
            return 1;
          }
          return left.createdAt.localeCompare(right.createdAt);
        })
        .slice(0, 12),
    [tasks],
  );

  const selectedCommitments = useMemo(
    () => weeklyCommitments.filter((commitment) => selectedCommitmentIds.includes(commitment.id)),
    [selectedCommitmentIds, weeklyCommitments],
  );

  const selectedCommitmentCycleIds = useMemo(
    () => Array.from(new Set(selectedCommitments.map((commitment) => commitment.cycleId))),
    [selectedCommitments],
  );

  const hasMixedSelectedCommitmentCycles = selectedCommitmentCycleIds.length > 1;

  const handoffCycle = useMemo(
    () => weeklyCycles.find((cycle) => cycle.id === handoffCycleId) ?? null,
    [handoffCycleId, weeklyCycles],
  );

  const cycleScopedCommitments = useMemo(() => {
    const scoped = handoffCycleId
      ? weeklyCommitments.filter((commitment) => commitment.cycleId === handoffCycleId)
      : weeklyCommitments;

    return [...scoped].sort((left, right) => left.rank - right.rank || right.updatedAt.localeCompare(left.updatedAt));
  }, [handoffCycleId, weeklyCommitments]);

  useEffect(() => {
    let cancelled = false;

    async function loadFocusData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [focusResponse, commitmentsResponse, cyclesResponse] = await Promise.all([
          fetch(`/api/planning/daily-focus?date=${todayIso}`, { cache: "no-store" }),
          fetch("/api/planning/commitments?level=weekly", { cache: "no-store" }),
          fetch("/api/planning/cycles?cycleType=weekly", { cache: "no-store" }),
        ]);

        const focusBody = (await focusResponse.json()) as { plan?: DailyFocusPlan | null; error?: string };
        if (!focusResponse.ok) {
          throw new Error(focusBody.error ?? "Could not load daily focus.");
        }

        const commitmentsBody = (await commitmentsResponse.json()) as {
          commitments?: PlanningCommitment[];
          error?: string;
        };
        if (!commitmentsResponse.ok) {
          throw new Error(commitmentsBody.error ?? "Could not load weekly commitments.");
        }

        const cyclesBody = (await cyclesResponse.json()) as {
          cycles?: PlanningCycle[];
          error?: string;
        };
        if (!cyclesResponse.ok) {
          throw new Error(cyclesBody.error ?? "Could not load weekly cycles.");
        }

        if (cancelled) {
          return;
        }

        const loadedCycles = [...(cyclesBody.cycles ?? [])].sort(
          (left, right) => right.startDate.localeCompare(left.startDate),
        );
        const activeCycle = loadedCycles.find((cycle) => cycle.status === "active") ?? loadedCycles[0] ?? null;

        const loadedCommitments = (commitmentsBody.commitments ?? []).sort(
          (left, right) => left.rank - right.rank || right.updatedAt.localeCompare(left.updatedAt),
        );
        const plan = focusBody.plan ?? null;

        const planCycleIds = Array.from(
          new Set(
            loadedCommitments
              .filter((commitment) => (plan?.commitmentIds ?? []).includes(commitment.id))
              .map((commitment) => commitment.cycleId),
          ),
        );

        const nextHandoffCycleId =
          planCycleIds.length === 1
            ? planCycleIds[0]
            : (activeCycle?.id ?? planCycleIds[0] ?? null);

        setWeeklyCycles(loadedCycles);
        setWeeklyCommitments(loadedCommitments);
        setHandoffCycleId(nextHandoffCycleId);
        setDailyFocusPlan(plan);
        setSelectedCommitmentIds((plan?.commitmentIds ?? []).slice(0, 3));
        setSelectedTaskIds((plan?.taskIds ?? []).slice(0, 3));
        setDailyFocusNotes(plan?.notes ?? "");
      } catch (error) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error, "Could not load focus data."));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFocusData();

    return () => {
      cancelled = true;
    };
  }, [todayIso]);

  async function handleSaveDailyFocus() {
    setIsSaving(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/planning/daily-focus?date=${todayIso}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commitmentIds: selectedCommitmentIds,
          taskIds: selectedTaskIds,
          notes: dailyFocusNotes.trim() ? dailyFocusNotes.trim() : null,
        }),
      });

      const body = (await response.json()) as { plan?: DailyFocusPlan; error?: string };
      if (!response.ok || !body.plan) {
        throw new Error(body.error ?? "Could not save daily focus.");
      }

      setDailyFocusPlan(body.plan);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not save daily focus."));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSelectedCommitment(commitmentId: string) {
    setSelectedCommitmentIds((previous) => {
      if (previous.includes(commitmentId)) {
        return previous.filter((entry) => entry !== commitmentId);
      }
      if (previous.length >= 3) {
        return previous;
      }
      return [...previous, commitmentId];
    });
  }

  function toggleSelectedTask(taskId: string) {
    setSelectedTaskIds((previous) => {
      if (previous.includes(taskId)) {
        return previous.filter((entry) => entry !== taskId);
      }
      if (previous.length >= 3) {
        return previous;
      }
      return [...previous, taskId];
    });
  }

  function handleHandoffCycleChange(nextCycleId: string) {
    const normalizedCycleId = nextCycleId.length > 0 ? nextCycleId : null;
    setHandoffCycleId(normalizedCycleId);

    if (!normalizedCycleId) {
      return;
    }

    setSelectedCommitmentIds((previous) =>
      previous.filter((selectedId) =>
        weeklyCommitments.some((commitment) => commitment.id === selectedId && commitment.cycleId === normalizedCycleId),
      ),
    );
  }

  return (
    <section className="pdp-card pdp-card-mobile-flat mt-4 border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution Focus</p>
          <h4 className="text-sm font-semibold text-slate-900">Focus Today</h4>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        Pick up to 3 commitments and 3 tasks for today. Weekly planning stays in Planning workspace.
      </p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Planning handoff</p>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Cycle
            <select
              value={handoffCycleId ?? ""}
              onChange={(event) => handleHandoffCycleChange(event.target.value)}
              className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
            >
              <option value="">All weekly</option>
              {weeklyCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {formatCycleRange(cycle)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {hasMixedSelectedCommitmentCycles
            ? "Selected commitments currently span multiple weekly cycles. Pick one cycle for a cleaner daily focus."
            : handoffCycle
              ? `Current weekly context: ${formatCycleRange(handoffCycle)}.`
              : "Current weekly context: all weekly commitments."}
        </p>
      </div>

      {isLoading ? <p className="mt-2 text-xs text-slate-600">Loading focus options...</p> : null}
      {loadError ? <p className="mt-2 text-sm text-red-700">{loadError}</p> : null}
      {actionError ? <p className="mt-2 text-sm text-red-700">{actionError}</p> : null}

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Commitments ({selectedCommitmentIds.length}/3)
          </p>
          {cycleScopedCommitments.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600">No weekly commitments yet. Add them in Planning workspace.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {cycleScopedCommitments.map((commitment) => {
                const checked = selectedCommitmentIds.includes(commitment.id);
                const disabled = !checked && selectedCommitmentIds.length >= 3;
                return (
                  <li key={commitment.id}>
                    <label className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-sm ${checked ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"} ${disabled ? "opacity-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSelectedCommitment(commitment.id)}
                        className="mt-0.5 size-4 rounded border-slate-300"
                      />
                      <span>
                        <span className="font-semibold text-slate-800">#{commitment.rank}</span> {commitment.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tasks ({selectedTaskIds.length}/3)</p>
          {candidateTasks.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600">No active tasks available for focus selection.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {candidateTasks.map((task) => {
                const checked = selectedTaskIds.includes(task.id);
                const disabled = !checked && selectedTaskIds.length >= 3;
                return (
                  <li key={task.id}>
                    <div className={`rounded-md border px-2 py-2 ${checked ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"} ${disabled ? "opacity-50" : ""}`}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleSelectedTask(task.id)}
                          className="mt-0.5 size-4 rounded border-slate-300"
                        />
                        <span>
                          <span className="font-medium text-slate-800">{task.title}</span>
                          <span className="ml-1 text-xs text-slate-500">{task.dueDate ? `Due ${task.dueDate}` : "No due date"}</span>
                        </span>
                      </label>
                      {onOpenTask ? (
                        <button
                          type="button"
                          onClick={() => onOpenTask(task.id)}
                          className="mt-2 rounded-full border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Open task
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Focus notes</label>
        <textarea
          value={dailyFocusNotes}
          onChange={(event) => setDailyFocusNotes(event.target.value)}
          className="pdp-control mt-2 min-h-20 rounded-xl"
          placeholder="What must happen today to make real progress?"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          {dailyFocusPlan ? `Last saved ${new Date(dailyFocusPlan.updatedAt).toLocaleString()}` : "Not saved yet."}
        </p>
        <button
          type="button"
          onClick={() => void handleSaveDailyFocus()}
          disabled={isSaving}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Saving..." : "Save focus"}
        </button>
      </div>
    </section>
  );
}

function formatCycleRange(cycle: PlanningCycle) {
  return `${cycle.startDate} to ${cycle.endDate}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}
