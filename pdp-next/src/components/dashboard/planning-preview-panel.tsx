"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRightToLine,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type {
  Goal,
  PlanningCommitment,
  PlanningCommitmentDomain,
  PlanningCommitmentStatus,
  PlanningCycle,
  PlanningCycleType,
  Task,
} from "@/lib/domain/types";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { IconButton } from "@/components/ui/icon-button";

type CommitmentDraft = {
  title: string;
  domain: PlanningCommitmentDomain;
  linkedGoalId: string;
  status: PlanningCommitmentStatus;
};

type PlanningSurface = "weekly" | "quarterly" | "yearly" | "long_term";

type PlanningPreviewPanelProps = {
  goals: Goal[];
  tasks: Task[];
  surface: PlanningSurface;
};

const EMPTY_DRAFT: CommitmentDraft = {
  title: "",
  domain: "mixed",
  linkedGoalId: "",
  status: "not_started",
};
const LONG_TERM_GOALS_PAGE_SIZE = 6;
const LINKED_TASKS_PAGE_SIZE = 6;

export function PlanningPreviewPanel({ goals, tasks, surface }: PlanningPreviewPanelProps) {
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState<CommitmentDraft>({ ...EMPTY_DRAFT });
  const [saveAddInFlight, setSaveAddInFlight] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [longTermGoalsPage, setLongTermGoalsPage] = useState(1);
  const [viewedCycleId, setViewedCycleId] = useState<string | null>(null);
  const [isLoadingViewedCommitments, setIsLoadingViewedCommitments] = useState(false);
  const [isArchivingCycle, setIsArchivingCycle] = useState(false);
  const [isDeletingCycle, setIsDeletingCycle] = useState(false);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.deletedAt === null), [goals]);
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.deletedAt === null && task.status !== "done"),
    [tasks],
  );
  const goalTitleById = useMemo(
    () => new Map(activeGoals.map((goal) => [goal.id, goal.title])),
    [activeGoals],
  );

  const cycleType: PlanningCycleType =
    surface === "quarterly" ? "quarterly" : surface === "yearly" ? "yearly" : "weekly";
  const surfaceLabel =
    surface === "weekly" ? "week" : surface === "quarterly" ? "quarter" : surface === "yearly" ? "year" : "period";

  const activeCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === activeCycleId) ?? null,
    [activeCycleId, cycles],
  );

  const cycleCommitments = useMemo(
    () => commitments.filter((commitment) => commitment.cycleId === (viewedCycleId ?? activeCycleId)),
    [viewedCycleId, activeCycleId, commitments],
  );
  const sortedCycles = useMemo(
    () => [...cycles].sort((left, right) => right.startDate.localeCompare(left.startDate)),
    [cycles],
  );
  const previousCycle = useMemo(
    () => sortedCycles.find((cycle) => cycle.id !== activeCycleId) ?? null,
    [activeCycleId, sortedCycles],
  );
  const viewedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === (viewedCycleId ?? activeCycleId)) ?? null,
    [viewedCycleId, activeCycleId, cycles],
  );
  const viewedCycleIndex = useMemo(
    () => sortedCycles.findIndex((cycle) => cycle.id === (viewedCycleId ?? activeCycleId)),
    [sortedCycles, viewedCycleId, activeCycleId],
  );
  const isViewingHistory = viewedCycleId !== null && viewedCycleId !== activeCycleId;
  const canGoOlder = viewedCycleIndex !== -1 && viewedCycleIndex < sortedCycles.length - 1;
  const canGoNewer = viewedCycleIndex > 0;
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
    if (surface !== "quarterly") {
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
  }, [cycleCommitments, surface, tasksByCommitmentId]);

  const longTermGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.timeframeLevel === "vision_5y" || goal.timeframeLevel === "annual")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [activeGoals],
  );

  const focusGoals = useMemo(
    () => activeGoals.filter((goal) => goal.isFocus).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [activeGoals],
  );

  const longTermGoalsPageCount = useMemo(
    () => Math.max(1, Math.ceil(longTermGoals.length / LONG_TERM_GOALS_PAGE_SIZE)),
    [longTermGoals.length],
  );

  const pagedLongTermGoals = useMemo(() => {
    const start = (longTermGoalsPage - 1) * LONG_TERM_GOALS_PAGE_SIZE;
    return longTermGoals.slice(start, start + LONG_TERM_GOALS_PAGE_SIZE);
  }, [longTermGoals, longTermGoalsPage]);

  useEffect(() => {
    setLongTermGoalsPage(1);
  }, [surface]);

  useEffect(() => {
    if (longTermGoalsPage > longTermGoalsPageCount) {
      setLongTermGoalsPage(longTermGoalsPageCount);
    }
  }, [longTermGoalsPage, longTermGoalsPageCount]);

  useEffect(() => {
    if (surface === "long_term") {
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
        setViewedCycleId(selectedCycleId);
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
  }, [surface, cycleType, reloadKey]);

  async function handleNavigateToCycle(cycleId: string) {
    setViewedCycleId(cycleId);
    const alreadyLoaded = commitments.some((c) => c.cycleId === cycleId);
    if (alreadyLoaded) return;
    setIsLoadingViewedCommitments(true);
    try {
      const response = await fetch(
        `/api/planning/commitments?cycleId=${encodeURIComponent(cycleId)}&level=${cycleType}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as { commitments?: PlanningCommitment[]; error?: string };
      if (response.ok && body.commitments) {
        setCommitments((previous) => {
          const withoutDupes = previous.filter((c) => c.cycleId !== cycleId);
          return [...withoutDupes, ...(body.commitments as PlanningCommitment[])];
        });
      }
    } finally {
      setIsLoadingViewedCommitments(false);
    }
  }

  async function handleCreateCycle() {
    if (surface === "long_term") {
      return;
    }

    setIsCreatingCycle(true);
    setActionError(null);

    try {
      const now = new Date();
      const start =
        cycleType === "weekly" ? startOfWeekMonday(now) : cycleType === "quarterly" ? startOfQuarter(now) : startOfYear(now);
      const end =
        cycleType === "weekly" ? endOfWeekSunday(now) : cycleType === "quarterly" ? endOfQuarter(now) : endOfYear(now);

      const startIso = toIsoDate(start);
      const endIso = toIsoDate(end);

      // If a cycle for this exact date range already exists, navigate to it instead of creating a duplicate.
      const existing = sortedCycles.find(
        (cycle) => cycle.startDate === startIso && cycle.endDate === endIso,
      );
      if (existing) {
        setActiveCycleId(existing.id);
        setViewedCycleId(existing.id);
        setIsCreatingCycle(false);
        return;
      }

      const response = await fetch("/api/planning/cycles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cycleType,
          startDate: startIso,
          endDate: endIso,
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
      setViewedCycleId(body.cycle.id);
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

  async function handleArchiveViewedCycle() {
    if (!viewedCycle) return;
    setIsArchivingCycle(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/planning/cycles/${viewedCycle.id}/archive`, { method: "POST" });
      const body = (await response.json()) as { cycle?: PlanningCycle; error?: string };
      if (!response.ok || !body.cycle) {
        throw new Error(body.error ?? "Could not archive cycle.");
      }
      setCycles((previous) =>
        previous.map((c) => (c.id === body.cycle?.id ? (body.cycle as PlanningCycle) : c)),
      );
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not archive cycle."));
    } finally {
      setIsArchivingCycle(false);
    }
  }

  async function handleDeleteViewedCycle() {
    if (!viewedCycle) return;
    if (!window.confirm(`Delete the cycle ${viewedCycle.startDate} to ${viewedCycle.endDate}? This cannot be undone.`)) {
      return;
    }
    setIsDeletingCycle(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/planning/cycles/${viewedCycle.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not delete cycle.");
      }
      const deletedId = viewedCycle.id;
      const remaining = cycles.filter((c) => c.id !== deletedId);
      const nextViewed = remaining[0] ?? null;
      setCycles(remaining);
      setCommitments((previous) => previous.filter((c) => c.cycleId !== deletedId));
      if (activeCycleId === deletedId) {
        setActiveCycleId(nextViewed?.id ?? null);
      }
      setViewedCycleId(nextViewed?.id ?? null);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not delete cycle."));
    } finally {
      setIsDeletingCycle(false);
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

  async function handleAddCommitment() {
    if (!activeCycleId) {
      setActionError(`Create an active ${cycleType} cycle before saving commitments.`);
      return;
    }

    if (!addDraft.title.trim()) {
      setActionError("Commitment needs a title.");
      return;
    }

    setSaveAddInFlight(true);
    setActionError(null);

    const nextRank = cycleCommitments.length + 1;

    try {
      const response = await fetch("/api/planning/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: activeCycleId,
          level: cycleType,
          domain: addDraft.domain,
          title: addDraft.title.trim(),
          linkedGoalId: addDraft.linkedGoalId || null,
          rank: nextRank,
          status: addDraft.status,
          carryoverFromCommitmentId: null,
          confidenceScore: null,
        }),
      });

      const body = (await response.json()) as { commitment?: PlanningCommitment; error?: string };
      if (!response.ok || !body.commitment) {
        throw new Error(body.error ?? "Could not save commitment.");
      }

      setCommitments((previous) =>
        [...previous, body.commitment as PlanningCommitment].sort((left, right) => left.rank - right.rank),
      );
      setAddDraft({ ...EMPTY_DRAFT });
      setShowAddForm(false);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not save commitment."));
    } finally {
      setSaveAddInFlight(false);
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
      {surface === "long_term" ? (
        <>
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

          <div className="mt-3">
            <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Long-term anchors</p>
              {longTermGoals.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">No annual or vision goals yet. Add goals and set timeframe to Annual or Long-term.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-1">
                  {pagedLongTermGoals.map((goal) => (
                    <li key={goal.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm">
                      <p className="font-medium text-slate-900">{goal.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{getTimeframeLabel(goal.timeframeLevel)}</p>
                    </li>
                  ))}
                  </ul>
                  {longTermGoalsPageCount > 1 ? (
                    <PaginationControls
                      page={longTermGoalsPage}
                      pageCount={longTermGoalsPageCount}
                      onPrevious={() => setLongTermGoalsPage((page) => Math.max(1, page - 1))}
                      onNext={() => setLongTermGoalsPage((page) => Math.min(longTermGoalsPageCount, page + 1))}
                      className="mt-2"
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {viewedCycle ? (
                  <>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {viewedCycle.startDate} to {viewedCycle.endDate}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        viewedCycle.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {viewedCycle.status}
                    </span>
                    {isViewingHistory ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Historical
                      </span>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-slate-600">No {surfaceLabel} cycles yet.</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  onClick={() => {
                    const target = sortedCycles[viewedCycleIndex + 1];
                    if (target) void handleNavigateToCycle(target.id);
                  }}
                  disabled={!canGoOlder}
                  title="Older period"
                >
                  <ChevronLeft className="h-4 w-4" />
                </IconButton>
                <IconButton
                  onClick={() => {
                    const target = sortedCycles[viewedCycleIndex - 1];
                    if (target) void handleNavigateToCycle(target.id);
                  }}
                  disabled={!canGoNewer}
                  title="Newer period"
                >
                  <ChevronRight className="h-4 w-4" />
                </IconButton>
                {isViewingHistory && activeCycleId ? (
                  <IconButton
                    onClick={() => void handleNavigateToCycle(activeCycleId)}
                    title="Jump to current period"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </IconButton>
                ) : null}
                {viewedCycle && viewedCycle.status !== "archived" ? (
                  <IconButton
                    onClick={() => void handleArchiveViewedCycle()}
                    disabled={isArchivingCycle}
                    title="Archive this cycle"
                  >
                    {isArchivingCycle
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Archive className="h-4 w-4" />}
                  </IconButton>
                ) : null}
                {viewedCycle ? (
                  <IconButton
                    onClick={() => void handleDeleteViewedCycle()}
                    disabled={isDeletingCycle}
                    title="Permanently delete this cycle"
                    variant="danger"
                  >
                    {isDeletingCycle
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </IconButton>
                ) : null}
                {!isViewingHistory ? (
                  <>
                    <IconButton
                      onClick={() => void handleCreateCycle()}
                      disabled={isCreatingCycle}
                      title={activeCycle ? `Reset to current ${surfaceLabel}` : `Start this ${surfaceLabel}`}
                    >
                      {isCreatingCycle
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />}
                    </IconButton>
                    <IconButton
                      onClick={() => void handleCloseActiveCycle()}
                      disabled={!activeCycle || activeCycle.status !== "active" || isClosingCycle}
                      title={`Mark ${surfaceLabel} complete`}
                    >
                      {isClosingCycle
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />}
                    </IconButton>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {isLoading || isLoadingViewedCommitments ? <p className="mt-2 text-xs text-slate-500">Loading planning data...</p> : null}
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

          {activeCycle?.status === "active" && !isViewingHistory ? (
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
                <ul className="mt-2 space-y-1">
                  {carryoverCandidates
                    .sort((left, right) => left.rank - right.rank)
                    .map((commitment) => (
                      <li key={commitment.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">
                              #{commitment.rank} {commitment.title}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                              {commitment.domain} | {commitment.status.replace("_", " ")}
                            </p>
                          </div>
                          <IconButton
                            onClick={() => void handleCarryoverCommitment(commitment.id)}
                            disabled={carryoverInFlightId === commitment.id}
                            title="Carry forward to current cycle"
                          >
                            {carryoverInFlightId === commitment.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <ArrowRightToLine className="h-4 w-4" />}
                          </IconButton>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="mt-3">
            {showAddForm && !isViewingHistory ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New Commitment</p>
                  <input
                    value={addDraft.title}
                    onChange={(event) => setAddDraft((previous) => ({ ...previous, title: event.target.value }))}
                    className="pdp-control mt-2 rounded-xl"
                    placeholder="Commitment description"
                    maxLength={120}
                    autoFocus
                  />
                  <select
                    value={addDraft.domain}
                    onChange={(event) =>
                      setAddDraft((previous) => ({ ...previous, domain: event.target.value as PlanningCommitmentDomain }))
                    }
                    className="pdp-control mt-2 rounded-xl"
                  >
                    <option value="mixed">Mixed</option>
                    <option value="professional">Professional</option>
                    <option value="personal">Personal</option>
                  </select>
                  <select
                    value={addDraft.linkedGoalId}
                    onChange={(event) =>
                      setAddDraft((previous) => ({ ...previous, linkedGoalId: event.target.value }))
                    }
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
                    value={addDraft.status}
                    onChange={(event) =>
                      setAddDraft((previous) => ({ ...previous, status: event.target.value as PlanningCommitmentStatus }))
                    }
                    className="pdp-control mt-2 rounded-xl"
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                    <option value="dropped">Dropped</option>
                  </select>
                  <div className="mt-3 flex gap-2">
                    <IconButton
                      onClick={() => void handleAddCommitment()}
                      disabled={saveAddInFlight}
                      title="Save commitment"
                      variant="success"
                    >
                      {saveAddInFlight
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Check className="h-4 w-4" />}
                    </IconButton>
                    <IconButton
                      onClick={() => {
                        setShowAddForm(false);
                        setAddDraft({ ...EMPTY_DRAFT });
                      }}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              ) : !isViewingHistory ? (
                <IconButton
                  onClick={() => setShowAddForm(true)}
                  disabled={!activeCycleId}
                  title="Add commitment"
                  variant="add"
                >
                  <Plus className="h-4 w-4" />
                </IconButton>
              ) : null}

            {cycleCommitments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {[...cycleCommitments]
                  .sort((left, right) => left.rank - right.rank)
                  .map((commitment) => {
                    const linkedTasks = tasksByCommitmentId.get(commitment.id) ?? [];
                    const linkedGoalTitle = commitment.linkedGoalId ? goalTitleById.get(commitment.linkedGoalId) : null;

                    return (
                      <li key={commitment.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
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
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                              {linkedTasks.length} task{linkedTasks.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                        {linkedTasks.length > 0 ? (
                          <PaginatedLinkedTasksList tasks={linkedTasks} />
                        ) : (
                          <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                            No tasks linked yet.
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

function PaginatedLinkedTasksList({ tasks }: { tasks: Task[] }) {
  const [page, setPage] = useState(1);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(tasks.length / LINKED_TASKS_PAGE_SIZE)),
    [tasks.length],
  );

  const pagedTasks = useMemo(() => {
    const start = (page - 1) * LINKED_TASKS_PAGE_SIZE;
    return tasks.slice(start, start + LINKED_TASKS_PAGE_SIZE);
  }, [page, tasks]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  return (
    <>
      <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
        {pagedTasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-700">{task.title}</span>
            <span>{task.dueDate ? `Due ${task.dueDate}` : "No due date"}</span>
          </li>
        ))}
      </ul>

      {pageCount > 1 ? (
        <PaginationControls
          page={page}
          pageCount={pageCount}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
          className="mt-2"
        />
      ) : null}
    </>
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

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31);
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
