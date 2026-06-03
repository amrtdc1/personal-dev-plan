"use client";

import { useEffect, useMemo, useState } from "react";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Goal, Habit, HabitCheckin, ItemStatus, ChildGoal, PlanningCommitment, Task } from "@/lib/domain/types";
import { getTaskParentGoalId } from "@/lib/domain/types";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { CrudModal } from "@/components/ui/crud-modal";
import { AsyncStateContainer } from "@/components/ui/async-state-container";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSection } from "@/components/ui/loading-section";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { IconButton } from "@/components/ui/icon-button";
import { buildHabitMetrics, type HabitMetricSnapshot } from "@/components/dashboard/habit-metrics";
import { CheckCircle2, Clock, Loader2, Plus, Save, Trash2, X } from "lucide-react";

type DashboardInsightsMode = "today" | "close_day";
type TodayQueueSortMode = "urgent" | "quick_wins";
type TodayTaskFilterMode = "all" | "overdue";
type TodayCommitmentFilterMode = "all" | "none" | string;

const DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY = "pdp.dashboardInsightsView";
const DASHBOARD_TODAY_QUEUE_SORT_STORAGE_KEY = "pdp.dashboardTodayQueueSort";
const DASHBOARD_TODAY_COMMITMENT_FILTER_STORAGE_KEY = "pdp.dashboardTodayCommitmentFilter";
const QUICK_ACTION_TASK_PAGE_SIZE = 6;
const COMPLETED_TASK_PAGE_SIZE = 6;
const HABIT_CHECKIN_PAGE_SIZE = 15;

