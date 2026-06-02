"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Goal,
  PlanningCommitment,
  PlanningCommitmentDomain,
  PlanningCommitmentStatus,
  PlanningCycle,
  PlanningCycleType,
  Task,
} from "@/lib/domain/types";

type CommitmentDraft = {
  title: string;
  domain: PlanningCommitmentDomain;
  linkedGoalId: string;
  status: PlanningCommitmentStatus;
};

type PlanningSurface = "weekly" | "quarterly" | "long_term";

type PlanningPreviewPanelProps = {
  goals: Goal[];
  tasks: Task[];
};

const EMPTY_DRAFT: CommitmentDraft = {
  title: "",
  domain: "mixed",
  linkedGoalId: "",
  status: "not_started",
};

export function PlanningPreviewPanel({ goals, tasks }: PlanningPreviewPanelProps) {
  const [planningSurface, setPlanningSurface] = useState<PlanningSurface>("weekly");
  const [cycles, setCycles] = useState<PlanningCycle[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<PlanningCommitment[]>([]);
  const [previousCycleCommitments, setPreviousCycleCommitments] = useState<PlanningCommitment[]>([]);
  const [draftByRank, setDraftByRank] = useState<Record<1 | 2 | 3, CommitmentDraft>>({
    1: { ...EMPTY_DRAFT },
    2: { ...EMPTY_DRAFT },
    3: { ...EMPTY_DRAFT },
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingCycle, setIsCreatingCycle] = useState(false);
  const [isClosingCycle, setIsClosingCycle] = useState(false);
  const [saveRankInFlight, setSaveRankInFlight] = useState<1 | 2 | 3 | null>(null);
  const [carryoverInFlightId, setCarryoverInFlightId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.deletedAt === null), [goals]);
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.deletedAt === null && task.status !== "done"),
    [tasks],
  );
  const goalTitleById = useMemo(
    () => new Map(activeGoals.map((goal) => [goal.id, goal.title])),
    [activeGoals],
  );

  const cycleType: PlanningCycleType = planningSurface === "quarterly" ? "quarterly" : "weekly";

  const activeCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === activeCycleId) ?? null,
    [activeCycleId, cycles],
  );

  const cycleCommitments = useMemo(
    () => commitments.filter((commitment) => commitment.cycleId === activeCycleId),
    [activeCycleId, commitments],
  );
  const sortedCycles = useMemo(
    () => [...cycles].sort((left, right) => right.startDate.localeCompare(left.startDate)),
    [cycles],
  );
  const previousCycle = useMemo(
    () => sortedCycles.find((cycle) => cycle.id !== activeCycleId) ?? null,
    [activeCycleId, sortedCycles],
  );
  const carryoverCandidates = useMemo(() => {
    const alreadyCarriedSourceIds = new Set(
      cycleCommitments
        .map((commitment) => commitment.carryoverFromCommitmentId)
        .filter((value): value is string => Boolean(value)),
    );

    return previousCycleCommitments.filter(
      (commitment) => commitment.status !== "done" && !alreadyCarriedSourceIds.has(commitment.id),
    );
  }, [cycleCommitments, previousCycleCommitments]);
  const tasksByCommitmentId = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    for (const task of activeTasks) {
      if (!task.commitmentId) {
        continue;
      }

      const existing = grouped.get(task.commitmentId) ?? [];
      existing.push(task);
      grouped.set(task.commitmentId, existing);
    }

    for (const entries of grouped.values()) {
      entries.sort((left, right) => {
        if (left.dueDate && right.dueDate) {
          return left.dueDate.localeCompare(right.dueDate);
        }
        if (left.dueDate) {
          return -1;
        }
        if (right.dueDate) {
          return 1;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      });
    }

    return grouped;
  }, [activeTasks]);
  const quarterlyRollup = useMemo(() => {
    if (planningSurface !== "quarterly") {
      return null;
    }

    const total = cycleCommitments.length;
    const done = cycleCommitments.filter((commitment) => commitment.status === "done").length;
    const inProgress = cycleCommitments.filter((commitment) => commitment.status === "in_progress").length;
    const notStarted = cycleCommitments.filter((commitment) => commitment.status === "not_started").length;
    const dropped = cycleCommitments.filter((commitment) => commitment.status === "dropped").length;
    const linkedTaskCount = cycleCommitments.reduce(
      (sum, commitment) => sum + (tasksByCommitmentId.get(commitment.id)?.length ?? 0),
      0,
    );

    const confidenceScores = cycleCommitments
      .map((commitment) => commitment.confidenceScore)
      .filter((score): score is number => score !== null);
    const averageConfidence =
      confidenceScores.length > 0
        ? Math.round((confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length) * 100)
        : null;

    return {
      total,
      done,
      inProgress,
      notStarted,
      dropped,
      linkedTaskCount,
      averageConfidence,
    };
  }, [cycleCommitments, planningSurface, tasksByCommitmentId]);

  const longTermGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.timeframeLevel === "vision_5y" || goal.timeframeLevel === "annual")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 8),
    [activeGoals],
  );

  const focusGoals = useMemo(
    () => activeGoals.filter((goal) => goal.isFocus).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [activeGoals],
  );

  useEffect(() => {
    if (planningSurface === "long_term") {
      return;
    }

    let cancelled = false;

    async function loadPlanningData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const cyclesResponse = await fetch(`/api/planning/cycles?cycleType=${cycleType}`, { cache: "no-store" });
        const cyclesBody = (await cyclesResponse.json()) as { cycles?: PlanningCycle[]; error?: string };
        if (!cyclesResponse.ok) {
          throw new Error(cyclesBody.error ?? "Could not load planning cycles.");
        }

        const loadedCycles = cyclesBody.cycles ?? [];
        const sortedLoadedCycles = [...loadedCycles].sort((left, right) => right.startDate.localeCompare(left.startDate));
        const nextCycle =
          loadedCycles.find((cycle) => cycle.status === "active") ??
          sortedLoadedCycles[0] ??
          null;
        const selectedCycleId = nextCycle?.id ?? null;
        const nextPreviousCycle = sortedLoadedCycles.find((cycle) => cycle.id !== selectedCycleId) ?? null;

        let loadedCommitments: PlanningCommitment[] = [];
        if (selectedCycleId) {
          const commitmentsResponse = await fetch(
            `/api/planning/commitments?cycleId=${encodeURIComponent(selectedCycleId)}&level=${cycleType}`,
            { cache: "no-store" },
          );
          const commitmentsBody = (await commitmentsResponse.json()) as {
            commitments?: PlanningCommitment[];
            error?: string;
          };

          if (!commitmentsResponse.ok) {
            throw new Error(commitmentsBody.error ?? "Could not load planning commitments.");
          }

          loadedCommitments = commitmentsBody.commitments ?? [];
        }

        let loadedPreviousCycleCommitments: PlanningCommitment[] = [];
        if (nextPreviousCycle) {
          try {
            const previousCommitmentsResponse = await fetch(
              `/api/planning/commitments?cycleId=${encodeURIComponent(nextPreviousCycle.id)}&level=${cycleType}`,
              { cache: "no-store" },
            );
            const previousCommitmentsBody = (await previousCommitmentsResponse.json()) as {
              commitments?: PlanningCommitment[];
              error?: string;
            };

            if (!previousCommitmentsResponse.ok) {
              throw new Error(previousCommitmentsBody.error ?? "Could not load previous planning commitments.");
            }

            loadedPreviousCycleCommitments = previousCommitmentsBody.commitments ?? [];
          } catch {
            loadedPreviousCycleCommitments = [];
          }
        }

        if (cancelled) {
          return;
        }

        setCycles(loadedCycles);
        setActiveCycleId(selectedCycleId);
        setCommitments(loadedCommitments);
        setPreviousCycleCommitments(loadedPreviousCycleCommitments);
        setDraftByRank(buildDraftsFromCommitments(loadedCommitments));
      } catch (error) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error, "Could not load planning view."));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPlanningData();

    return () => {
      cancelled = true;
    };
  }, [planningSurface, cycleType, reloadKey]);

  async function handleCreateCycle() {
    if (planningSurface === "long_term") {
      return;
    }

    setIsCreatingCycle(true);
    setActionError(null);

    try {
      const now = new Date();
      const start = cycleType === "weekly" ? startOfWeekMonday(now) : startOfQuarter(now);
      const end = cycleType === "weekly" ? endOfWeekSunday(now) : endOfQuarter(now);

      const response = await fetch("/api/planning/cycles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cycleType,
          startDate: toIsoDate(start),
          endDate: toIsoDate(end),
          status: "active",
          reviewSummary: null,
        }),
      });

      const body = (await response.json()) as { cycle?: PlanningCycle; error?: string };
      if (!response.ok || !body.cycle) {
        throw new Error(body.error ?? `Could not create ${cycleType} planning cycle.`);
      }

      setCycles((previous) => [body.cycle as PlanningCycle, ...previous]);
      setActiveCycleId(body.cycle.id);
      setCommitments([]);
      setDraftByRank(buildDraftsFromCommitments([]));
    } catch (error) {
      setActionError(getErrorMessage(error, `Could not create ${cycleType} planning cycle.`));
    } finally {
      setIsCreatingCycle(false);
    }
  }

  async function handleSaveRankCommitment(rank: 1 | 2 | 3) {
    if (!activeCycleId) {
      setActionError(`Create an active ${cycleType} cycle before saving commitments.`);
      return;
    }

    const draft = draftByRank[rank];
    const existing = cycleCommitments.find((entry) => entry.rank === rank) ?? null;

    if (!draft.title.trim()) {
      setActionError(`Priority ${rank} needs a title.`);
      return;
    }

    setSaveRankInFlight(rank);
    setActionError(null);

    try {
      const payload = {
        cycleId: activeCycleId,
        level: cycleType,
        domain: draft.domain,
        title: draft.title.trim(),
        linkedGoalId: draft.linkedGoalId || null,
        rank,
        status: draft.status,
        carryoverFromCommitmentId: existing?.carryoverFromCommitmentId ?? null,
        confidenceScore: existing?.confidenceScore ?? null,
      };

      const response = await fetch(
        existing ? `/api/planning/commitments/${existing.id}` : "/api/planning/commitments",
        {
          method: existing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as { commitment?: PlanningCommitment; error?: string };
      if (!response.ok || !body.commitment) {
        throw new Error(body.error ?? `Could not save priority ${rank}.`);
      }

      setCommitments((previous) => {
        const withoutOld = previous.filter((entry) => entry.id !== existing?.id && entry.id !== body.commitment?.id);
        return [...withoutOld, body.commitment as PlanningCommitment].sort((left, right) => left.rank - right.rank);
      });
    } catch (error) {
      setActionError(getErrorMessage(error, `Could not save priority ${rank}.`));
    } finally {
      setSaveRankInFlight(null);
    }
  }

  async function handleCloseActiveCycle() {
    if (!activeCycleId || !activeCycle || activeCycle.status !== "active") {
      return;
    }

    setIsClosingCycle(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/planning/cycles/${activeCycleId}/complete`, {
        method: "POST",
      });

      const body = (await response.json()) as { cycle?: PlanningCycle; error?: string };
      if (!response.ok || !body.cycle) {
        throw new Error(body.error ?? `Could not close this ${cycleType} cycle.`);
      }

      setCycles((previous) =>
        previous.map((cycle) =>
          cycle.id === body.cycle?.id
            ? (body.cycle as PlanningCycle)
            : cycle,
        ),
      );
    } catch (error) {
      setActionError(getErrorMessage(error, `Could not close this ${cycleType} cycle.`));
    } finally {
      setIsClosingCycle(false);
    }
  }

  async function handleCarryoverCommitment(commitmentId: string) {
    setCarryoverInFlightId(commitmentId);
    setActionError(null);

    try {
      const response = await fetch(`/api/planning/commitments/${commitmentId}/carryover`, {
        method: "POST",
      });
      const body = (await response.json()) as { commitment?: PlanningCommitment; error?: string };
      if (!response.ok || !body.commitment) {
        throw new Error(body.error ?? "Could not carry commitment forward.");
      }

      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not carry commitment forward."));
    } finally {
      setCarryoverInFlightId(null);
    }
  }

  function updateDraft(rank: 1 | 2 | 3, next: Partial<CommitmentDraft>) {
    setDraftByRank((previous) => ({
      ...previous,
      [rank]: {
        ...previous[rank],
        ...next,
      },
    }));
  }

  return (
    <article className="pdp-panel-muted pdp-panel-muted-mobile-flat mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planning Architecture</p>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Planning Workspace</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["weekly", "Weekly"],
            ["quarterly", "Quarterly"],
            ["long_term", "Long-term"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlanningSurface(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                planningSurface === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {planningSurface === "long_term" ? (
        <>
          <p className="mt-2 text-xs text-slate-600">
            Define longer-horizon direction here. Daily execution is handled in Today workspace.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vision / 5Y goals</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {activeGoals.filter((goal) => goal.timeframeLevel === "vision_5y").length}
              </p>
            </div>
            <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Annual goals</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {activeGoals.filter((goal) => goal.timeframeLevel === "annual").length}
              </p>
            </div>
            <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Focus goals</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{focusGoals.length}</p>
            </div>
            <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active tasks</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{activeTasks.length}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Long-term anchors</p>
              {longTermGoals.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">No annual or vision goals yet. Add goals and set timeframe to Annual or Long-term.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {longTermGoals.map((goal) => (
                    <li key={goal.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm">
                      <p className="font-medium text-slate-900">{goal.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{getTimeframeLabel(goal.timeframeLevel)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How this flows</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                <li>Define long-term direction (vision and annual goals).</li>
                <li>Translate direction into quarterly priorities.</li>
                <li>Break quarterly priorities into weekly commitments.</li>
                <li>Select today&apos;s focus inside Today workspace.</li>
              </ol>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-600">
            Set your {planningSurface} priorities here. Execution-level selection is now handled in Today workspace.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3">
            {activeCycle ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {activeCycle.startDate} to {activeCycle.endDate}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    activeCycle.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {activeCycle.status}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-600">No active {planningSurface} cycle yet.</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCreateCycle()}
                disabled={isCreatingCycle}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingCycle ? "Creating..." : activeCycle ? `Reset to current ${planningSurface}` : `Start this ${planningSurface}`}
              </button>
              <button
                type="button"
                onClick={() => void handleCloseActiveCycle()}
                disabled={!activeCycle || activeCycle.status !== "active" || isClosingCycle}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isClosingCycle ? "Closing..." : `Close ${planningSurface}`}
              </button>
            </div>
          </div>

          {isLoading ? <p className="mt-2 text-xs text-slate-500">Loading planning data...</p> : null}
          {loadError ? <p className="mt-2 text-sm text-red-700">{loadError}</p> : null}
          {actionError ? <p className="mt-2 text-sm text-red-700">{actionError}</p> : null}

          {quarterlyRollup ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quarterly rollup</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  {quarterlyRollup.total} total
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  {quarterlyRollup.done} done
                </span>
                <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  {quarterlyRollup.inProgress} in progress
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  {quarterlyRollup.notStarted} not started
                </span>
                <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                  {quarterlyRollup.dropped} dropped
                </span>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  {quarterlyRollup.linkedTaskCount} linked tasks
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Avg confidence: {quarterlyRollup.averageConfidence === null ? "N/A" : `${quarterlyRollup.averageConfidence}%`}
              </p>
            </div>
          ) : null}

          {activeCycle?.status === "active" ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Carryover from previous cycle</p>
              {previousCycle ? (
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                  Source cycle: {previousCycle.startDate} to {previousCycle.endDate}
                </p>
              ) : null}

              {carryoverCandidates.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">No carryover candidates right now.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {carryoverCandidates
                    .sort((left, right) => left.rank - right.rank)
                    .map((commitment) => (
                      <li key={commitment.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">
                              #{commitment.rank} {commitment.title}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                              {commitment.domain} | {commitment.status.replace("_", " ")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCarryoverCommitment(commitment.id)}
                            disabled={carryoverInFlightId === commitment.id}
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {carryoverInFlightId === commitment.id ? "Carrying..." : "Carry forward"}
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {([1, 2, 3] as const).map((rank) => {
              const draft = draftByRank[rank];
              const existing = cycleCommitments.find((entry) => entry.rank === rank) ?? null;
              return (
                <div key={rank} className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Priority {rank}</p>
                  <input
                    value={draft.title}
                    onChange={(event) => updateDraft(rank, { title: event.target.value })}
                    className="pdp-control mt-2 rounded-xl"
                    placeholder={`Priority ${rank} commitment`}
                    maxLength={120}
                  />
                  <select
                    value={draft.domain}
                    onChange={(event) => updateDraft(rank, { domain: event.target.value as PlanningCommitmentDomain })}
                    className="pdp-control mt-2 rounded-xl"
                  >
                    <option value="mixed">Mixed</option>
                    <option value="professional">Professional</option>
                    <option value="personal">Personal</option>
                  </select>
                  <select
                    value={draft.linkedGoalId}
                    onChange={(event) => updateDraft(rank, { linkedGoalId: event.target.value })}
                    className="pdp-control mt-2 rounded-xl"
                  >
                    <option value="">No linked goal</option>
                    {activeGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.status}
                    onChange={(event) => updateDraft(rank, { status: event.target.value as PlanningCommitmentStatus })}
                    className="pdp-control mt-2 rounded-xl"
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                    <option value="dropped">Dropped</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleSaveRankCommitment(rank)}
                    disabled={!activeCycleId || saveRankInFlight === rank}
                    className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveRankInFlight === rank ? "Saving..." : existing ? "Update" : "Save"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current {planningSurface} commitments
            </p>
            {cycleCommitments.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">No commitments saved yet for this cycle.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {cycleCommitments
                  .sort((left, right) => left.rank - right.rank)
                  .map((commitment) => {
                    const linkedTasks = tasksByCommitmentId.get(commitment.id) ?? [];
                    const linkedGoalTitle = commitment.linkedGoalId ? goalTitleById.get(commitment.linkedGoalId) : null;

                    return (
                      <li key={commitment.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">
                              #{commitment.rank} {commitment.title}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                              {commitment.domain} | {commitment.status.replace("_", " ")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {linkedGoalTitle ? (
                              <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                                Goal: {linkedGoalTitle}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                              {linkedTasks.length} task{linkedTasks.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                        {linkedTasks.length > 0 ? (
                          <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                            {linkedTasks.slice(0, 3).map((task) => (
                              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium text-slate-700">{task.title}</span>
                                <span>{task.dueDate ? `Due ${task.dueDate}` : "No due date"}</span>
                              </li>
                            ))}
                            {linkedTasks.length > 3 ? (
                              <li className="text-[11px] uppercase tracking-wide text-slate-500">
                                +{linkedTasks.length - 3} more linked tasks
                              </li>
                            ) : null}
                          </ul>
                        ) : (
                          <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                            No tasks linked yet. Add execution tasks against this commitment from Planning or Today.
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function startOfWeekMonday(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const shift = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - shift);
  return normalized;
}

function endOfWeekSunday(date: Date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function startOfQuarter(date: Date) {
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

function endOfQuarter(date: Date) {
  const start = startOfQuarter(date);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
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

function buildDraftsFromCommitments(commitments: PlanningCommitment[]) {
  const nextDrafts: Record<1 | 2 | 3, CommitmentDraft> = {
    1: { ...EMPTY_DRAFT },
    2: { ...EMPTY_DRAFT },
    3: { ...EMPTY_DRAFT },
  };

  for (const rank of [1, 2, 3] as const) {
    const commitment = commitments.find((entry) => entry.rank === rank);
    if (!commitment) {
      continue;
    }

    nextDrafts[rank] = {
      title: commitment.title,
      domain: commitment.domain,
      linkedGoalId: commitment.linkedGoalId ?? "",
      status: commitment.status,
    };
  }

  return nextDrafts;
}

function getTimeframeLabel(timeframeLevel: Goal["timeframeLevel"]) {
  if (timeframeLevel === "vision_5y") {
    return "Long-term";
  }

  if (timeframeLevel === "annual") {
    return "Annual";
  }

  if (timeframeLevel === "quarterly") {
    return "Quarterly";
  }

  if (timeframeLevel === "monthly") {
    return "Monthly";
  }

  return "Weekly";
}
