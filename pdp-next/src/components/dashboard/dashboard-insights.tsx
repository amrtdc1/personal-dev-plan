"use client";

import { useEffect, useMemo, useState } from "react";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Goal, Habit, HabitCheckin, ItemStatus, ChildGoal, Task } from "@/lib/domain/types";
import { getTaskParentGoalId } from "@/lib/domain/types";
import { KindTag } from "@/components/ui/tags";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { CrudModal } from "@/components/ui/crud-modal";

type RecentlyUpdatedItem = {
  id: string;
  kind: "goal" | "childGoal" | "task";
  title: string;
  status: ItemStatus;
  updatedAt: string;
  parentTitle?: string;
};

type DashboardInsightsMode = "today" | "plan" | "review" | "risks" | "close_day";
type TodayQueueSortMode = "urgent" | "quick_wins";
type TodayTaskFilterMode = "all" | "overdue";

const DUE_SOON_LOOKAHEAD_DAYS = 10;
const STALE_IN_PROGRESS_DAYS = 3;
const PARENT_INACTIVITY_DAYS = 5;
const DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY = "pdp.dashboardInsightsView";
const DASHBOARD_TODAY_QUEUE_SORT_STORAGE_KEY = "pdp.dashboardTodayQueueSort";
const QUICK_ACTION_BUTTON_CLASS =
  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50";

