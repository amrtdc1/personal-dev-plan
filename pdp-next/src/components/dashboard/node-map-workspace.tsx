"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [includeFreestandingTasks, setIncludeFreestandingTasks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const graphNodes = useMemo(() => {
    const byLevel = new Map<GoalTimeframeLevel, Goal[]>();
    for (const level of TIMEFRAME_ORDER) {
      byLevel.set(level, []);
    }

    for (const goal of filteredGoals) {
      const bucket = byLevel.get(goal.timeframeLevel) ?? [];
      bucket.push(goal);
      byLevel.set(goal.timeframeLevel, bucket);
    }

    const nodeMap = new Map<string, { goal: Goal; x: number; y: number }>();

    for (let columnIndex = 0; columnIndex < TIMEFRAME_ORDER.length; columnIndex += 1) {
      const level = TIMEFRAME_ORDER[columnIndex];
      const sortedGoals = (byLevel.get(level) ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));

      for (let rowIndex = 0; rowIndex < sortedGoals.length; rowIndex += 1) {
        nodeMap.set(sortedGoals[rowIndex].id, {
          goal: sortedGoals[rowIndex],
          x: 130 + columnIndex * 220,
          y: 70 + rowIndex * 90,
        });
      }
    }

    return nodeMap;
  }, [filteredGoals]);

  const graphEdges = useMemo(() => {
    return filteredGoals
      .filter((goal) => goal.parentGoalId && graphNodes.has(goal.parentGoalId) && graphNodes.has(goal.id))
      .map((goal) => {
        const child = graphNodes.get(goal.id)!;
        const parent = graphNodes.get(goal.parentGoalId!)!;
        return {
          id: `${parent.goal.id}-${child.goal.id}`,
          fromX: parent.x,
          fromY: parent.y,
          toX: child.x,
          toY: child.y,
        };
      });
  }, [filteredGoals, graphNodes]);

  const graphHeight = useMemo(() => {
    let maxRowCount = 1;
    for (const level of TIMEFRAME_ORDER) {
      const count = goalsByTimeframe.get(level)?.length ?? 0;
      if (count > maxRowCount) {
        maxRowCount = count;
      }
    }
    return 120 + maxRowCount * 90;
  }, [goalsByTimeframe]);

  if (isLoading) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Loading node map...</h2>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Sign in to view your node map.</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Unable to load node map.</h2>
        <p className="mt-2 text-sm text-slate-700">{toErrorMessage(error, "Authentication error.")}</p>
      </section>
    );
  }

  return (
    <section className="pdp-panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relationship Viewer</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Node Map</h2>
          <p className="mt-1 text-sm text-slate-600">
            Explore parent-child goal links and task concentration across timeline levels.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIncludeFreestandingTasks((current) => !current)}
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
            includeFreestandingTasks
              ? "bg-slate-900 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {includeFreestandingTasks ? "Hide Freestanding Tasks" : "Include Freestanding Tasks"}
        </button>
      </div>

      {loadError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
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

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Node Link Canvas</h3>
          <p className="text-[11px] text-slate-500">Click a node to open it in Goals</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/50">
          <svg viewBox={`0 0 1200 ${graphHeight}`} className="h-auto min-w-[980px] w-full" role="img" aria-label="Goal relationship map">
            {TIMEFRAME_ORDER.map((level, index) => (
              <g key={`band-${level}`}>
                <rect
                  x={20 + index * 220}
                  y={18}
                  width={200}
                  height={graphHeight - 36}
                  rx={16}
                  fill="#f8fafc"
                  stroke="#e2e8f0"
                />
                <text x={120 + index * 220} y={42} textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">
                  {TIMEFRAME_LABELS[level]}
                </text>
              </g>
            ))}

            {graphEdges.map((edge) => (
              <line
                key={edge.id}
                x1={edge.fromX}
                y1={edge.fromY}
                x2={edge.toX}
                y2={edge.toY}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            ))}

            {Array.from(graphNodes.values()).map(({ goal, x, y }) => (
              <g key={`node-${goal.id}`}>
                <circle cx={x} cy={y} r={14} fill={goal.type === "professional" ? "#0ea5e9" : "#10b981"} />
                <text x={x + 20} y={y + 4} fontSize="11" fill="#0f172a">
                  {truncateLabel(goal.title, 24)}
                </text>
                <rect
                  x={x - 16}
                  y={y - 16}
                  width={200}
                  height={32}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onOpenItem?.("goal", goal.id)}
                />
              </g>
            ))}
          </svg>
        </div>

        {filteredGoals.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            No goals are currently available for this filter set. Create goals first, then relationships will render automatically.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {TIMEFRAME_ORDER.map((level) => {
          const levelGoals = goalsByTimeframe.get(level) ?? [];
          return (
            <div key={level} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{TIMEFRAME_LABELS[level]}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {levelGoals.length}
                </span>
              </div>

              {levelGoals.length === 0 ? (
                <p className="text-xs text-slate-500">No goals in this level.</p>
              ) : (
                <div className="space-y-2">
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
              )}
            </div>
          );
        })}
      </div>

      {relationshipRows.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-900">Relationship List</h3>
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
        </div>
      ) : null}

      {includeFreestandingTasks ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-900">Freestanding Tasks ({freestandingTasks.length})</h3>
          {freestandingTasks.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No tasks without a goal-linked childGoal in this filter scope.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {freestandingTasks.slice(0, 20).map((task) => (
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
          )}
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

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
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
