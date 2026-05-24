"use client";

import { useEffect, useMemo, useState } from "react";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Goal, ItemStatus, Subgoal, Task } from "@/lib/domain/types";

type RecentlyUpdatedItem = {
  id: string;
  kind: "goal" | "subgoal" | "task";
  title: string;
  status: ItemStatus;
  updatedAt: string;
  parentTitle?: string;
};

const DUE_SOON_WINDOW_DAYS = 7;

export function DashboardInsights() {
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
    const dueBy = new Date(now);
    dueBy.setDate(now.getDate() + DUE_SOON_WINDOW_DAYS);

    return tasks
      .filter((task) => task.status !== "done" && task.dueDate)
      .filter((task) => {
        const dueDate = parseDate(task.dueDate);
        return dueDate && dueDate >= now && dueDate <= dueBy;
      })
      .sort(compareTasksByDueDate)
      .slice(0, 6);
  }, [tasks]);

  const atRiskItems = useMemo(() => {
    const now = startOfDay(new Date());
    const riskBy = new Date(now);
    riskBy.setDate(now.getDate() + DUE_SOON_WINDOW_DAYS);

    const atRiskGoals = goals
      .filter((goal) => goal.status !== "done" && goal.projectedEndDate)
      .filter((goal) => {
        const projectedEnd = parseDate(goal.projectedEndDate);
        return projectedEnd && projectedEnd >= now && projectedEnd <= riskBy;
      })
      .map((goal) => ({
        id: goal.id,
        kind: "goal" as const,
        title: goal.title,
        dueDate: goal.projectedEndDate ?? "",
      }));

    const atRiskSubgoals = subgoals
      .filter((subgoal) => subgoal.status !== "done" && subgoal.projectedEndDate)
      .filter((subgoal) => {
        const projectedEnd = parseDate(subgoal.projectedEndDate);
        return projectedEnd && projectedEnd >= now && projectedEnd <= riskBy;
      })
      .map((subgoal) => ({
        id: subgoal.id,
        kind: "subgoal" as const,
        title: subgoal.title,
        dueDate: subgoal.projectedEndDate ?? "",
      }));

    return [...atRiskGoals, ...atRiskSubgoals]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
  }, [goals, subgoals]);

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
          Next 7 Days
        </span>
      </div>

      {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="pdp-panel-muted">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Current Focus</h3>
          {currentFocusGoals.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No active focus goal yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {currentFocusGoals.map((goal) => (
                <li key={goal.id} className="pdp-card rounded-lg px-3 py-2">
                  <p className="font-medium text-slate-900">{goal.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">{formatStatus(goal.status)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="pdp-panel-muted">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Tasks Due Soon</h3>
          {tasksDueSoon.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No upcoming tasks in the next week.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {tasksDueSoon.map((task) => {
                const parentSubgoal = subgoalMap.get(task.subgoalId);
                return (
                  <li key={task.id} className="pdp-card rounded-lg px-3 py-2">
                    <p className="font-medium text-slate-900">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Due {formatDateLabel(task.dueDate)}
                      {parentSubgoal ? ` | ${parentSubgoal.title}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="pdp-panel-muted rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700">At Risk</h3>
          {atRiskItems.length === 0 ? (
            <p className="mt-3 text-sm text-amber-800">No goals or subgoals at risk in the next week.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-amber-900">
              {atRiskItems.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="pdp-card rounded-lg px-3 py-2">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-amber-700">
                    {item.kind === "goal" ? "Goal" : "Subgoal"} | Due {formatDateLabel(item.dueDate)}
                  </p>
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
                <li key={`${item.kind}-${item.id}`} className="pdp-card rounded-lg px-3 py-2">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatKind(item.kind)} | {formatStatus(item.status)} | Updated {formatDateTimeLabel(item.updatedAt)}
                    {item.parentTitle ? ` | ${item.parentTitle}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
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