export function DashboardInsights({
  onOpenItem,
}: {
  onOpenItem?: (kind: "goal" | "childGoal" | "task", id: string) => void;
  onNavigateToPlanning?: () => void;
} = {}) {
  const { isLoading, user, error } = db.useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [childGoals, setChildGoals] = useState<ChildGoal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitCheckinsByHabitId, setHabitCheckinsByHabitId] = useState<Record<string, HabitCheckin[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInFlightId, setActionInFlightId] = useState<string | null>(null);
  const [closeDaySavedAt, setCloseDaySavedAt] = useState<string | null>(null);
  const [closeDayWhatWentRight, setCloseDayWhatWentRight] = useState("");
  const [closeDayWhatWentWrong, setCloseDayWhatWentWrong] = useState("");
  const [closeDayWhatToAdjust, setCloseDayWhatToAdjust] = useState("");
  const [closeDayAdditionalThoughts, setCloseDayAdditionalThoughts] = useState("");
  const [closeDayDateOffset, setCloseDayDateOffset] = useState(0);
  const [isQuickTaskModalOpen, setIsQuickTaskModalOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskNotes, setQuickTaskNotes] = useState("");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("");
  const [quickTaskChildGoalId, setQuickTaskChildGoalId] = useState("");
  const [taskModalTaskId, setTaskModalTaskId] = useState<string | null>(null);
  const [taskModalTitle, setTaskModalTitle] = useState("");
  const [taskModalNotes, setTaskModalNotes] = useState("");
  const [taskModalDueDate, setTaskModalDueDate] = useState("");
  const [taskModalParentGoalId, setTaskModalParentGoalId] = useState("");
  const [taskModalSnoozeDays, setTaskModalSnoozeDays] = useState("1");
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [pendingTaskDoneId, setPendingTaskDoneId] = useState<string | null>(null);
  const [habitCheckinModalHabitId, setHabitCheckinModalHabitId] = useState<string | null>(null);
  const [habitCheckinDate, setHabitCheckinDate] = useState("");
  const [todayTaskFilterMode, setTodayTaskFilterMode] = useState<TodayTaskFilterMode>("all");
  const [todayQueueSortMode, setTodayQueueSortMode] = useState<TodayQueueSortMode>(() => {
    if (typeof window === "undefined") {
      return "urgent";
    }

    const stored = window.localStorage.getItem(DASHBOARD_TODAY_QUEUE_SORT_STORAGE_KEY);
    return stored === "quick_wins" ? "quick_wins" : "urgent";
  });
  const [dashboardMode, setDashboardMode] = useState<DashboardInsightsMode>(() => {
    if (typeof window === "undefined") {
      return "today";
    }

    const stored = window.localStorage.getItem(DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY);
    if (
      stored === "plan" ||
      stored === "review" ||
      stored === "risks" ||
      stored === "close_day"
    ) {
      return stored;
    }

    return "today";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY, dashboardMode);
  }, [dashboardMode]);

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

        const childGoalGroups = await Promise.all(
          loadedGoals.map((goal) => dataRepository.listChildGoals(currentUser.id, goal.id, { includeDeleted: true })),
        );
        const loadedChildGoals = childGoalGroups.flat().filter((childGoal) => !childGoal.deletedAt);

        const taskGroups = await Promise.all(
          [...loadedGoals.map((goal) => goal.id), ...loadedChildGoals.map((childGoal) => childGoal.id), null].map(
            (taskOwnerId) => dataRepository.listTasks(currentUser.id, taskOwnerId, { includeDeleted: true }),
          ),
        );
        const loadedTasks = Array.from(
          new Map(
            taskGroups
              .flat()
              .filter((task) => !task.deletedAt)
              .map((task) => [task.id, task]),
          ).values(),
        );

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
          setChildGoals(loadedChildGoals);
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
  const childGoalMap = useMemo(() => new Map(childGoals.map((childGoal) => [childGoal.id, childGoal])), [childGoals]);
  const taskParentOptions = useMemo(
    () => {
      const optionsById = new Map<string, { id: string; label: string }>();

      for (const goal of goals) {
        if (!optionsById.has(goal.id)) {
          optionsById.set(goal.id, { id: goal.id, label: `Goal: ${goal.title}` });
        }
      }

      for (const childGoal of childGoals) {
        if (!optionsById.has(childGoal.id)) {
          const parentGoal = goalMap.get(childGoal.goalId);
          optionsById.set(childGoal.id, {
            id: childGoal.id,
            label: parentGoal ? `${parentGoal.title} -> ${childGoal.title}` : childGoal.title,
          });
        }
      }

      return [...optionsById.values()];
    },
    [childGoals, goalMap, goals],
  );
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const closeDayIso = useMemo(() => {
    const base = parseDate(todayIso);
    if (!base) {
      return todayIso;
    }

    const date = new Date(base);
    date.setDate(date.getDate() + closeDayDateOffset);
    return toIsoDate(date);
  }, [todayIso, closeDayDateOffset]);

  const selectedTask = useMemo(
    () => (taskModalTaskId ? tasks.find((task) => task.id === taskModalTaskId) ?? null : null),
    [taskModalTaskId, tasks],
  );

  const selectedHabitForQuickCheckin = useMemo(
    () => (habitCheckinModalHabitId ? habits.find((habit) => habit.id === habitCheckinModalHabitId) ?? null : null),
    [habitCheckinModalHabitId, habits],
  );

  const pendingTaskDone = useMemo(
    () => (pendingTaskDoneId ? tasks.find((task) => task.id === pendingTaskDoneId) ?? null : null),
    [pendingTaskDoneId, tasks],
  );

  const tasksDueToday = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.dueDate === todayIso),
    [tasks, todayIso],
  );

  const completedTodayCount = useMemo(
    () => tasks.filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) === todayIso).length,
    [tasks, todayIso],
  );

  const completedTodayTasksAll = useMemo(
    () => tasks.filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) === todayIso),
    [tasks, todayIso],
  );

  const plannedVsUnplannedToday = useMemo(() => {
    let planned = 0;
    let unplanned = 0;

    for (const task of completedTodayTasksAll) {
      if (task.unplanned) {
        unplanned += 1;
        continue;
      }

      const createdOn = task.createdAt.slice(0, 10);
      const isPreplanned = createdOn < todayIso || (task.dueDate ? task.dueDate <= todayIso : false);

      if (isPreplanned) {
        planned += 1;
      } else {
        unplanned += 1;
      }
    }

    return {
      planned,
      unplanned,
    };
  }, [completedTodayTasksAll, todayIso]);

  const overdueTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "done" && Boolean(task.dueDate))
        .filter((task) => {
          const dueDate = parseDate(task.dueDate);
          const today = parseDate(todayIso);
          return Boolean(dueDate && today && dueDate < today);
        })
        .sort(compareTasksByDueDate),
    [tasks, todayIso],
  );

  const dueThisWeekTasks = (() => {
    const today = parseDate(todayIso);
    if (!today) {
      return [] as Task[];
    }

    const dueBy = new Date(today);
    dueBy.setDate(today.getDate() + 6);

    return tasks
      .filter((task) => task.status !== "done" && Boolean(task.dueDate))
      .filter((task) => {
        const dueDate = parseDate(task.dueDate);
        return Boolean(dueDate && dueDate >= today && dueDate <= dueBy);
      })
      .sort(compareTasksByDueDate)
      .slice(0, 4);
  })();

  const dueSoonTasks = useMemo(() => {
    const now = startOfDay(new Date());
    const dueBy = new Date(now);
    dueBy.setDate(now.getDate() + DUE_SOON_LOOKAHEAD_DAYS);

    return tasks
      .filter((task) => task.status !== "done" && task.dueDate)
      .filter((task) => {
        const dueDate = parseDate(task.dueDate);
        return Boolean(dueDate && dueDate >= now && dueDate <= dueBy);
      })
      .sort(compareTasksByDueDate);
  }, [tasks]);

  const dueSoonBeyondThisWeekTasks = (() => {
    const now = parseDate(todayIso);
    if (!now) {
      return [] as Task[];
    }

    const dueAfter = new Date(now);
    dueAfter.setDate(now.getDate() + 6);

    return dueSoonTasks
      .filter((task) => {
        const dueDate = parseDate(task.dueDate);
        return Boolean(dueDate && dueDate > dueAfter);
      })
      .slice(0, 6);
  })();

  const staleInProgressTasks = (() => {
    const today = parseDate(todayIso);
    if (!today) {
      return [] as Task[];
    }

    const staleCutoff = new Date(today);
    staleCutoff.setDate(today.getDate() - STALE_IN_PROGRESS_DAYS);

    return tasks
      .filter((task) => task.status === "in_progress")
      .filter((task) => {
        const updatedAt = new Date(task.updatedAt);
        return !Number.isNaN(updatedAt.getTime()) && updatedAt < staleCutoff;
      })
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, 4);
  })();

  const blockedByParentInactivityTasks = (() => {
    const today = parseDate(todayIso);
    if (!today) {
      return [] as Task[];
    }

    const inactivityCutoff = new Date(today);
    inactivityCutoff.setDate(today.getDate() - PARENT_INACTIVITY_DAYS);
    const isStaleIsoDate = (isoDateTime: string) => {
      const parsed = new Date(isoDateTime);
      return !Number.isNaN(parsed.getTime()) && parsed < inactivityCutoff;
    };

    return tasks
      .filter((task) => task.status === "in_progress")
      .filter((task) => {
        const parentGoalId = getTaskParentGoalId(task);
        if (!parentGoalId) {
          return false;
        }

        const parentChildGoal = childGoalMap.get(parentGoalId);
        if (!parentChildGoal) {
          return false;
        }

        const isChildGoalStale = isStaleIsoDate(parentChildGoal.updatedAt);
        const parentGoal = goalMap.get(parentChildGoal.goalId);
        const isGoalStale = parentGoal ? isStaleIsoDate(parentGoal.updatedAt) : false;
        return isChildGoalStale || isGoalStale;
      })
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, 4);
  })();

  const habitsCheckedInToday = useMemo(
    () =>
      habits.filter((habit) =>
        (habitCheckinsByHabitId[habit.id] ?? []).some((checkin) => checkin.checkInDate === todayIso),
      ),
    [habits, habitCheckinsByHabitId, todayIso],
  );

  const habitsCheckedInTodayCount = useMemo(
    () =>
      habitsCheckedInToday.length,
    [habitsCheckedInToday],
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

  const quickActionTasks = useMemo(() => {
    const openTasks = tasks.filter((task) => task.status !== "done");

    if (todayQueueSortMode === "urgent") {
      if (todayTaskFilterMode === "overdue") {
        return overdueTasks.slice(0, 8);
      }

      const taskMap = new Map<string, Task>();
      for (const task of overdueTasks) {
        taskMap.set(task.id, task);
      }
      for (const task of tasksDueToday.sort(compareTasksByDueDate)) {
        taskMap.set(task.id, task);
      }
      for (const task of dueSoonTasks) {
        taskMap.set(task.id, task);
      }

      const prioritized = Array.from(taskMap.values()).slice(0, 8);
      if (prioritized.length > 0) {
        return prioritized;
      }
    }

    if (todayQueueSortMode === "quick_wins") {
      return [...openTasks]
        .sort(compareTasksByQuickWins)
        .slice(0, 8);
    }

    return [...openTasks].sort(compareTasksByDueDate).slice(0, 8);
  }, [dueSoonTasks, overdueTasks, tasks, tasksDueToday, todayQueueSortMode, todayTaskFilterMode]);

  const completedTodayTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) === todayIso)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 4),
    [tasks, todayIso],
  );

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

    const childGoalItems: RecentlyUpdatedItem[] = childGoals.map((childGoal) => ({
      id: childGoal.id,
      kind: "childGoal",
      title: childGoal.title,
      status: childGoal.status,
      updatedAt: childGoal.updatedAt,
      parentTitle: goalMap.get(childGoal.goalId)?.title,
    }));

    const taskItems: RecentlyUpdatedItem[] = tasks.map((task) => {
      const parentGoalId = getTaskParentGoalId(task);
      const parentChildGoal = parentGoalId ? childGoalMap.get(parentGoalId) : null;
      const parentGoal = parentChildGoal
        ? goalMap.get(parentChildGoal.goalId)
        : parentGoalId
          ? goalMap.get(parentGoalId)
          : null;
      return {
        id: task.id,
        kind: "task",
        title: task.title,
        status: task.status,
        updatedAt: task.updatedAt,
        parentTitle: parentChildGoal?.title ?? parentGoal?.title,
      };
    });

    return [...goalItems, ...childGoalItems, ...taskItems]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);
  }, [goals, childGoals, tasks, goalMap, childGoalMap]);

  async function handleQuickTaskDone(taskId: string, requireConfirmation = true) {
    if (!user) {
      return;
    }

    if (requireConfirmation) {
      setPendingTaskDoneId(taskId);
      return;
    }

    setActionError(null);
    setActionInFlightId(`task-${taskId}`);

    try {
      const updatedTask = await dataRepository.updateTaskStatus(user.id, taskId, "done");
      setTasks((current) => current.map((task) => (task.id === taskId ? updatedTask : task)));
      setPendingTaskDoneId(null);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not complete that task."));
    } finally {
      setActionInFlightId(null);
    }
  }

  async function handleQuickTaskSnooze(taskId: string, days: number) {
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
    nextDueDate.setDate(nextDueDate.getDate() + days);
    const nextDueDateIso = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, "0")}-${String(
      nextDueDate.getDate(),
    ).padStart(2, "0")}`;

    setActionError(null);
    setActionInFlightId(`task-defer-${taskId}`);

    try {
      const updatedTask = await dataRepository.saveTask({
        taskId: task.id,
        ownerUid: user.id,
        parentGoalId: getTaskParentGoalId(task),
        title: task.title,
        notes: task.notes,
        dueDate: nextDueDateIso,
        originalDueDate: task.originalDueDate ?? task.dueDate ?? nextDueDateIso,
        snoozedDueDate: nextDueDateIso,
        snoozeCount: (task.snoozeCount ?? 0) + 1,
        existingTask: task,
      });

      setTasks((current) => current.map((entry) => (entry.id === taskId ? updatedTask : entry)));
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not snooze that task."));
    } finally {
      setActionInFlightId(null);
    }
  }

  async function handleQuickTaskCreate() {
    if (!user || quickTaskTitle.trim().length === 0) {
      return;
    }

    setActionError(null);
    setActionInFlightId("quick-create-task");

    try {
      const createdTask = await dataRepository.saveTask({
        ownerUid: user.id,
        parentGoalId: quickTaskChildGoalId || null,
        title: quickTaskTitle,
        notes: quickTaskNotes,
        dueDate: quickTaskDueDate || null,
        unplanned: quickTaskChildGoalId.length === 0,
      });

      setTasks((current) => [...current, createdTask]);
      setQuickTaskTitle("");
      setQuickTaskNotes("");
      setQuickTaskDueDate(todayIso);
      setIsQuickTaskModalOpen(false);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not create that task."));
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
        checkInDate: habitCheckinDate,
        notes: null,
      });

      const refreshedCheckins = await dataRepository.listHabitCheckins(user.id, habitId);
      setHabitCheckinsByHabitId((current) => ({
        ...current,
        [habitId]: refreshedCheckins,
      }));
      setHabitCheckinModalHabitId(null);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not save that habit check-in."));
    } finally {
      setActionInFlightId(null);
    }
  }

  async function handleCloseDayJournalSave() {
    if (!user) {
      return;
    }

    const hasGuidedInput =
      closeDayWhatWentRight.trim().length > 0 ||
      closeDayWhatWentWrong.trim().length > 0 ||
      closeDayWhatToAdjust.trim().length > 0 ||
      closeDayAdditionalThoughts.trim().length > 0;

    if (!hasGuidedInput) {
      setActionError("Add at least one close day note before saving.");
      return;
    }

    setActionError(null);
    setCloseDaySavedAt(null);
    setActionInFlightId("close-day-journal");

    try {
      await dataRepository.saveJournalEntry({
        ownerUid: user.id,
        title: `Daily closeout - ${closeDayIso}`,
        content: buildCloseDayJournalContent({
          whatWentRight: closeDayWhatWentRight,
          whatWentWrong: closeDayWhatWentWrong,
          whatToAdjust: closeDayWhatToAdjust,
          additionalThoughts: closeDayAdditionalThoughts,
        }),
        mood: null,
        tags: ["daily-closeout", "guided-journal", `close-day:${closeDayIso}`],
        relatedGoalId: null,
      });

      setCloseDaySavedAt(new Date().toISOString());
      setCloseDayWhatWentRight("");
      setCloseDayWhatWentWrong("");
      setCloseDayWhatToAdjust("");
      setCloseDayAdditionalThoughts("");
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not save your close day journal note."));
    } finally {
      setActionInFlightId(null);
    }
  }

  async function handleTaskUnplannedToggle(taskId: string, isChecked: boolean) {
    if (!user) {
      return;
    }

    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    setActionError(null);
    setActionInFlightId(`task-unplanned-${taskId}`);

    try {
      const updatedTask = await dataRepository.saveTask({
        taskId: task.id,
        ownerUid: user.id,
        parentGoalId: getTaskParentGoalId(task),
        title: task.title,
        notes: task.notes,
        dueDate: task.dueDate,
        unplanned: isChecked,
        existingTask: task,
      });

      setTasks((current) =>
        current.map((entry) =>
          entry.id === taskId
            ? {
                ...entry,
                ...updatedTask,
                unplanned: isChecked,
              }
            : entry,
        ),
      );
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update planned status for that task."));
    } finally {
      setActionInFlightId(null);
    }
  }

  function closeTaskQuickModal() {
    setTaskModalTaskId(null);
    setTaskModalTitle("");
    setTaskModalNotes("");
    setTaskModalDueDate("");
    setTaskModalParentGoalId("");
    setTaskModalSnoozeDays("1");
    setTaskModalError(null);
  }

  function openTaskQuickModal(taskId: string) {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    setTaskModalTaskId(taskId);
    setTaskModalTitle(task.title);
    setTaskModalNotes(task.notes);
    setTaskModalDueDate(task.dueDate ?? "");
    setTaskModalParentGoalId(getTaskParentGoalId(task) ?? "");
    setTaskModalSnoozeDays("1");
    setTaskModalError(null);
  }

  function openQuickTaskCreateModal() {
    setQuickTaskTitle("");
    setQuickTaskNotes("");
    setQuickTaskDueDate(todayIso);
    setQuickTaskChildGoalId("");
    setIsQuickTaskModalOpen(true);
  }

  function openQuickHabitCheckinModal(habitId: string) {
    setHabitCheckinModalHabitId(habitId);
    setHabitCheckinDate(todayIso);
  }

  async function handleTaskModalSnooze() {
    if (!selectedTask) {
      return;
    }

    const parsedDays = Number(taskModalSnoozeDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      setTaskModalError("Snooze days must be greater than zero.");
      return;
    }

    setTaskModalError(null);
    await handleQuickTaskSnooze(selectedTask.id, Math.round(parsedDays));
    setTaskModalTaskId(null);
  }

  async function handleTaskModalDone() {
    if (!selectedTask) {
      return;
    }

    closeTaskQuickModal();
    await handleQuickTaskDone(selectedTask.id, true);
  }

  async function handleTaskModalSave() {
    if (!selectedTask || !user) {
      return;
    }

    if (taskModalTitle.trim().length === 0) {
      setTaskModalError("Task title is required.");
      return;
    }

    const normalizedParentGoalId = taskModalParentGoalId || null;
    setTaskModalError(null);
    setActionInFlightId(`task-save-${selectedTask.id}`);

    try {
      const updatedTask = await dataRepository.saveTask({
        taskId: selectedTask.id,
        ownerUid: user.id,
        parentGoalId: normalizedParentGoalId,
        title: taskModalTitle,
        notes: taskModalNotes,
        dueDate: taskModalDueDate || null,
        unplanned: normalizedParentGoalId === null,
        existingTask: selectedTask,
      });

      setTasks((current) => current.map((task) => (task.id === selectedTask.id ? updatedTask : task)));
      closeTaskQuickModal();
    } catch (repositoryError) {
      setTaskModalError(getErrorMessage(repositoryError, "We could not save that task."));
    } finally {
      setActionInFlightId(null);
    }
  }

  async function handleTaskModalDelete() {
    if (!selectedTask || !user) {
      return;
    }

    setTaskModalError(null);
    setActionInFlightId(`task-delete-${selectedTask.id}`);

    try {
      await dataRepository.softDeleteTask(user.id, selectedTask.id);
      setTasks((current) => current.filter((task) => task.id !== selectedTask.id));
      closeTaskQuickModal();
    } catch (repositoryError) {
      setTaskModalError(getErrorMessage(repositoryError, "We could not delete that task."));
    } finally {
      setActionInFlightId(null);
    }
  }

  if (isLoading || isRefreshing) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Today Workspace</h2>
        <p className="mt-3 text-sm text-slate-700">Loading insights...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pdp-panel rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Today Workspace</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Today Workspace</h2>
        <p className="mt-3 text-sm text-slate-700">Sign in to see focus and risk insights.</p>
      </section>
    );
  }

  const modeItems: Array<{ mode: DashboardInsightsMode; label: string; count: number | null }> = [
    { mode: "today", label: "Today", count: tasksDueToday.length },
    { mode: "plan", label: "Plan", count: overdueTasks.length + dueThisWeekTasks.length },
    { mode: "review", label: "Review", count: completedTodayCount },
    { mode: "risks", label: "Risks", count: overdueTasks.length },
    { mode: "close_day", label: "Close Day", count: null },
  ];

  return (
    <WorkspaceShell
      title="Today Workspace"
      sectionClassName="pdp-panel-mobile-flat pdp-mobile-surface"
      leftRailClassName="pdp-panel-muted-mobile-flat"
      headerAside={
        <button
          type="button"
          onClick={openQuickTaskCreateModal}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          + Task
        </button>
      }
      notices={
        <>
          {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}
          {actionError ? <p className="mt-2 text-sm text-red-700">{actionError}</p> : null}
        </>
      }
      mobileNav={
        <div className="flex w-full flex-wrap gap-2" aria-label="Today workspace modes">
          {modeItems.map((item) => {
            const isActive = dashboardMode === item.mode;
            return (
              <button
                key={`mobile-mode-${item.mode}`}
                type="button"
                onClick={() => setDashboardMode(item.mode)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      }
      leftRailTitle="Today Modes"
      leftRailContent={
        <nav className="space-y-2" aria-label="Today workspace modes">
            {modeItems.map((item) => {
              const isActive = dashboardMode === item.mode;
              return (
                <button
                  key={`mode-${item.mode}`}
                  type="button"
                  onClick={() => setDashboardMode(item.mode)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{item.label}</span>
                    {item.count !== null ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
        </nav>
      }
    >
      <article className="pdp-panel-muted pdp-panel-muted-mobile-flat min-w-0 overflow-x-clip">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{modeItems.find((item) => item.mode === dashboardMode)?.label}</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatDateLabel(todayIso)}
            </span>
          </div>

          {dashboardMode === "today" ? (
            <>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">Focus on what needs action now.</p>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="pdp-solid-surface pdp-card-mobile-ghost rounded-xl border border-slate-200 px-3 py-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Tasks due today</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tasksDueToday.length}</p>
            <p className="text-xs text-slate-600">Need action</p>
          </div>
          <div className="pdp-solid-surface pdp-card-mobile-ghost rounded-xl border border-slate-200 px-3 py-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Habit check-ins</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{habitsCheckedInTodayCount}</p>
            <p className="text-xs text-slate-600">of {habits.length} active habits</p>
            {habitsCheckedInToday.length > 0 ? (
              <p className="mt-1 truncate text-[11px] text-slate-500">
                Checked in: {habitsCheckedInToday.map((habit) => habit.title).slice(0, 3).join(", ")}
                {habitsCheckedInToday.length > 3 ? "..." : ""}
              </p>
            ) : null}
          </div>
          <div className="pdp-solid-surface pdp-card-mobile-ghost rounded-xl border border-slate-200 px-3 py-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Tasks completed</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{completedTodayCount}</p>
            <p className="text-xs text-slate-600" data-testid="planned-unplanned-summary">
              {plannedVsUnplannedToday.planned} planned | {plannedVsUnplannedToday.unplanned} unplanned
            </p>
          </div>
          <div className="pdp-card-mobile-ghost rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 shadow-sm">
            <p className="text-sm font-semibold text-amber-800">Overdue now</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{overdueTasks.length}</p>
            {overdueTasks.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setDashboardMode("today");
                  setTodayQueueSortMode("urgent");
                  setTodayTaskFilterMode("overdue");
                }}
                className="mt-1 rounded-full border border-amber-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
              >
                Review overdue
              </button>
            ) : (
              <p className="text-xs text-amber-700">Clear</p>
            )}
          </div>
              </div>

                <div className="mt-4 grid min-w-0 gap-3 xl:[grid-template-columns:repeat(2,minmax(0,1fr))]">
              <div className="min-w-0 pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">Quick task actions</p>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <div className="flex max-w-full flex-wrap rounded-full border border-slate-300 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTodayQueueSortMode("urgent");
                      setTodayTaskFilterMode("all");
                    }}
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                      todayQueueSortMode === "urgent" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Urgent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTodayQueueSortMode("quick_wins");
                      setTodayTaskFilterMode("all");
                    }}
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                      todayQueueSortMode === "quick_wins" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Quick Wins
                  </button>
                </div>
                {todayTaskFilterMode === "overdue" ? (
                  <button
                    type="button"
                    onClick={() => setTodayTaskFilterMode("all")}
                    className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
                  >
                    Overdue only
                  </button>
                ) : null}
              </div>
            </div>
            {quickActionTasks.length === 0 && completedTodayTasks.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No immediate task actions.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {quickActionTasks.length > 0 ? (
                  <ul className="space-y-2">
                    {quickActionTasks.map((task) => (
                      <li key={task.id} className="pdp-card-mobile-ghost flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 px-2 py-2">
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => openTaskQuickModal(task.id)}
                            className="w-full truncate text-left text-sm font-medium text-slate-900 hover:underline"
                            data-testid={`quick-task-title-${task.id}`}
                          >
                            {task.title}
                          </button>
                          <p className="mt-1 text-[11px] text-slate-500">{buildTaskDueLabel(task, todayIso)}</p>
                          <label className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={Boolean(task.unplanned)}
                              disabled={actionInFlightId === `task-unplanned-${task.id}`}
                              onChange={(event) => void handleTaskUnplannedToggle(task.id, event.currentTarget.checked)}
                              data-testid={`task-unplanned-checkbox-${task.id}`}
                            />
                            <span>Unplanned</span>
                          </label>
                        </div>
                        <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                          <button
                            type="button"
                            onClick={() => void handleQuickTaskSnooze(task.id, 1)}
                            disabled={actionInFlightId === `task-defer-${task.id}`}
                            className={`${QUICK_ACTION_BUTTON_CLASS} border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-50`}
                          >
                            {actionInFlightId === `task-defer-${task.id}` ? "Saving..." : "+1d"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleQuickTaskDone(task.id, true)}
                            disabled={actionInFlightId === `task-${task.id}`}
                            className={`${QUICK_ACTION_BUTTON_CLASS} border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50`}
                          >
                            {actionInFlightId === `task-${task.id}` ? "Saving..." : "Mark done"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {completedTodayTasks.length > 0 ? (
                  <div className="space-y-2">
                    {quickActionTasks.length > 0 ? <div className="border-t border-slate-200" /> : null}
                    <p className="text-xs font-semibold text-slate-500">Completed today</p>
                    <ul className="space-y-2">
                      {completedTodayTasks.map((task) => (
                        <li key={task.id} className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                          <button
                            type="button"
                            onClick={() => openTaskQuickModal(task.id)}
                            className="truncate text-left text-sm text-slate-600 line-through hover:underline"
                            data-testid={`completed-task-title-${task.id}`}
                          >
                            {task.title}
                          </button>
                          <p className="mt-1 text-[11px] text-slate-500">{buildTaskDueLabel(task, todayIso)}</p>
                          <label className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={Boolean(task.unplanned)}
                              disabled={actionInFlightId === `task-unplanned-${task.id}`}
                              onChange={(event) => void handleTaskUnplannedToggle(task.id, event.currentTarget.checked)}
                              data-testid={`task-unplanned-checkbox-${task.id}`}
                            />
                            <span>Unplanned</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="min-w-0 pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-sm font-semibold text-slate-700">Quick habit check-ins</p>
            {habitsNeedingCheckin.slice(0, 20).length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">All tracked habits are checked in today.</p>
            ) : (
              <ul className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                {habitsNeedingCheckin.slice(0, 20).map((habit) => (
                  <li key={habit.id} className="pdp-card-mobile-ghost min-w-0 rounded-lg border border-slate-200 px-2 py-2">
                    <p className="truncate text-sm font-medium text-slate-900">{habit.title}</p>
                    <button
                      type="button"
                      onClick={() => openQuickHabitCheckinModal(habit.id)}
                      disabled={actionInFlightId === `habit-${habit.id}`}
                      className={`${QUICK_ACTION_BUTTON_CLASS} mt-2 w-full border-indigo-300 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50`}
                    >
                      {actionInFlightId === `habit-${habit.id}` ? "Saving..." : "Check in"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
              </div>
            </>
          ) : null}

          {dashboardMode === "close_day" ? (
            <div className="mt-3 pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Close day guided journal</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCloseDayDateOffset((current) => current - 1);
                  setCloseDaySavedAt(null);
                }}
                className="rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                aria-label="Previous close day date"
              >
                ←
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatDateLabel(closeDayIso)}</span>
              {closeDayDateOffset < 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setCloseDayDateOffset((current) => Math.min(current + 1, 0));
                    setCloseDaySavedAt(null);
                  }}
                  className="rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  aria-label="Next close day date"
                >
                  →
                </button>
              ) : null}
              {closeDaySavedAt ? <p className="text-xs text-emerald-700">Saved {formatDateTimeLabel(closeDaySavedAt)}</p> : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            End your day with prompts, then add any free-write thoughts.
          </p>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              What went right?
              <textarea
                value={closeDayWhatWentRight}
                onChange={(event) => setCloseDayWhatWentRight(event.currentTarget.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
                placeholder="Wins, momentum, completed priorities..."
                data-testid="close-day-right"
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              What went wrong?
              <textarea
                value={closeDayWhatWentWrong}
                onChange={(event) => setCloseDayWhatWentWrong(event.currentTarget.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
                placeholder="Blockers, surprises, friction..."
                data-testid="close-day-wrong"
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              What will you adjust tomorrow?
              <textarea
                value={closeDayWhatToAdjust}
                onChange={(event) => setCloseDayWhatToAdjust(event.currentTarget.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
                placeholder="One change to improve focus tomorrow..."
                data-testid="close-day-adjust"
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Additional thoughts (free-write)
              <textarea
                value={closeDayAdditionalThoughts}
                onChange={(event) => setCloseDayAdditionalThoughts(event.currentTarget.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
                placeholder="Anything else you want to capture..."
                data-testid="close-day-freewrite"
              />
            </label>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void handleCloseDayJournalSave()}
              disabled={actionInFlightId === "close-day-journal"}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionInFlightId === "close-day-journal" ? "Saving..." : "Save close day note"}
            </button>
          </div>
            </div>
          ) : null}

          {dashboardMode === "plan" ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div className="pdp-card-mobile-ghost rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-3">
                <p className="text-sm font-semibold text-rose-700">Past due</p>
                {overdueTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-rose-700">No overdue tasks.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {overdueTasks.slice(0, 6).map((task) => (
                      <li key={task.id} className="pdp-card-mobile-ghost rounded-lg border border-rose-200 bg-white px-2 py-2">
                        <button
                          type="button"
                          onClick={() => openTaskQuickModal(task.id)}
                          className="w-full truncate text-left text-sm font-medium text-slate-900 hover:underline"
                        >
                          {task.title}
                        </button>
                        <p className="mt-1 text-xs text-rose-700">Due {formatDateLabel(task.dueDate)} (overdue)</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-sm font-semibold text-slate-700">Due this week</p>
                {dueThisWeekTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No open tasks due in the next 7 days.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {dueThisWeekTasks.map((task) => (
                      <li key={task.id} className="pdp-card-mobile-ghost rounded-lg border border-slate-200 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => openTaskQuickModal(task.id)}
                          className="w-full truncate text-left text-sm font-medium text-slate-900 hover:underline"
                          data-testid={`due-week-task-title-${task.id}`}
                        >
                          {task.title}
                        </button>
                        <p className="mt-1 text-xs text-slate-600">Due {formatDateLabel(task.dueDate)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-sm font-semibold text-slate-700">Tasks due soon</p>
                {dueSoonBeyondThisWeekTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No tasks in the due-soon window.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {dueSoonBeyondThisWeekTasks.map((task) => (
                      <li key={task.id} className="pdp-card-mobile-ghost rounded-lg border border-slate-200 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => openTaskQuickModal(task.id)}
                          className="w-full truncate text-left text-sm font-medium text-slate-900 hover:underline"
                        >
                          {task.title}
                        </button>
                        <p className="mt-1 text-xs text-slate-600">Due {formatDateLabel(task.dueDate)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {dashboardMode === "risks" ? (
            <div className="mt-3 grid min-w-0 gap-2 xl:grid-cols-2">

            <div className="min-w-0 pdp-card-mobile-ghost rounded-xl border border-rose-200 bg-rose-50/40 px-3 py-3">
              <p className="text-sm font-semibold text-rose-800">Stale in-progress</p>
              {staleInProgressTasks.length === 0 ? (
                <p className="mt-2 text-sm text-rose-700">No stale in-progress tasks.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {staleInProgressTasks.map((task) => (
                    <li key={task.id} className="pdp-card-mobile-ghost rounded-lg border border-rose-200 bg-white px-2 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenItem?.("task", task.id)}
                        className="w-full truncate text-left text-sm font-medium text-slate-900 hover:underline"
                        data-testid={`stale-task-title-${task.id}`}
                      >
                        {task.title}
                      </button>
                      <p className="mt-1 text-xs text-slate-600">Updated {formatDateLabel(task.updatedAt.slice(0, 10))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0 pdp-card-mobile-ghost rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-3">
              <p className="text-sm font-semibold text-violet-800">Blocked by parent inactivity</p>
              {blockedByParentInactivityTasks.length === 0 ? (
                <p className="mt-2 text-sm text-violet-700">No parent-chain blockers flagged.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {blockedByParentInactivityTasks.map((task) => {
                    const parentGoalId = getTaskParentGoalId(task);
                    const parentChildGoal = parentGoalId ? childGoalMap.get(parentGoalId) : null;
                    const parentGoal = parentChildGoal
                      ? goalMap.get(parentChildGoal.goalId)
                      : parentGoalId
                        ? goalMap.get(parentGoalId)
                        : null;
                    const parentPath = [parentGoal?.title, parentChildGoal?.title].filter((value): value is string => Boolean(value)).join(" -> ");

                    return (
                      <li key={task.id} className="pdp-card-mobile-ghost rounded-lg border border-violet-200 bg-white px-2 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenItem?.("task", task.id)}
                          className="w-full truncate text-left text-sm font-medium text-slate-900 hover:underline"
                          data-testid={`blocked-task-title-${task.id}`}
                        >
                          {task.title}
                        </button>
                        <p className="mt-1 truncate text-xs text-slate-600">{parentPath || "Parent chain"}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </div>
          ) : null}

          {dashboardMode === "review" ? (
            <section className="mt-3 space-y-4">
              <article className="pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Overview</h3>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="pdp-card pdp-card-mobile-ghost rounded-xl p-4">
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

              <div className="pdp-card pdp-card-mobile-ghost rounded-xl p-4">
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

              <div className="grid gap-3 xl:grid-cols-2">
                <article className="pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white p-4">
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
                <article className="pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white p-4">
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
      </article>

      <CrudModal
        isOpen={isQuickTaskModalOpen}
        title="Quick Add Task"
        onClose={() => setIsQuickTaskModalOpen(false)}
      >
        <div className="grid gap-3">
          <label className="text-sm text-slate-700">
            Task title
            <input
              value={quickTaskTitle}
              onChange={(event) => setQuickTaskTitle(event.currentTarget.value)}
              className="pdp-control mt-1 rounded-lg"
              placeholder="Add a task for today"
            />
          </label>

          <label className="text-sm text-slate-700">
            Parent goal (optional)
            <select
              value={quickTaskChildGoalId}
              onChange={(event) => setQuickTaskChildGoalId(event.currentTarget.value)}
              className="pdp-control mt-1 rounded-lg"
            >
              <option value="">Select a parent goal</option>
              {childGoals.map((childGoal) => (
                <option key={childGoal.id} value={childGoal.id}>
                  {childGoal.title}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Due date
            <input
              type="date"
              value={quickTaskDueDate}
              onChange={(event) => setQuickTaskDueDate(event.currentTarget.value)}
              className="pdp-control mt-1 rounded-lg"
            />
          </label>

          <label className="text-sm text-slate-700">
            Notes
            <textarea
              value={quickTaskNotes}
              onChange={(event) => setQuickTaskNotes(event.currentTarget.value)}
              rows={3}
              className="pdp-control mt-1 rounded-lg"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsQuickTaskModalOpen(false)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleQuickTaskCreate()}
              disabled={actionInFlightId === "quick-create-task" || quickTaskTitle.trim().length === 0}
              className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionInFlightId === "quick-create-task" ? "Saving..." : "Create Task"}
            </button>
          </div>
        </div>
      </CrudModal>

      <CrudModal
        isOpen={selectedTask !== null}
        title={selectedTask ? selectedTask.title : "Task"}
        onClose={closeTaskQuickModal}
      >
        {selectedTask ? (
          <div className="grid gap-3">
            <p className="text-sm text-slate-600">{buildTaskDueLabel(selectedTask, todayIso)}</p>
            <p className="text-xs text-slate-500">Snoozed {selectedTask.snoozeCount ?? 0} times</p>
            {selectedTask.originalDueDate ? (
              <p className="text-xs text-slate-500">Original due date: {formatDateLabel(selectedTask.originalDueDate)}</p>
            ) : null}
            {selectedTask.snoozedDueDate ? (
              <p className="text-xs text-slate-500">Last snoozed to: {formatDateLabel(selectedTask.snoozedDueDate)}</p>
            ) : null}

            <label className="text-sm text-slate-700">
              Task title
              <input
                value={taskModalTitle}
                onChange={(event) => setTaskModalTitle(event.currentTarget.value)}
                className="pdp-control mt-1 rounded-lg"
              />
            </label>

            <label className="text-sm text-slate-700">
              Parent goal (optional)
              <select
                value={taskModalParentGoalId}
                onChange={(event) => setTaskModalParentGoalId(event.currentTarget.value)}
                className="pdp-control mt-1 rounded-lg"
              >
                <option value="">No parent (unplanned)</option>
                {taskParentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Due date
              <input
                type="date"
                value={taskModalDueDate}
                onChange={(event) => setTaskModalDueDate(event.currentTarget.value)}
                className="pdp-control mt-1 rounded-lg"
              />
            </label>

            <label className="text-sm text-slate-700">
              Notes
              <textarea
                value={taskModalNotes}
                onChange={(event) => setTaskModalNotes(event.currentTarget.value)}
                rows={3}
                className="pdp-control mt-1 rounded-lg"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleTaskModalSave()}
                disabled={actionInFlightId === `task-save-${selectedTask.id}` || taskModalTitle.trim().length === 0}
                className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInFlightId === `task-save-${selectedTask.id}` ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => void handleTaskModalDelete()}
                disabled={actionInFlightId === `task-delete-${selectedTask.id}`}
                className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInFlightId === `task-delete-${selectedTask.id}` ? "Deleting..." : "Delete task"}
              </button>
              <button
                type="button"
                onClick={() => void handleTaskModalDone()}
                disabled={actionInFlightId === `task-${selectedTask.id}`}
                className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInFlightId === `task-${selectedTask.id}` ? "Saving..." : "Mark Complete"}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Snooze task</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={taskModalSnoozeDays}
                  onChange={(event) => setTaskModalSnoozeDays(event.currentTarget.value)}
                  className="pdp-control w-20 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => void handleTaskModalSnooze()}
                  disabled={actionInFlightId === `task-defer-${selectedTask.id}`}
                  className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionInFlightId === `task-defer-${selectedTask.id}` ? "Saving..." : "Snooze"}
                </button>
              </div>
            </div>

            {taskModalError ? <p className="text-sm text-red-700">{taskModalError}</p> : null}
          </div>
        ) : null}
      </CrudModal>

      <CrudModal
        isOpen={pendingTaskDone !== null}
        title="Confirm Task Completion"
        onClose={() => setPendingTaskDoneId(null)}
      >
        {pendingTaskDone ? (
          <div className="grid gap-3">
            <p className="text-sm text-slate-700">Mark this task as done?</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">{pendingTaskDone.title}</p>
              <p className="mt-1 text-xs text-slate-500">{buildTaskDueLabel(pendingTaskDone, todayIso)}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTaskDoneId(null)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleQuickTaskDone(pendingTaskDone.id, false)}
                disabled={actionInFlightId === `task-${pendingTaskDone.id}`}
                className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInFlightId === `task-${pendingTaskDone.id}` ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : null}
      </CrudModal>

      <CrudModal
        isOpen={selectedHabitForQuickCheckin !== null}
        title={selectedHabitForQuickCheckin ? `Check in: ${selectedHabitForQuickCheckin.title}` : "Check in habit"}
        onClose={() => setHabitCheckinModalHabitId(null)}
      >
        {selectedHabitForQuickCheckin ? (
          <div className="grid gap-3">
            <label className="text-sm text-slate-700">
              Check-in date
              <input
                type="date"
                value={habitCheckinDate}
                max={todayIso}
                onChange={(event) => setHabitCheckinDate(event.currentTarget.value)}
                className="pdp-control mt-1 rounded-lg"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHabitCheckinModalHabitId(null)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleQuickHabitCheckin(selectedHabitForQuickCheckin.id)}
                disabled={actionInFlightId === `habit-${selectedHabitForQuickCheckin.id}` || !habitCheckinDate}
                className="rounded-full border border-indigo-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInFlightId === `habit-${selectedHabitForQuickCheckin.id}` ? "Saving..." : "Confirm Check-in"}
              </button>
            </div>
          </div>
        ) : null}
      </CrudModal>
    </WorkspaceShell>
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

function buildCloseDayJournalContent(input: {
  whatWentRight: string;
  whatWentWrong: string;
  whatToAdjust: string;
  additionalThoughts: string;
}) {
  const right = input.whatWentRight.trim() || "No notes added.";
  const wrong = input.whatWentWrong.trim() || "No notes added.";
  const adjust = input.whatToAdjust.trim() || "No notes added.";
  const extra = input.additionalThoughts.trim() || "No additional thoughts.";

  return [
    "## What went right",
    right,
    "",
    "## What went wrong",
    wrong,
    "",
    "## What to adjust tomorrow",
    adjust,
    "",
    "## Additional thoughts",
    extra,
  ].join("\n");
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildTaskDueLabel(task: Task, todayIso: string) {
  if (!task.dueDate) {
    return "No due date";
  }

  const dueDate = parseDate(task.dueDate);
  const today = parseDate(todayIso);

  if (dueDate && today && dueDate < today) {
    return `Overdue: ${formatDateLabel(task.dueDate)}`;
  }

  if (task.dueDate === todayIso) {
    return "Due today";
  }

  return `Due ${formatDateLabel(task.dueDate)}`;
}