"use client";

import { useEffect, useMemo, useState } from "react";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Goal, ItemStatus, Subgoal, Task } from "@/lib/domain/types";
import { KindTag } from "@/components/ui/tags";

type RecentlyUpdatedItem = {
  id: string;
  kind: "goal" | "subgoal" | "task";
  title: string;
  status: ItemStatus;
  updatedAt: string;
  parentTitle?: string;
};

const DUE_SOON_LOOKBACK_DAYS = 7;
const DUE_SOON_LOOKAHEAD_DAYS = 10;

export function DashboardInsights({
  onOpenItem,
}: {
  onOpenItem?: (kind: "goal" | "subgoal" | "task", id: string) => void;
} = {}) {
  const { isLoading, user, error } = db.useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subgoals, setSubgoals] = useState<Subgoal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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
          dataRepository.listGoals(currentUser.id, "professional", { includeDeleted: true }),
          dataRepository.listGoals(currentUser.id, "personal", { includeDeleted: true }),
        ]);

        const loadedGoals = [...professionalGoals, ...personalGoals].filter((goal) => !goal.deletedAt);

        const subgoalGroups = await Promise.all(
          loadedGoals.map((goal) => dataRepository.listSubgoals(currentUser.id, goal.id, { includeDeleted: true })),
        );
        const loadedSubgoals = subgoalGroups.flat().filter((subgoal) => !subgoal.deletedAt);

        const taskGroups = await Promise.all(
          loadedSubgoals.map((subgoal) => dataRepository.listTasks(currentUser.id, subgoal.id, { includeDeleted: true })),
        );
        const loadedTasks = taskGroups.flat().filter((task) => !task.deletedAt);

        if (!cancelled) {
          setGoals(loadedGoals);
          setSubgoals(loadedSubgoals);
          setTasks(loadedTasks);
        }
      } catch (repositoryError) {
        if (!cancelled) {
          setLoadError(getErrorMessage(repositoryError, "We could not load dashboard insights."));
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
  const subgoalMap = useMemo(() => new Map(subgoals.map((subgoal) => [subgoal.id, subgoal])), [subgoals]);

  const currentFocusGoals = useMemo(
    () => goals.filter((goal) => goal.isFocus && goal.status !== "done").sort(compareByUpdatedAtDesc).slice(0, 3),
    [goals],
  );

  const tasksDueSoon = useMemo(() => {
    const now = startOfDay(new Date());
    const lookbackStart = new Date(now);
    lookbackStart.setDate(now.getDate() - DUE_SOON_LOOKBACK_DAYS);
    const dueBy = new Date(now);
    dueBy.setDate(now.getDate() + DUE_SOON_LOOKAHEAD_DAYS);

    return tasks
      .filter((task) => task.status !== "done" && task.dueDate)
      .filter((task) => {
        const dueDate = parseDate(task.dueDate);
        return dueDate && dueDate >= lookbackStart && dueDate <= dueBy;
      })
      .sort(compareTasksByDueDate)
      .slice(0, 8);
  }, [tasks]);

  const atRiskItems = useMemo(() => {
    const now = startOfDay(new Date());

    const overdueGoals = goals
      .filter((goal) => goal.status !== "done" && goal.projectedEndDate)
      .filter((goal) => {
        const projectedEnd = parseDate(goal.projectedEndDate);
        return projectedEnd && projectedEnd < now;
      })
      .map((goal) => ({
        id: goal.id,
        kind: "goal" as const,
        title: goal.title,
        dueDate: goal.projectedEndDate ?? "",
      }));

    const overdueSubgoals = subgoals
      .filter((subgoal) => subgoal.status !== "done" && subgoal.projectedEndDate)
      .filter((subgoal) => {
        const projectedEnd = parseDate(subgoal.projectedEndDate);
        return projectedEnd && projectedEnd < now;
      })
      .map((subgoal) => ({
        id: subgoal.id,
        kind: "subgoal" as const,
        title: subgoal.title,
        dueDate: subgoal.projectedEndDate ?? "",
      }));

    const overdueTasks = tasks
      .filter((task) => task.status !== "done" && task.dueDate)
      .filter((task) => {
        const due = parseDate(task.dueDate);
        return due && due < now;
      })
      .map((task) => ({
        id: task.id,
        kind: "task" as const,
        title: task.title,
        dueDate: task.dueDate ?? "",
      }));

    return [...overdueGoals, ...overdueSubgoals, ...overdueTasks]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 10);
  }, [goals, subgoals, tasks]);

  const overviewStats = useMemo(() => {
    const professional = goals.filter((goal) => goal.type === "professional");
    const personal = goals.filter((goal) => goal.type === "personal");

    const professionalOpen = professional.filter((goal) => goal.status !== "done").length;
    const professionalDone = professional.filter((goal) => goal.status === "done").length;
    const personalOpen = personal.filter((goal) => goal.status !== "done").length;
    const personalDone = personal.filter((goal) => goal.status === "done").length;

    const totalGoals = goals.length;
    const totalDone = professionalDone + personalDone;
    const overallPercent = totalGoals === 0 ? 0 : Math.round((totalDone / totalGoals) * 100);

    return {
      professionalOpen,
      professionalDone,
      personalOpen,
      personalDone,
      totalGoals,
      totalDone,
      overallPercent,
    };
  }, [goals]);

  const recentlyUpdated = useMemo<RecentlyUpdatedItem[]>(() => {
    const goalItems: RecentlyUpdatedItem[] = goals.map((goal) => ({
      id: goal.id,
      kind: "goal",
      title: goal.title,
      status: goal.status,
      updatedAt: goal.updatedAt,
    }));

    const subgoalItems: RecentlyUpdatedItem[] = subgoals.map((subgoal) => ({
      id: subgoal.id,
      kind: "subgoal",
      title: subgoal.title,
      status: subgoal.status,
      updatedAt: subgoal.updatedAt,
      parentTitle: goalMap.get(subgoal.goalId)?.title,
    }));

    const taskItems: RecentlyUpdatedItem[] = tasks.map((task) => {
      const parentSubgoal = subgoalMap.get(task.subgoalId);
      return {
        id: task.id,
        kind: "task",
        title: task.title,
        status: task.status,
        updatedAt: task.updatedAt,
        parentTitle: parentSubgoal?.title,
      };
    });

    return [...goalItems, ...subgoalItems, ...taskItems]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);
  }, [goals, subgoals, tasks, goalMap, subgoalMap]);

  if (isLoading || isRefreshing) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Dashboard Insights</h2>
        <p className="mt-3 text-sm text-slate-700">Loading insights...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pdp-panel rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Dashboard Insights</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Dashboard Insights</h2>
        <p className="mt-3 text-sm text-slate-700">Sign in to see focus and risk insights.</p>
      </section>
    );
  }

  return (
    <section className="pdp-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Dashboard Insights</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Snapshot
        </span>
      </div>

      {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}

      <article className="pdp-panel-muted mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Overview</h3>
        <p className="mt-1 text-xs text-slate-600">Quick snapshot of where your goals stand.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="pdp-card rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Professional goals
            </p>
            <p
              className="mt-1 text-4xl font-bold leading-none"
              style={{ color: "var(--pdp-theme-primary)" }}
            >
              {overviewStats.professionalOpen}
            </p>
            <p className="mt-1 text-xs text-slate-600">Open</p>
            <p className="mt-2 text-xs text-slate-600">
              Completed: <span className="font-semibold text-slate-800">{overviewStats.professionalDone}</span>
            </p>
          </div>

          <div className="pdp-card rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Personal goals</p>
            <p
              className="mt-1 text-4xl font-bold leading-none"
              style={{ color: "var(--pdp-theme-primary)" }}
            >
              {overviewStats.personalOpen}
            </p>
            <p className="mt-1 text-xs text-slate-600">Open</p>
            <p className="mt-2 text-xs text-slate-600">
              Completed: <span className="font-semibold text-slate-800">{overviewStats.personalDone}</span>
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold uppercase tracking-wide">Overall completion</span>
            <span>{overviewStats.overallPercent}% complete</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${overviewStats.overallPercent}%`,
                backgroundColor: "var(--pdp-theme-primary)",
              }}
              role="progressbar"
              aria-valuenow={overviewStats.overallPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </article>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="pdp-panel-muted">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Current Focus</h3>
          {currentFocusGoals.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No active focus goal yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {currentFocusGoals.map((goal) => (
                <li key={goal.id}>
                  <DashboardItemButton onClick={() => onOpenItem?.("goal", goal.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{goal.title}</p>
                      <KindTag kind="goal" />
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">
                      {formatStatus(goal.status)}
                    </p>
                  </DashboardItemButton>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="pdp-panel-muted">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Tasks Due Soon</h3>
          <p className="mt-1 text-xs text-slate-600">
            Recently due (last {DUE_SOON_LOOKBACK_DAYS} days) or coming up in the next {DUE_SOON_LOOKAHEAD_DAYS} days.
          </p>
          {tasksDueSoon.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No tasks in the due-soon window.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {tasksDueSoon.map((task) => {
                const parentSubgoal = subgoalMap.get(task.subgoalId);
                return (
                  <li key={task.id}>
                    <DashboardItemButton onClick={() => onOpenItem?.("task", task.id)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{task.title}</p>
                        <KindTag kind="task" />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Due {formatDateLabel(task.dueDate)}
                        {parentSubgoal ? ` | ${parentSubgoal.title}` : ""}
                      </p>
                    </DashboardItemButton>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="pdp-panel-muted rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700">At-risk items</h3>
          <p className="mt-1 text-xs text-amber-800">Goals, sub-goals, and tasks that are past due.</p>
          {atRiskItems.length === 0 ? (
            <p className="mt-3 text-sm text-amber-800">Nothing is past due. Nicely done.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-amber-900">
              {atRiskItems.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <DashboardItemButton onClick={() => onOpenItem?.(item.kind, item.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <KindTag kind={item.kind} />
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-amber-700">
                      Was due {formatDateLabel(item.dueDate)}
                    </p>
                  </DashboardItemButton>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="pdp-panel-muted">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recently Updated</h3>
          {recentlyUpdated.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No recent updates yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {recentlyUpdated.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <DashboardItemButton onClick={() => onOpenItem?.(item.kind, item.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <KindTag kind={item.kind} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatStatus(item.status)} | Updated {formatDateTimeLabel(item.updatedAt)}
                      {item.parentTitle ? ` | ${item.parentTitle}` : ""}
                    </p>
                  </DashboardItemButton>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}

function DashboardItemButton({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pdp-card block w-full rounded-lg px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
    >
      {children}
    </button>
  );
}

function compareByUpdatedAtDesc(a: { updatedAt: string }, b: { updatedAt: string }) {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function compareTasksByDueDate(a: Task, b: Task) {
  const aDate = a.dueDate ?? "";
  const bDate = b.dueDate ?? "";
  return aDate.localeCompare(bDate);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(dateValue: string | null) {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatStatus(status: ItemStatus) {
  switch (status) {
    case "not_started":
      return "Not Started";
    case "in_progress":
      return "In Progress";
    case "done":
      return "Done";
    default:
      return status;
  }
}

function formatKind(kind: RecentlyUpdatedItem["kind"]) {
  switch (kind) {
    case "goal":
      return "Goal";
    case "subgoal":
      return "Subgoal";
    case "task":
      return "Task";
    default:
      return kind;
  }
}

function formatDateLabel(isoDate: string | null) {
  if (!isoDate) {
    return "unscheduled";
  }

  const date = parseDate(isoDate);
  if (!date) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTimeLabel(isoDateTime: string) {
  const parsed = new Date(isoDateTime);
  if (Number.isNaN(parsed.getTime())) {
    return isoDateTime;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}