export function DashboardInsights() {
  const { isLoading, user, error } = db.useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [childGoals, setChildGoals] = useState<ChildGoal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [planningCommitments, setPlanningCommitments] = useState<PlanningCommitment[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitCheckinsByHabitId, setHabitCheckinsByHabitId] = useState<Record<string, HabitCheckin[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInFlightId, setActionInFlightId] = useState<string | null>(null);
  const [closeDaySavedAt, setCloseDaySavedAt] = useState<string | null>(null);
  const [closeDayBackfillOpen, setCloseDayBackfillOpen] = useState(false);
  const [closeDayTargetDate, setCloseDayTargetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closeDayWhatWentRight, setCloseDayWhatWentRight] = useState("");
  const [closeDayWhatWentWrong, setCloseDayWhatWentWrong] = useState("");
  const [closeDayWhatToAdjust, setCloseDayWhatToAdjust] = useState("");
  const [closeDayAdditionalThoughts, setCloseDayAdditionalThoughts] = useState("");
  const [isQuickTaskModalOpen, setIsQuickTaskModalOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskNotes, setQuickTaskNotes] = useState("");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("");
  const [quickTaskChildGoalId, setQuickTaskChildGoalId] = useState("");
  const [quickTaskCommitmentId, setQuickTaskCommitmentId] = useState("");
  const [taskModalTaskId, setTaskModalTaskId] = useState<string | null>(null);
  const [taskModalTitle, setTaskModalTitle] = useState("");
  const [taskModalNotes, setTaskModalNotes] = useState("");
  const [taskModalDueDate, setTaskModalDueDate] = useState("");
  const [taskModalParentGoalId, setTaskModalParentGoalId] = useState("");
  const [taskModalCommitmentId, setTaskModalCommitmentId] = useState("");
  const [taskModalSnoozeDays, setTaskModalSnoozeDays] = useState("1");
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [pendingTaskDoneId, setPendingTaskDoneId] = useState<string | null>(null);
  const [habitCheckinModalHabitId, setHabitCheckinModalHabitId] = useState<string | null>(null);
  const [habitDetailModalHabitId, setHabitDetailModalHabitId] = useState<string | null>(null);
  const [habitCheckinDate, setHabitCheckinDate] = useState("");
  const [todayTaskFilterMode, setTodayTaskFilterMode] = useState<TodayTaskFilterMode>("all");
  const [quickActionTaskPage, setQuickActionTaskPage] = useState(1);
  const [completedTaskPage, setCompletedTaskPage] = useState(1);
  const [habitCheckinPage, setHabitCheckinPage] = useState(1);
  const [todayQueueSortMode, setTodayQueueSortMode] = useState<TodayQueueSortMode>(() => {
    if (typeof window === "undefined") {
      return "urgent";
    }

    const stored = window.localStorage.getItem(DASHBOARD_TODAY_QUEUE_SORT_STORAGE_KEY);
    return stored === "quick_wins" ? "quick_wins" : "urgent";
  });
  const [todayCommitmentFilterMode, setTodayCommitmentFilterMode] = useState<TodayCommitmentFilterMode>(() => {
    if (typeof window === "undefined") {
      return "all";
    }

    const stored = window.localStorage.getItem(DASHBOARD_TODAY_COMMITMENT_FILTER_STORAGE_KEY);
    if (!stored || stored.length === 0) {
      return "all";
    }

    return stored;
  });
  const [dashboardMode, setDashboardMode] = useState<DashboardInsightsMode>(() => {
    if (typeof window === "undefined") {
      return "today";
    }

    const stored = window.localStorage.getItem(DASHBOARD_INSIGHTS_VIEW_STORAGE_KEY);
    if (stored === "close_day") {
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

        let loadedCommitments: PlanningCommitment[] = [];
        try {
          const commitmentsResponse = await fetch("/api/planning/commitments", { cache: "no-store" });
          if (commitmentsResponse.ok) {
            const commitmentsBody = (await commitmentsResponse.json()) as { commitments?: PlanningCommitment[] };
            loadedCommitments = (commitmentsBody.commitments ?? []).sort(
              (left, right) => left.title.localeCompare(right.title),
            );
          }
        } catch {
          loadedCommitments = [];
        }

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
          setPlanningCommitments(loadedCommitments);
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
  const commitmentOptions = useMemo(
    () =>
      planningCommitments.map((commitment) => {
        const linkedGoal = commitment.linkedGoalId ? goalMap.get(commitment.linkedGoalId) : null;
        const goalSuffix = linkedGoal ? ` | Goal: ${linkedGoal.title}` : "";
        return {
          id: commitment.id,
          label: `${commitment.level} #${commitment.rank} - ${commitment.title}${goalSuffix}`,
        };
      }),
    [goalMap, planningCommitments],
  );
  const effectiveTodayCommitmentFilterMode = useMemo(() => {
    if (todayCommitmentFilterMode === "all" || todayCommitmentFilterMode === "none") {
      return todayCommitmentFilterMode;
    }

    return planningCommitments.some((commitment) => commitment.id === todayCommitmentFilterMode)
      ? todayCommitmentFilterMode
      : "all";
  }, [planningCommitments, todayCommitmentFilterMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      DASHBOARD_TODAY_COMMITMENT_FILTER_STORAGE_KEY,
      effectiveTodayCommitmentFilterMode,
    );
  }, [effectiveTodayCommitmentFilterMode]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const closeDayIso = closeDayTargetDate;

  const selectedTask = useMemo(
    () => (taskModalTaskId ? tasks.find((task) => task.id === taskModalTaskId) ?? null : null),
    [taskModalTaskId, tasks],
  );

  const selectedHabitForQuickCheckin = useMemo(
    () => (habitCheckinModalHabitId ? habits.find((habit) => habit.id === habitCheckinModalHabitId) ?? null : null),
    [habitCheckinModalHabitId, habits],
  );

  const selectedHabitForDetail = useMemo(
    () => (habitDetailModalHabitId ? habits.find((habit) => habit.id === habitDetailModalHabitId) ?? null : null),
    [habitDetailModalHabitId, habits],
  );

  const selectedHabitDetailMetrics = useMemo(() => {
    if (!selectedHabitForDetail) {
      return defaultHabitMetricSnapshot();
    }

    return buildHabitMetrics(selectedHabitForDetail, habitCheckinsByHabitId[selectedHabitForDetail.id] ?? []);
  }, [habitCheckinsByHabitId, selectedHabitForDetail]);

  const selectedHabitDetailActivityCells = useMemo(() => {
    if (!selectedHabitForDetail) {
      return [] as boolean[];
    }

    return buildRecentActivityCells(selectedHabitForDetail, habitCheckinsByHabitId[selectedHabitForDetail.id] ?? []);
  }, [habitCheckinsByHabitId, selectedHabitForDetail]);

  const pendingTaskDone = useMemo(
    () => (pendingTaskDoneId ? tasks.find((task) => task.id === pendingTaskDoneId) ?? null : null),
    [pendingTaskDoneId, tasks],
  );

  const commitmentScopedTasks = useMemo(() => {
    if (effectiveTodayCommitmentFilterMode === "all") {
      return tasks;
    }

    if (effectiveTodayCommitmentFilterMode === "none") {
      return tasks.filter((task) => !task.commitmentId);
    }

    return tasks.filter((task) => task.commitmentId === effectiveTodayCommitmentFilterMode);
  }, [effectiveTodayCommitmentFilterMode, tasks]);

  const tasksDueToday = useMemo(
    () => commitmentScopedTasks.filter((task) => task.status !== "done" && task.dueDate === todayIso),
    [commitmentScopedTasks, todayIso],
  );

  const completedTodayCount = useMemo(
    () => commitmentScopedTasks.filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) === todayIso).length,
    [commitmentScopedTasks, todayIso],
  );

  const completedTodayTasksAll = useMemo(
    () => commitmentScopedTasks.filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) === todayIso),
    [commitmentScopedTasks, todayIso],
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
      commitmentScopedTasks
        .filter((task) => task.status !== "done" && Boolean(task.dueDate))
        .filter((task) => {
          const dueDate = parseDate(task.dueDate);
          const today = parseDate(todayIso);
          return Boolean(dueDate && today && dueDate < today);
        })
        .sort(compareTasksByDueDate),
    [commitmentScopedTasks, todayIso],
  );

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

  const quickCheckinMetricsByHabitId = useMemo(() => {
    const map: Record<string, ReturnType<typeof buildHabitMetrics>> = {};
    for (const habit of habitsNeedingCheckin) {
      map[habit.id] = buildHabitMetrics(habit, habitCheckinsByHabitId[habit.id] ?? []);
    }
    return map;
  }, [habitsNeedingCheckin, habitCheckinsByHabitId]);

  const quickActionTasks = useMemo(() => {
    const openTasks = commitmentScopedTasks.filter((task) => task.status !== "done");

    if (todayQueueSortMode === "urgent") {
      if (todayTaskFilterMode === "overdue") {
        return overdueTasks;
      }

      const taskMap = new Map<string, Task>();
      for (const task of overdueTasks) {
        taskMap.set(task.id, task);
      }
      for (const task of tasksDueToday.sort(compareTasksByDueDate)) {
        taskMap.set(task.id, task);
      }
      const prioritized = Array.from(taskMap.values());
      if (prioritized.length > 0) {
        return prioritized;
      }
    }

    if (todayQueueSortMode === "quick_wins") {
      return [...openTasks].sort(compareTasksByQuickWins);
    }

    return [...openTasks].sort(compareTasksByDueDate);
  }, [commitmentScopedTasks, overdueTasks, tasksDueToday, todayQueueSortMode, todayTaskFilterMode]);

  const completedTodayTasks = useMemo(
    () =>
      commitmentScopedTasks
        .filter((task) => task.status === "done" && task.updatedAt.slice(0, 10) === todayIso)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [commitmentScopedTasks, todayIso],
  );

  const quickActionTaskPageCount = useMemo(
    () => Math.max(1, Math.ceil(quickActionTasks.length / QUICK_ACTION_TASK_PAGE_SIZE)),
    [quickActionTasks.length],
  );
  const completedTaskPageCount = useMemo(
    () => Math.max(1, Math.ceil(completedTodayTasks.length / COMPLETED_TASK_PAGE_SIZE)),
    [completedTodayTasks.length],
  );
  const habitCheckinPageCount = useMemo(
    () => Math.max(1, Math.ceil(habitsNeedingCheckin.length / HABIT_CHECKIN_PAGE_SIZE)),
    [habitsNeedingCheckin.length],
  );

  const pagedQuickActionTasks = useMemo(() => {
    const start = (quickActionTaskPage - 1) * QUICK_ACTION_TASK_PAGE_SIZE;
    return quickActionTasks.slice(start, start + QUICK_ACTION_TASK_PAGE_SIZE);
  }, [quickActionTaskPage, quickActionTasks]);

  const pagedCompletedTodayTasks = useMemo(() => {
    const start = (completedTaskPage - 1) * COMPLETED_TASK_PAGE_SIZE;
    return completedTodayTasks.slice(start, start + COMPLETED_TASK_PAGE_SIZE);
  }, [completedTaskPage, completedTodayTasks]);

  const pagedHabitsNeedingCheckin = useMemo(() => {
    const start = (habitCheckinPage - 1) * HABIT_CHECKIN_PAGE_SIZE;
    return habitsNeedingCheckin.slice(start, start + HABIT_CHECKIN_PAGE_SIZE);
  }, [habitCheckinPage, habitsNeedingCheckin]);

  useEffect(() => {
    setQuickActionTaskPage(1);
  }, [todayQueueSortMode, todayTaskFilterMode, effectiveTodayCommitmentFilterMode]);

  useEffect(() => {
    setCompletedTaskPage(1);
  }, [effectiveTodayCommitmentFilterMode]);

  useEffect(() => {
    setHabitCheckinPage(1);
  }, [todayIso]);

  useEffect(() => {
    if (quickActionTaskPage > quickActionTaskPageCount) {
      setQuickActionTaskPage(quickActionTaskPageCount);
    }
  }, [quickActionTaskPage, quickActionTaskPageCount]);

  useEffect(() => {
    if (completedTaskPage > completedTaskPageCount) {
      setCompletedTaskPage(completedTaskPageCount);
    }
  }, [completedTaskPage, completedTaskPageCount]);

  useEffect(() => {
    if (habitCheckinPage > habitCheckinPageCount) {
      setHabitCheckinPage(habitCheckinPageCount);
    }
  }, [habitCheckinPage, habitCheckinPageCount]);

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
        commitmentId: task.commitmentId,
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
        commitmentId: quickTaskCommitmentId || null,
        title: quickTaskTitle,
        notes: quickTaskNotes,
        dueDate: quickTaskDueDate || null,
        unplanned: quickTaskChildGoalId.length === 0 && quickTaskCommitmentId.length === 0,
      });

      setTasks((current) => [...current, createdTask]);
      setQuickTaskTitle("");
      setQuickTaskNotes("");
      setQuickTaskDueDate(todayIso);
      setQuickTaskCommitmentId("");
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

    if (closeDayTargetDate > todayIso) {
      setActionError("Close day date cannot be in the future.");
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
      setCloseDayBackfillOpen(false);
      setCloseDayTargetDate(todayIso);
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
        commitmentId: task.commitmentId,
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
    setTaskModalCommitmentId("");
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
    setTaskModalCommitmentId(task.commitmentId ?? "");
    setTaskModalSnoozeDays("1");
    setTaskModalError(null);
  }

  function openQuickTaskCreateModal() {
    setQuickTaskTitle("");
    setQuickTaskNotes("");
    setQuickTaskDueDate(todayIso);
    setQuickTaskChildGoalId("");
    setQuickTaskCommitmentId("");
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
    const normalizedCommitmentId = taskModalCommitmentId || null;
    setTaskModalError(null);
    setActionInFlightId(`task-save-${selectedTask.id}`);

    try {
      const updatedTask = await dataRepository.saveTask({
        taskId: selectedTask.id,
        ownerUid: user.id,
        parentGoalId: normalizedParentGoalId,
        commitmentId: normalizedCommitmentId,
        title: taskModalTitle,
        notes: taskModalNotes,
        dueDate: taskModalDueDate || null,
        unplanned: normalizedParentGoalId === null && normalizedCommitmentId === null,
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

  const authErrorMessage = error?.message ?? null;

  if (!user && !isLoading && !isRefreshing && !authErrorMessage) {
    return (
      <EmptyStateCard
        title="Today Workspace"
        description="Sign in to see focus and risk insights."
      />
    );
  }

  const modeItems: Array<{ mode: DashboardInsightsMode; label: string; count: number | null }> = [
    { mode: "today", label: "Today", count: tasksDueToday.length },
    { mode: "close_day", label: "Close Day", count: null },
  ];

  return (
    <AsyncStateContainer
      isLoading={isLoading || isRefreshing}
      loadingFallback={<LoadingSection title="Today Workspace" message="Loading insights..." />}
      errorMessage={authErrorMessage}
      errorFallback={
        <ErrorBanner
          title="Today Workspace"
          message={authErrorMessage ?? "We could not load Today workspace details."}
        />
      }
    >
    <WorkspaceShell
      title="Today Workspace"
      sectionClassName="pdp-panel-mobile-flat pdp-mobile-surface"
      leftRailClassName="pdp-panel-muted-mobile-flat"
      headerAside={
        <IconButton onClick={openQuickTaskCreateModal} title="Create task" variant="primary">
          <Plus className="h-4 w-4" />
        </IconButton>
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
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatDateLabel(todayIso)}
            </span>
          </div>

          {dashboardMode === "today" ? (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="pdp-solid-surface pdp-card-mobile-ghost rounded-xl border border-slate-200 px-3 py-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Tasks due today</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tasksDueToday.length}</p>
          </div>
          <div className="pdp-solid-surface pdp-card-mobile-ghost rounded-xl border border-slate-200 px-3 py-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Habit check-ins</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{habitsCheckedInTodayCount}</p>
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
              <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
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
                <select
                  value={effectiveTodayCommitmentFilterMode}
                  onChange={(event) => setTodayCommitmentFilterMode(event.currentTarget.value)}
                  className="w-full min-w-0 max-w-full rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 sm:w-auto sm:max-w-[20rem]"
                  aria-label="Commitment filter"
                >
                  <option value="all">All commitments</option>
                  <option value="none">No commitment</option>
                  {commitmentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
              <div className="mt-2 space-y-1">
                {quickActionTasks.length > 0 ? (
                  <ul className="space-y-1">
                    {pagedQuickActionTasks.map((task) => (
                      <li key={task.id} className="pdp-card-mobile-ghost flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1">
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
                          <IconButton
                            onClick={() => void handleQuickTaskSnooze(task.id, 1)}
                            disabled={actionInFlightId === `task-defer-${task.id}`}
                            title={actionInFlightId === `task-defer-${task.id}` ? "Saving..." : "Snooze +1 day"}
                            className="border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-50"
                          >
                            {actionInFlightId === `task-defer-${task.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                          </IconButton>
                          <IconButton
                            onClick={() => void handleQuickTaskDone(task.id, true)}
                            disabled={actionInFlightId === `task-${task.id}`}
                            title={actionInFlightId === `task-${task.id}` ? "Saving..." : "Mark done"}
                            className="border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
                          >
                            {actionInFlightId === `task-${task.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          </IconButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {quickActionTaskPageCount > 1 ? (
                  <PaginationControls
                    page={quickActionTaskPage}
                    pageCount={quickActionTaskPageCount}
                    onPrevious={() => setQuickActionTaskPage((page) => Math.max(1, page - 1))}
                    onNext={() => setQuickActionTaskPage((page) => Math.min(quickActionTaskPageCount, page + 1))}
                    className="pt-1"
                  />
                ) : null}

                {completedTodayTasks.length > 0 ? (
                  <div className="space-y-1">
                    {quickActionTasks.length > 0 ? <div className="border-t border-slate-200" /> : null}
                    <p className="text-xs font-semibold text-slate-500">Completed today</p>
                    <ul className="space-y-1">
                      {pagedCompletedTodayTasks.map((task) => (
                        <li key={task.id} className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
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
                    {completedTaskPageCount > 1 ? (
                      <PaginationControls
                        page={completedTaskPage}
                        pageCount={completedTaskPageCount}
                        onPrevious={() => setCompletedTaskPage((page) => Math.max(1, page - 1))}
                        onNext={() => setCompletedTaskPage((page) => Math.min(completedTaskPageCount, page + 1))}
                        className="pt-1"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="min-w-0 pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-sm font-semibold text-slate-700">Quick habit check-ins</p>
            {habitsNeedingCheckin.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">All tracked habits are checked in today.</p>
            ) : (
              <>
                <ul className="mt-2 grid min-w-0 grid-cols-1 gap-1">
                  {pagedHabitsNeedingCheckin.map((habit) => (
                  <li key={habit.id} className="pdp-card-mobile-ghost min-w-0 rounded-lg border border-slate-200 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setHabitDetailModalHabitId(habit.id)}
                        className="truncate flex-1 text-left text-sm font-medium text-slate-900 hover:text-slate-700 hover:underline cursor-pointer"
                      >
                        {habit.title}
                      </button>
                      <IconButton
                        onClick={() => openQuickHabitCheckinModal(habit.id)}
                        disabled={actionInFlightId === `habit-${habit.id}`}
                        title={actionInFlightId === `habit-${habit.id}` ? "Saving..." : "Check in"}
                        className="border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
                      >
                        {actionInFlightId === `habit-${habit.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      </IconButton>
                    </div>
                    {(() => {
                      const m = quickCheckinMetricsByHabitId[habit.id];
                      if (!m) return null;
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            m.trend === "up" ? "bg-emerald-100 text-emerald-700" :
                            m.trend === "down" ? "bg-rose-100 text-rose-700" :
                            "bg-slate-100 text-slate-500"
                          }`}>
                            {m.trend === "up" ? "↑" : m.trend === "down" ? "↓" : "→"} {m.trend}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                            🔥 {m.currentStreak}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                            {m.adherence28dPercent}% 4wk
                          </span>
                        </div>
                      );
                    })()}
                  </li>
                  ))}
                </ul>
                {habitCheckinPageCount > 1 ? (
                  <PaginationControls
                    page={habitCheckinPage}
                    pageCount={habitCheckinPageCount}
                    onPrevious={() => setHabitCheckinPage((page) => Math.max(1, page - 1))}
                    onNext={() => setHabitCheckinPage((page) => Math.min(habitCheckinPageCount, page + 1))}
                    className="mt-2"
                  />
                ) : null}
              </>
            )}
          </div>
              </div>
            </>
          ) : null}

          {dashboardMode === "close_day" ? (
            <div className="mt-3 pdp-card-mobile-ghost rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Close day guided journal</p>
            {closeDaySavedAt ? <p className="text-xs text-emerald-700">Saved {formatDateTimeLabel(closeDaySavedAt)}</p> : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            End your day with prompts, then add any free-write thoughts.
          </p>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Closeout date</p>
                <p className="mt-1 text-xs text-slate-600">
                  {closeDayBackfillOpen ? "Choose an earlier day to backfill." : "Defaults to today unless you need a prior day."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCloseDayBackfillOpen((current) => {
                    if (current) {
                      setCloseDayTargetDate(todayIso);
                    }

                    return !current;
                  });
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {closeDayBackfillOpen ? "Use today" : "Close a past day"}
              </button>
            </div>

            {closeDayBackfillOpen ? (
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Day to close
                <input
                  type="date"
                  value={closeDayTargetDate}
                  max={todayIso}
                  onChange={(event) => {
                    setCloseDayTargetDate(event.currentTarget.value);
                    setCloseDaySavedAt(null);
                  }}
                  className="pdp-control mt-1 rounded-md"
                />
              </label>
            ) : (
              <p className="mt-3 text-sm font-medium text-slate-800">Closing for today: {formatDateLabel(todayIso)}</p>
            )}
          </div>

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
            <IconButton
              onClick={() => void handleCloseDayJournalSave()}
              disabled={actionInFlightId === "close-day-journal"}
              title={actionInFlightId === "close-day-journal" ? "Saving..." : "Save close day note"}
              variant="primary"
            >
              {actionInFlightId === "close-day-journal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </IconButton>
          </div>
            </div>
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
            Related commitment (optional)
            <select
              value={quickTaskCommitmentId}
              onChange={(event) => setQuickTaskCommitmentId(event.currentTarget.value)}
              className="pdp-control mt-1 rounded-lg"
            >
              <option value="">No commitment</option>
              {commitmentOptions.map((option) => (
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
            <IconButton onClick={() => setIsQuickTaskModalOpen(false)} title="Cancel">
              <X className="h-4 w-4" />
            </IconButton>
            <IconButton
              onClick={() => void handleQuickTaskCreate()}
              disabled={actionInFlightId === "quick-create-task" || quickTaskTitle.trim().length === 0}
              title={actionInFlightId === "quick-create-task" ? "Saving..." : "Create Task"}
              variant="primary"
            >
              {actionInFlightId === "quick-create-task" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </IconButton>
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
              Related commitment (optional)
              <select
                value={taskModalCommitmentId}
                onChange={(event) => setTaskModalCommitmentId(event.currentTarget.value)}
                className="pdp-control mt-1 rounded-lg"
              >
                <option value="">No commitment</option>
                {commitmentOptions.map((option) => (
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
              <IconButton
                onClick={() => void handleTaskModalSave()}
                disabled={actionInFlightId === `task-save-${selectedTask.id}` || taskModalTitle.trim().length === 0}
                title={actionInFlightId === `task-save-${selectedTask.id}` ? "Saving..." : "Save changes"}
                variant="primary"
              >
                {actionInFlightId === `task-save-${selectedTask.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </IconButton>
              <IconButton
                onClick={() => void handleTaskModalDelete()}
                disabled={actionInFlightId === `task-delete-${selectedTask.id}`}
                title={actionInFlightId === `task-delete-${selectedTask.id}` ? "Deleting..." : "Delete task"}
                variant="danger"
              >
                {actionInFlightId === `task-delete-${selectedTask.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </IconButton>
              <IconButton
                onClick={() => void handleTaskModalDone()}
                disabled={actionInFlightId === `task-${selectedTask.id}`}
                title={actionInFlightId === `task-${selectedTask.id}` ? "Saving..." : "Mark Complete"}
                className="border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
              >
                {actionInFlightId === `task-${selectedTask.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </IconButton>
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
                <IconButton
                  onClick={() => void handleTaskModalSnooze()}
                  disabled={actionInFlightId === `task-defer-${selectedTask.id}`}
                  title={actionInFlightId === `task-defer-${selectedTask.id}` ? "Saving..." : "Snooze"}
                >
                  {actionInFlightId === `task-defer-${selectedTask.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                </IconButton>
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
              <IconButton onClick={() => setPendingTaskDoneId(null)} title="Cancel">
                <X className="h-4 w-4" />
              </IconButton>
              <IconButton
                onClick={() => void handleQuickTaskDone(pendingTaskDone.id, false)}
                disabled={actionInFlightId === `task-${pendingTaskDone.id}`}
                title={actionInFlightId === `task-${pendingTaskDone.id}` ? "Saving..." : "Confirm"}
                className="border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
              >
                {actionInFlightId === `task-${pendingTaskDone.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </IconButton>
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
              <IconButton onClick={() => setHabitCheckinModalHabitId(null)} title="Cancel">
                <X className="h-4 w-4" />
              </IconButton>
              <IconButton
                onClick={() => void handleQuickHabitCheckin(selectedHabitForQuickCheckin.id)}
                disabled={actionInFlightId === `habit-${selectedHabitForQuickCheckin.id}` || !habitCheckinDate}
                title={actionInFlightId === `habit-${selectedHabitForQuickCheckin.id}` ? "Saving..." : "Confirm Check-in"}
                className="border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
              >
                {actionInFlightId === `habit-${selectedHabitForQuickCheckin.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </IconButton>
            </div>
          </div>
        ) : null}
      </CrudModal>

      <CrudModal
        isOpen={selectedHabitForDetail !== null}
        title={selectedHabitForDetail ? selectedHabitForDetail.title : "Habit details"}
        onClose={() => setHabitDetailModalHabitId(null)}
      >
        {selectedHabitForDetail ? (
          <div className="grid gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedHabitForDetail.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedHabitForDetail.cadence === "daily" ? "Daily" : "Weekly"} | Target {selectedHabitForDetail.targetCount} | {(habitCheckinsByHabitId[selectedHabitForDetail.id] ?? []).length} check-ins | {selectedHabitForDetail.status}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${trendBadgeClass(selectedHabitDetailMetrics.trend)}`}>
                {selectedHabitDetailMetrics.trend}
              </span>
            </div>

            <div className="grid min-w-0 gap-2 md:grid-cols-3">
              <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">4-week adherence</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedHabitDetailMetrics.adherence28dPercent}%</p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(4, selectedHabitDetailMetrics.adherence28dPercent)}%` }}
                  />
                </div>
              </div>

              <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Streak</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedHabitDetailMetrics.currentStreak} / {selectedHabitDetailMetrics.bestStreak}</p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-sky-500 transition-all"
                    style={{ width: `${Math.max(6, Math.min(100, Math.round((selectedHabitDetailMetrics.currentStreak / Math.max(1, selectedHabitDetailMetrics.bestStreak || 1)) * 100)))}%` }}
                  />
                </div>
              </div>

              <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recent activity</p>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {selectedHabitDetailActivityCells.map((isActive, index) => (
                    <span
                      key={`${selectedHabitForDetail.id}-detail-activity-${index}`}
                      className={`h-2.5 rounded-sm ${isActive ? "bg-indigo-500" : "bg-slate-200"}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CrudModal>
    </WorkspaceShell>
    </AsyncStateContainer>
  );
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

function defaultHabitMetricSnapshot(): HabitMetricSnapshot {
  return {
    currentStreak: 0,
    bestStreak: 0,
    adherence28dPercent: 0,
    trend: "flat",
  };
}

function trendBadgeClass(trend: HabitMetricSnapshot["trend"]) {
  if (trend === "up") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (trend === "down") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-slate-100 text-slate-700";
}

function buildRecentActivityCells(habit: Habit, checkins: HabitCheckin[]) {
  const isoDates = new Set(checkins.map((checkin) => checkin.checkInDate));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (habit.cadence === "weekly") {
    const cells: boolean[] = [];
    for (let index = 5; index >= 0; index -= 1) {
      const weekStart = new Date(today);
      const day = weekStart.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diffToMonday - index * 7);

      let count = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + offset);
        const iso = toIsoDate(dayDate);
        if (isoDates.has(iso)) {
          count += 1;
        }
      }

      cells.push(count >= habit.targetCount);
    }

    return cells;
  }

  const cells: boolean[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayDate = new Date(today);
    dayDate.setDate(today.getDate() - offset);
    cells.push(isoDates.has(toIsoDate(dayDate)));
  }

  return cells;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateValue: string | null) {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
