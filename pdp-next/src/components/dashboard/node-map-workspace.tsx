"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNodeGraphModel, type NodeGraphForceProfile } from "@/components/dashboard/node-map/graph-adapter";
import { NodeGraphCanvas } from "@/components/dashboard/node-map/node-graph-canvas";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Goal, GoalTimeframeLevel, GoalType, ItemStatus, Task } from "@/lib/domain/types";

type TimeframeFilter = "all" | GoalTimeframeLevel;
type TypeFilter = "all" | GoalType;
type StatusFilter = "all" | ItemStatus;

const TIMEFRAME_ORDER: GoalTimeframeLevel[] = ["vision_5y", "annual", "quarterly", "monthly", "weekly"];

const TIMEFRAME_LABELS: Record<GoalTimeframeLevel, string> = {
  vision_5y: "Long-term",
  annual: "Yearly",
  quarterly: "Quarterly",
  monthly: "Monthly",
  weekly: "Weekly",
};

export function NodeMapWorkspace({
  onOpenItem,
}: {
  onOpenItem?: (kind: "goal" | "task", id: string) => void;
}) {
  const { user, isLoading, error } = db.useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [forceProfile, setForceProfile] = useState<NodeGraphForceProfile>("balanced");
  const [includeFreestandingTasks, setIncludeFreestandingTasks] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [timeframePanelState, setTimeframePanelState] = useState<Record<GoalTimeframeLevel, boolean>>({
    vision_5y: false,
    annual: false,
    quarterly: false,
    monthly: false,
    weekly: false,
  });
  const [isRelationshipPanelOpen, setIsRelationshipPanelOpen] = useState(false);
  const [isFreestandingPanelOpen, setIsFreestandingPanelOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const syncFilterPanel = () => {
      setIsFilterPanelOpen(!mobileQuery.matches);
    };

    syncFilterPanel();

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncFilterPanel);
    } else {
      mobileQuery.addListener(syncFilterPanel);
    }

    return () => {
      if (typeof mobileQuery.removeEventListener === "function") {
        mobileQuery.removeEventListener("change", syncFilterPanel);
      } else {
        mobileQuery.removeListener(syncFilterPanel);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;

    let cancelled = false;

    async function loadData() {
      setIsRefreshing(true);
      setLoadError(null);

      try {
        const [professionalGoals, personalGoals] = await Promise.all([
          dataRepository.listGoals(currentUser.id, "professional"),
          dataRepository.listGoals(currentUser.id, "personal"),
        ]);
        const nextGoals = [...professionalGoals, ...personalGoals];
        const activeGoals = nextGoals.filter((goal) => !goal.deletedAt);

        if (activeGoals.length === 0) {
          if (!cancelled) {
            setGoals([]);
            setTasks([]);
          }
          return;
        }

        const taskGroups = await Promise.all(
          activeGoals.map((goal) => dataRepository.listTasks(currentUser.id, goal.id)),
        );
        const nextTasks = uniqueById(taskGroups.flat()).filter((task) => !task.deletedAt);

        if (!cancelled) {
          setGoals(activeGoals);
          setTasks(nextTasks);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setLoadError(toErrorMessage(caughtError, "Could not load node map data."));
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const goalMap = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);

  const filteredGoals = useMemo(() => {
    return goals
      .filter((goal) => (timeframeFilter === "all" ? true : goal.timeframeLevel === timeframeFilter))
      .filter((goal) => (typeFilter === "all" ? true : goal.type === typeFilter))
      .filter((goal) => (statusFilter === "all" ? true : goal.status === statusFilter));
  }, [goals, statusFilter, timeframeFilter, typeFilter]);

  const filteredGoalIds = useMemo(() => new Set(filteredGoals.map((goal) => goal.id)), [filteredGoals]);

  const tasksByGoalId = useMemo(() => {
    const bucket = new Map<string, Task[]>();

    for (const task of tasks) {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        continue;
      }

      const parentGoal = goalMap.get(task.goalId);
      if (!parentGoal) {
        continue;
      }

      if (statusFilter !== "all" && parentGoal.status !== statusFilter) {
        continue;
      }

      if (!filteredGoalIds.has(parentGoal.id)) {
        continue;
      }

      const existing = bucket.get(parentGoal.id) ?? [];
      existing.push(task);
      bucket.set(parentGoal.id, existing);
    }

    return bucket;
  }, [filteredGoalIds, goalMap, statusFilter, tasks]);

  const childGoalCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const goal of filteredGoals) {
      if (!goal.parentGoalId) {
        continue;
      }
      counts.set(goal.parentGoalId, (counts.get(goal.parentGoalId) ?? 0) + 1);
    }
    return counts;
  }, [filteredGoals]);

  const goalsByTimeframe = useMemo(() => {
    const grouped = new Map<GoalTimeframeLevel, Goal[]>();
    for (const level of TIMEFRAME_ORDER) {
      grouped.set(level, []);
    }

    for (const goal of filteredGoals) {
      const bucket = grouped.get(goal.timeframeLevel) ?? [];
      bucket.push(goal);
      grouped.set(goal.timeframeLevel, bucket);
    }

    for (const level of TIMEFRAME_ORDER) {
      grouped.set(
        level,
        (grouped.get(level) ?? []).slice().sort((a, b) => {
          if (a.orderIndex !== b.orderIndex) {
            return a.orderIndex - b.orderIndex;
          }
          return a.title.localeCompare(b.title);
        }),
      );
    }

    return grouped;
  }, [filteredGoals]);

  const freestandingTasks = useMemo(() => {
    if (!includeFreestandingTasks) {
      return [];
    }

    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      return !goalMap.has(task.goalId);
    });
  }, [goalMap, includeFreestandingTasks, statusFilter, tasks]);

  const relationshipRows = useMemo(() => {
    return filteredGoals
      .filter((goal) => goal.parentGoalId && filteredGoalIds.has(goal.parentGoalId))
      .map((goal) => ({
        childId: goal.id,
        childTitle: goal.title,
        parentId: goal.parentGoalId as string,
        parentTitle: goalMap.get(goal.parentGoalId ?? "")?.title ?? "Unknown parent",
      }))
      .sort((a, b) => a.parentTitle.localeCompare(b.parentTitle) || a.childTitle.localeCompare(b.childTitle));
  }, [filteredGoalIds, filteredGoals, goalMap]);

  const graphTasks = useMemo(() => {
    const linkedTasks = Array.from(tasksByGoalId.values()).flat();
    return uniqueById(includeFreestandingTasks ? [...linkedTasks, ...freestandingTasks] : linkedTasks);
  }, [freestandingTasks, includeFreestandingTasks, tasksByGoalId]);

  const graphModel = useMemo(
    () =>
      buildNodeGraphModel({
        goals: filteredGoals,
        tasks: graphTasks,
        timeframeOrder: TIMEFRAME_ORDER,
        includeFreestandingTasks,
        forceProfile,
      }),
    [filteredGoals, forceProfile, graphTasks, includeFreestandingTasks],
  );

  if (isLoading) {
    return (
      <section className="pdp-panel">
        <h2 className="pdp-section-title text-slate-900">Loading node map...</h2>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pdp-panel">
        <h2 className="pdp-section-title text-slate-900">Sign in to view your node map.</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pdp-panel">
        <h2 className="pdp-section-title text-slate-900">Unable to load node map.</h2>
        <p className="mt-2 text-sm text-slate-700">{toErrorMessage(error, "Authentication error.")}</p>
      </section>
    );
  }

  return (
    <section className="pdp-panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="pdp-section-title text-slate-900">Node Map</h2>
          <p className="mt-1 text-sm text-slate-600">
            Explore parent-child goal links and task concentration across timeline levels.
          </p>
        </div>
      </div>

      {loadError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">NODE MAP FILTERS</p>
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen((current) => !current)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {isFilterPanelOpen ? "Hide filters" : "Show filters"}
          </button>
        </div>

        {isFilterPanelOpen ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Timeframe</p>
              <select
                value={timeframeFilter}
                onChange={(event) => setTimeframeFilter(event.target.value as TimeframeFilter)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="all">All levels</option>
                {TIMEFRAME_ORDER.map((level) => (
                  <option key={level} value={level}>
                    {TIMEFRAME_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Goal Type</p>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="all">All goal types</option>
                <option value="professional">Professional</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="all">All statuses</option>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeFreestandingTasks}
                onChange={(event) => setIncludeFreestandingTasks(event.target.checked)}
              />
              Include Freestanding Tasks
            </label>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Visible Goals" value={String(filteredGoals.length)} />
        <StatCard
          label="Goal Links"
          value={String(relationshipRows.length)}
          helper="child -> parent relationships"
        />
        <StatCard
          label="Linked Tasks"
          value={String(Array.from(tasksByGoalId.values()).reduce((sum, next) => sum + next.length, 0))}
          helper={isRefreshing ? "refreshing..." : "active filter scope"}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layout Density</p>
          <div className="inline-flex rounded-full border border-slate-300 bg-white p-1">
            {([
              ["compact", "Compact"],
              ["balanced", "Balanced"],
              ["spacious", "Spacious"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForceProfile(value)}
                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                  forceProfile === value ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Node Graph Canvas</h3>
        </div>

        <NodeGraphCanvas
          nodes={graphModel.nodes}
          edges={graphModel.edges}
          onOpenItem={onOpenItem}
        />

        {filteredGoals.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            No goals are currently available for this filter set. Create goals first, then relationships will render automatically.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {TIMEFRAME_ORDER.map((level) => {
          const levelGoals = goalsByTimeframe.get(level) ?? [];
          const isOpen = timeframePanelState[level];

          return (
            <div key={level} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{TIMEFRAME_LABELS[level]}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {levelGoals.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTimeframePanelState((current) => ({ ...current, [level]: !current[level] }))}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {isOpen ? "Collapse" : "Expand"}
                </button>
              </div>

              {isOpen ? (
                levelGoals.length === 0 ? (
                  <p className="text-xs text-slate-500">No goals in this level.</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {levelGoals.map((goal) => {
                      const parentTitle = goal.parentGoalId ? goalMap.get(goal.parentGoalId)?.title ?? "Unknown parent" : "Root";
                      const linkedTasks = tasksByGoalId.get(goal.id)?.length ?? 0;
                      const childCount = childGoalCounts.get(goal.id) ?? 0;

                      return (
                        <article
                          key={goal.id}
                          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 transition hover:border-slate-300"
                          onClick={() => onOpenItem?.("goal", goal.id)}
                        >
                          <p className="text-sm font-semibold text-slate-900">{goal.title}</p>
                          <p className="mt-1 text-xs text-slate-600">{goal.type === "professional" ? "Professional" : "Personal"}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                            <div>
                              <p className="font-semibold uppercase tracking-wide text-slate-500">Parent</p>
                              <p>{parentTitle}</p>
                            </div>
                            <div>
                              <p className="font-semibold uppercase tracking-wide text-slate-500">Status</p>
                              <p>{goal.status.replace("_", " ")}</p>
                            </div>
                            <div>
                              <p className="font-semibold uppercase tracking-wide text-slate-500">Child Goals</p>
                              <p>{childCount}</p>
                            </div>
                            <div>
                              <p className="font-semibold uppercase tracking-wide text-slate-500">Tasks</p>
                              <p>{linkedTasks}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )
              ) : null}
            </div>
          );
        })}
      </div>

      {relationshipRows.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Relationship List</h3>
            <button
              type="button"
              onClick={() => setIsRelationshipPanelOpen((current) => !current)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {isRelationshipPanelOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {isRelationshipPanelOpen ? (
            <div className="mt-2 max-h-48 overflow-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-1 pr-2">Parent</th>
                    <th className="py-1 pr-2">Child</th>
                    <th className="py-1">Child Id</th>
                  </tr>
                </thead>
                <tbody>
                  {relationshipRows.map((row) => (
                    <tr key={row.childId} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-1.5 pr-2">{row.parentTitle}</td>
                      <td className="py-1.5 pr-2">
                        <button
                          type="button"
                          className="text-left text-slate-700 underline-offset-2 hover:underline"
                          onClick={() => onOpenItem?.("goal", row.childId)}
                        >
                          {row.childTitle}
                        </button>
                      </td>
                      <td className="py-1.5 text-slate-500">{row.childId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {includeFreestandingTasks ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Freestanding Tasks ({freestandingTasks.length})</h3>
            <button
              type="button"
              onClick={() => setIsFreestandingPanelOpen((current) => !current)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {isFreestandingPanelOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {isFreestandingPanelOpen ? (
            freestandingTasks.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No tasks without a goal-linked childGoal in this filter scope.</p>
            ) : (
              <ul className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-3">
                {freestandingTasks.slice(0, 24).map((task) => (
                  <li key={task.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                    <button
                      type="button"
                      className="w-full text-left hover:underline"
                      onClick={() => onOpenItem?.("task", task.id)}
                    >
                      {task.title}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function uniqueById<TEntity extends { id: string }>(items: TEntity[]) {
  const seen = new Set<string>();
  const unique: TEntity[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

function toErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: string }).message;
    if (message) {
      return message;
    }
  }

  return fallbackMessage;
}
