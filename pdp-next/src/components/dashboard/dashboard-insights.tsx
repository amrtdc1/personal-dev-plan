"use client";

import { useEffect, useMemo, useState } from "react";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Goal, Habit, HabitCheckin, ItemStatus, Subgoal, Task } from "@/lib/domain/types";
import { KindTag } from "@/components/ui/tags";

type RecentlyUpdatedItem = {
  id: string;
  kind: "goal" | "subgoal" | "task";
  title: string;
  status: ItemStatus;
  updatedAt: string;
  parentTitle?: string;
};

type DashboardInsightsView = "today" | "review";
type TodayQueueSortMode = "urgent" | "quick_wins";

const DUE_SOON_LOOKBACK_DAYS = 7;
const DUE_SOON_LOOKAHEAD_DAYS = 10;
const DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY = "pdp.dashboardInsightsView";
const DASHBOARD_TODAY_QUEUE_SORT_STORAGE_KEY = "pdp.dashboardTodayQueueSort";
const QUICK_ACTION_BUTTON_CLASS =
  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50";

export function DashboardInsights({
  onOpenItem,
  onOpenGoalsWorkspace,
}: {
  onOpenItem?: (kind: "goal" | "subgoal" | "task", id: string) => void;
  onOpenGoalsWorkspace?: () => void;
} = {}) {
  const { isLoading, user, error } = db.useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subgoals, setSubgoals] = useState<Subgoal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitCheckinsByHabitId, setHabitCheckinsByHabitId] = useState<Record<string, HabitCheckin[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInFlightId, setActionInFlightId] = useState<string | null>(null);
  const [todayQueueSortMode, setTodayQueueSortMode] = useState<TodayQueueSortMode>(() => {
    if (typeof window === "undefined") {
      return "urgent";
    }

    const stored = window.localStorage.getItem(DASHBOARD_TODAY_QUEUE_SORT_STORAGE_KEY);
    return stored === "quick_wins" ? "quick_wins" : "urgent";
  });
  const [viewMode, setViewMode] = useState<DashboardInsightsView>(() => {
    if (typeof window === "undefined") {
      return "today";
    }

    const stored = window.localStorage.getItem(DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY);
    return stored === "review" ? "review" : "today";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(DASHBOARD_TODAY_QUEUE_SORT_STORAGE_KEY, todayQueueSortMode);
  }, [todayQueueSortMode]);

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

        const loadedHabits = await dataRepository.listHabits(currentUser.id);
        const activeHabits = loadedHabits.filter((habit) => !habit.deletedAt && habit.status !== "archived");
        const checkinEntries = await Promise.all(
          activeHabits.map(async (habit) => {
            const checkins = await dataRepository.listHabitCheckins(currentUser.id, habit.id);
            return [habit.id, checkins] as const;
          }),
        );
        const checkinsByHabitId: Record<string, HabitCheckin[]> = {};
        for (const [habitId, checkins] of checkinEntries) {
          checkinsByHabitId[habitId] = checkins;
        }

        if (!cancelled) {
          setGoals(loadedGoals);
          setSubgoals(loadedSubgoals);
          setTasks(loadedTasks);
          setHabits(activeHabits);
          setHabitCheckinsByHabitId(checkinsByHabitId);
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
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const tasksDueToday = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.dueDate === todayIso),
    [tasks, todayIso],
  );

  const completedTodayCount = useMemo(
    () => tasks.filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) === todayIso).length,
    [tasks, todayIso],
  );

  const habitsCheckedInTodayCount = useMemo(
    () =>
      habits.filter((habit) =>
        (habitCheckinsByHabitId[habit.id] ?? []).some((checkin) => checkin.checkInDate === todayIso),
      ).length,
    [habits, habitCheckinsByHabitId, todayIso],
  );

  const habitsNeedingCheckin = useMemo(
    () =>
      habits.filter(
        (habit) => !(habitCheckinsByHabitId[habit.id] ?? []).some((checkin) => checkin.checkInDate === todayIso),
      ),
    [habits, habitCheckinsByHabitId, todayIso],
  );

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

  const quickActionTasks = useMemo(() => {
    const openTasks = tasksDueSoon.filter((task) => task.status !== "done");
    if (todayQueueSortMode === "quick_wins") {
      return [...openTasks]
        .sort(compareTasksByQuickWins)
        .slice(0, 4);
    }

    return openTasks.slice(0, 4);
  }, [tasksDueSoon, todayQueueSortMode]);

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

  async function handleQuickTaskDone(taskId: string) {
    if (!user) {
      return;
    }

    setActionError(null);
    setActionInFlightId(`task-${taskId}`);

    try {
      const updatedTask = await dataRepository.updateTaskStatus(user.id, taskId, "done");
      setTasks((current) => current.map((task) => (task.id === taskId ? updatedTask : task)));
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not complete that task."));
    } finally {
      setActionInFlightId(null);
    }
  }

  async function handleQuickTaskDefer(taskId: string) {
    if (!user) {
      return;
    }

    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    const baseline = task.dueDate ? parseDate(task.dueDate) : parseDate(todayIso);
    if (!baseline) {
      return;
    }

    const nextDueDate = new Date(baseline);
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const nextDueDateIso = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, "0")}-${String(
      nextDueDate.getDate(),
    ).padStart(2, "0")}`;

    setActionError(null);
    setActionInFlightId(`task-defer-${taskId}`);

    try {
      const updatedTask = await dataRepository.saveTask({
        taskId: task.id,
        ownerUid: user.id,
        subgoalId: task.subgoalId,
        title: task.title,
        notes: task.notes,
        dueDate: nextDueDateIso,
        existingTask: task,
      });

      setTasks((current) => current.map((entry) => (entry.id === taskId ? updatedTask : entry)));
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not defer that task."));
    } finally {
      setActionInFlightId(null);
    }
  }

  async function handleQuickHabitCheckin(habitId: string) {
    if (!user) {
      return;
    }

    setActionError(null);
    setActionInFlightId(`habit-${habitId}`);

    try {
      await dataRepository.saveHabitCheckin({
        ownerUid: user.id,
        habitId,
        checkInDate: todayIso,
        notes: null,
      });

      const refreshedCheckins = await dataRepository.listHabitCheckins(user.id, habitId);
      setHabitCheckinsByHabitId((current) => ({
        ...current,
        [habitId]: refreshedCheckins,
      }));
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not save that habit check-in."));
    } finally {
      setActionInFlightId(null);
    }
  }

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
      </div>

      {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}
      {actionError ? <p className="mt-2 text-sm text-red-700">{actionError}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-slate-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("today")}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
              viewMode === "today" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setViewMode("review")}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
              viewMode === "review" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Review
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenGoalsWorkspace}
          className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Open Goals Workspace
        </button>
      </div>

      {viewMode === "today" ? (
        <article className="pdp-panel-muted mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Today Command Center</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {formatDateLabel(todayIso)}
          </span>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="pdp-card rounded-xl px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tasks due today</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tasksDueToday.length}</p>
            <p className="text-xs text-slate-600">Need action</p>
          </div>
          <div className="pdp-card rounded-xl px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Habit check-ins</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{habitsCheckedInTodayCount}</p>
            <p className="text-xs text-slate-600">of {habits.length} active habits</p>
          </div>
          <div className="pdp-card rounded-xl px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tasks completed</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{completedTodayCount}</p>
            <p className="text-xs text-slate-600">Today</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quick task actions</p>
              <div className="inline-flex rounded-full border border-slate-300 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setTodayQueueSortMode("urgent")}
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                    todayQueueSortMode === "urgent" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Urgent
                </button>
                <button
                  type="button"
                  onClick={() => setTodayQueueSortMode("quick_wins")}
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                    todayQueueSortMode === "quick_wins" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Quick Wins
                </button>
              </div>
            </div>
            {quickActionTasks.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No immediate task actions.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {quickActionTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenItem?.("task", task.id)}
                        className="truncate text-left text-sm font-medium text-slate-900 hover:underline"
                        data-testid={`quick-task-title-${task.id}`}
                      >
                        {task.title}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleQuickTaskDefer(task.id)}
                          disabled={actionInFlightId === `task-defer-${task.id}`}
                          className={`${QUICK_ACTION_BUTTON_CLASS} border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-50`}
                        >
                          {actionInFlightId === `task-defer-${task.id}` ? "Saving..." : "+1d"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleQuickTaskDone(task.id)}
                          disabled={actionInFlightId === `task-${task.id}`}
                          className={`${QUICK_ACTION_BUTTON_CLASS} border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50`}
                        >
                          {actionInFlightId === `task-${task.id}` ? "Saving..." : "Mark done"}
                        </button>
                      </div>
                    </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quick habit check-ins</p>
            {habitsNeedingCheckin.slice(0, 4).length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">All tracked habits are checked in today.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {habitsNeedingCheckin.slice(0, 4).map((habit) => (
                  <li key={habit.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-2">
                    <p className="truncate text-sm font-medium text-slate-900">{habit.title}</p>
                    <button
                      type="button"
                      onClick={() => void handleQuickHabitCheckin(habit.id)}
                      disabled={actionInFlightId === `habit-${habit.id}`}
                      className={`${QUICK_ACTION_BUTTON_CLASS} border-indigo-300 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50`}
                    >
                      {actionInFlightId === `habit-${habit.id}` ? "Saving..." : "Check in"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </article>
      ) : null}

      {viewMode === "review" ? (
        <section className="mt-4 space-y-4">
          <article className="pdp-panel-muted">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Overview</h3>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
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

            <div className="mt-3">
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

          <div className="grid gap-3 md:grid-cols-2">
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
      ) : null}
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

function compareTasksByQuickWins(a: Task, b: Task) {
  const statusRank = (status: ItemStatus) => {
    if (status === "in_progress") {
      return 0;
    }
    if (status === "not_started") {
      return 1;
    }
    return 2;
  };

  const rankDelta = statusRank(a.status) - statusRank(b.status);
  if (rankDelta !== 0) {
    return rankDelta;
  }

  const dueDelta = compareTasksByDueDate(a, b);
  if (dueDelta !== 0) {
    return dueDelta;
  }

  return b.updatedAt.localeCompare(a.updatedAt);
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