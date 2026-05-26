"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Goal,
  GoalTimeframeLevel,
  Habit,
  HabitCadence,
  HabitCheckin,
  ItemStatus,
  ChildGoal,
  Task,
  UserProfile,
} from "@/lib/domain/types";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import { CrudModal } from "@/components/ui/crud-modal";
import { InfoPopover } from "@/components/ui/info-popover";
import { GoalTypeTag } from "@/components/ui/tags";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

const GOAL_TIMELINE_FILTER_STORAGE_KEY = "pdp.goalTimelineFilter";
const GOAL_TYPE_FILTER_STORAGE_KEY = "pdp.goalTypeFilter";

type RepositorySnapshot = {
  profile: UserProfile | null;
  professionalGoals: Goal[];
  personalGoals: Goal[];
  childGoalsByGoalId: Record<string, ChildGoal[]>;
  tasksByChildGoalId: Record<string, Task[]>;
};

export function MigrationDataPreview({
  pendingOpenItem,
  onPendingItemConsumed,
  showWorkspaceShell = true,
  enableDataHydration = true,
  showHabitsSection = true,
}: {
  pendingOpenItem?: { kind: "goal" | "childGoal" | "task"; id: string } | null;
  onPendingItemConsumed?: () => void;
  showWorkspaceShell?: boolean;
  enableDataHydration?: boolean;
  showHabitsSection?: boolean;
} = {}) {
  const { isLoading, user, error } = db.useAuth();
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showArchivedGoals, setShowArchivedGoals] = useState(false);
  const [targetGoalIdForChildGoal, setTargetGoalIdForChildGoal] = useState<string | null>(null);
  const [targetChildGoalIdForTask, setTargetChildGoalIdForTask] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingChildGoalId, setEditingChildGoalId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [, setIsChildGoalModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [goalType, setGoalType] = useState<"professional" | "personal">("professional");
  const [goalTimeframeLevel, setGoalTimeframeLevel] = useState<GoalTimeframeLevel>("weekly");
  const [goalParentGoalId, setGoalParentGoalId] = useState("");
  const [goalTimelineFilter, setGoalTimelineFilter] = useState<GoalTimeframeLevel | "all">(() => {
    if (typeof window === "undefined") {
      return "weekly";
    }

    const stored = window.localStorage.getItem(GOAL_TIMELINE_FILTER_STORAGE_KEY);
    if (
      stored === "vision_5y" ||
      stored === "annual" ||
      stored === "quarterly" ||
      stored === "monthly" ||
      stored === "weekly" ||
      stored === "all"
    ) {
      return stored;
    }

    return "weekly";
  });
  const [goalTypeFilter, setGoalTypeFilter] = useState<"all" | "professional" | "personal">(() => {
    if (typeof window === "undefined") {
      return "all";
    }

    const stored = window.localStorage.getItem(GOAL_TYPE_FILTER_STORAGE_KEY);
    if (stored === "professional" || stored === "personal" || stored === "all") {
      return stored;
    }

    return "all";
  });
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalStartDate, setGoalStartDate] = useState("");
  const [goalEndDate, setGoalEndDate] = useState("");
  const [goalTimeframeLabel, setGoalTimeframeLabel] = useState("");
  const [goalIsFocus, setGoalIsFocus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [childGoalTitle, setChildGoalTitle] = useState("");
  const [childGoalDescription, setChildGoalDescription] = useState("");
  const [childGoalDueDate, setChildGoalDueDate] = useState("");
  const [childGoalTimeframeLabel, setChildGoalTimeframeLabel] = useState("");
  const [isSavingChildGoal, setIsSavingChildGoal] = useState(false);
  const [childGoalSaveError, setChildGoalSaveError] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskSaveError, setTaskSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedChildGoalId, setSelectedChildGoalId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"goals" | "childGoals" | "tasks">("goals");
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitCheckinsByHabitId, setHabitCheckinsByHabitId] = useState<Record<string, HabitCheckin[]>>({});
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [habitTitle, setHabitTitle] = useState("");
  const [habitCadence, setHabitCadence] = useState<HabitCadence>("daily");
  const [habitTargetCount, setHabitTargetCount] = useState("1");
  const [isSavingHabit, setIsSavingHabit] = useState(false);
  const [habitSaveError, setHabitSaveError] = useState<string | null>(null);
  const [isSavingHabitCheckin, setIsSavingHabitCheckin] = useState(false);
  const [habitCheckinError, setHabitCheckinError] = useState<string | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);

  const allGoals = useMemo(
    () => [
      ...(snapshot?.professionalGoals ?? []),
      ...(snapshot?.personalGoals ?? []),
    ],
    [snapshot],
  );
  const allChildGoals = useMemo(
    () => Object.values(snapshot?.childGoalsByGoalId ?? {}).flat(),
    [snapshot?.childGoalsByGoalId],
  );
  const allTasks = useMemo(
    () => Object.values(snapshot?.tasksByChildGoalId ?? {}).flat(),
    [snapshot?.tasksByChildGoalId],
  );
  const archivedGoals = useMemo(
    () => allGoals.filter((goal) => goal.deletedAt !== null),
    [allGoals],
  );
  const orphanArchivedChildGoals = useMemo(
    () =>
      allChildGoals.filter((childGoal) => {
        if (childGoal.deletedAt === null) {
          return false;
        }
        const parentGoal = allGoals.find((goal) => goal.id === childGoal.goalId);
        return parentGoal !== undefined && parentGoal.deletedAt === null;
      }),
    [allChildGoals, allGoals],
  );
  const orphanArchivedTasks = useMemo(
    () =>
      allTasks.filter((task) => {
        if (task.deletedAt === null) {
          return false;
        }
        const parentChildGoal = allChildGoals.find((childGoal) => childGoal.id === task.goalId);
        if (parentChildGoal === undefined || parentChildGoal.deletedAt !== null) {
          return false;
        }
        const parentGoal = allGoals.find((goal) => goal.id === parentChildGoal.goalId);
        return parentGoal !== undefined && parentGoal.deletedAt === null;
      }),
    [allTasks, allChildGoals, allGoals],
  );
  const hasAnyArchived =
    archivedGoals.length > 0 ||
    orphanArchivedChildGoals.length > 0 ||
    orphanArchivedTasks.length > 0;
  const editingGoal = allGoals.find((goal) => goal.id === editingGoalId) ?? null;
  const editingChildGoal = allChildGoals.find((childGoal) => childGoal.id === editingChildGoalId) ?? null;
  const editingTask = allTasks.find((task) => task.id === editingTaskId) ?? null;
  const activeGoals = useMemo(
    () => allGoals.filter((goal) => goal.deletedAt === null),
    [allGoals],
  );
  const filteredActiveGoals = useMemo(
    () =>
      activeGoals.filter((goal) => {
        const matchesTimeline =
          goalTimelineFilter === "all" || (goal.timeframeLevel ?? "quarterly") === goalTimelineFilter;
        if (!matchesTimeline) {
          return false;
        }

        if (goalTypeFilter === "all") {
          return true;
        }

        return goal.type === goalTypeFilter;
      }),
    [activeGoals, goalTimelineFilter, goalTypeFilter],
  );
  const goalTimelineCounts = useMemo(
    () => ({
      vision_5y: activeGoals.filter((goal) => (goal.timeframeLevel ?? "quarterly") === "vision_5y").length,
      annual: activeGoals.filter((goal) => (goal.timeframeLevel ?? "quarterly") === "annual").length,
      quarterly: activeGoals.filter((goal) => (goal.timeframeLevel ?? "quarterly") === "quarterly").length,
      monthly: activeGoals.filter((goal) => (goal.timeframeLevel ?? "quarterly") === "monthly").length,
      weekly: activeGoals.filter((goal) => (goal.timeframeLevel ?? "quarterly") === "weekly").length,
      all: activeGoals.length,
    }),
    [activeGoals],
  );
  const goalTypeCounts = useMemo(
    () => ({
      all: activeGoals.length,
      professional: activeGoals.filter((goal) => goal.type === "professional").length,
      personal: activeGoals.filter((goal) => goal.type === "personal").length,
    }),
    [activeGoals],
  );
  const parentGoalCandidates = useMemo(
    () =>
      activeGoals.filter(
        (goal) => goal.type === goalType && goal.id !== (editingGoal?.id ?? ""),
      ),
    [activeGoals, editingGoal?.id, goalType],
  );
  const professionalGoals = useMemo(
    () => filteredActiveGoals.filter((goal) => goal.type === "professional"),
    [filteredActiveGoals],
  );
  const personalGoals = useMemo(
    () => filteredActiveGoals.filter((goal) => goal.type === "personal"),
    [filteredActiveGoals],
  );
  const selectedGoal = useMemo(
    () => filteredActiveGoals.find((goal) => goal.id === selectedGoalId) ?? null,
    [filteredActiveGoals, selectedGoalId],
  );
  const childGoalsForSelectedGoal = useMemo(
    () =>
      selectedGoal
        ? (snapshot?.childGoalsByGoalId[selectedGoal.id] ?? []).filter((childGoal) => childGoal.deletedAt === null)
        : [],
    [selectedGoal, snapshot?.childGoalsByGoalId],
  );
  const selectedChildGoal = useMemo(
    () => childGoalsForSelectedGoal.find((childGoal) => childGoal.id === selectedChildGoalId) ?? null,
    [selectedChildGoalId, childGoalsForSelectedGoal],
  );
  const tasksForSelectedChildGoal = useMemo(
    () =>
      selectedChildGoal
        ? (snapshot?.tasksByChildGoalId[selectedChildGoal.id] ?? []).filter((task) => task.deletedAt === null)
        : [],
    [selectedChildGoal, snapshot?.tasksByChildGoalId],
  );
  const selectedTask = useMemo(
    () => tasksForSelectedChildGoal.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasksForSelectedChildGoal],
  );
  const selectedHabitCheckins = useMemo(
    () => (selectedHabitId ? habitCheckinsByHabitId[selectedHabitId] ?? [] : []),
    [habitCheckinsByHabitId, selectedHabitId],
  );
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GOAL_TIMELINE_FILTER_STORAGE_KEY, goalTimelineFilter);
  }, [goalTimelineFilter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GOAL_TYPE_FILTER_STORAGE_KEY, goalTypeFilter);
  }, [goalTypeFilter]);

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
    if (!goalParentGoalId) {
      return;
    }

    if (!parentGoalCandidates.some((goal) => goal.id === goalParentGoalId)) {
      queueMicrotask(() => {
        setGoalParentGoalId("");
      });
    }
  }, [goalParentGoalId, parentGoalCandidates]);

  useEffect(() => {
    if (!enableDataHydration || !user) {
      return;
    }

    const currentUser = user;
    let isCancelled = false;

    async function loadSnapshot() {
      setIsRefreshing(true);
      setLoadError(null);

      try {
        const [profile, professionalGoals, personalGoals, loadedHabits] = await Promise.all([
          dataRepository.getUserProfile(currentUser.id),
          dataRepository.listGoals(currentUser.id, "professional", { includeDeleted: true }),
          dataRepository.listGoals(currentUser.id, "personal", { includeDeleted: true }),
          dataRepository.listHabits(currentUser.id),
        ]);

        const combinedGoals = [...professionalGoals, ...personalGoals];

        const childGoalEntries = await Promise.all(
          combinedGoals.map(async (goal) => {
            const childGoals = await dataRepository.listChildGoals(currentUser.id, goal.id, {
              includeDeleted: true,
            });
            return [goal.id, childGoals] as const;
          }),
        );
        const childGoalsByGoalId: Record<string, ChildGoal[]> = {};
        for (const [goalId, childGoals] of childGoalEntries) {
          childGoalsByGoalId[goalId] = childGoals;
        }

        const allChildGoalsFlat = childGoalEntries.flatMap(([, childGoals]) => childGoals);
        const taskEntries = await Promise.all(
          allChildGoalsFlat.map(async (childGoal) => {
            const tasks = await dataRepository.listTasks(currentUser.id, childGoal.id, {
              includeDeleted: true,
            });
            return [childGoal.id, tasks] as const;
          }),
        );
        const tasksByChildGoalId: Record<string, Task[]> = {};
        for (const [childGoalId, tasks] of taskEntries) {
          tasksByChildGoalId[childGoalId] = tasks;
        }

        const checkinEntries = await Promise.all(
          loadedHabits.map(async (habit) => {
            const checkins = await dataRepository.listHabitCheckins(currentUser.id, habit.id);
            return [habit.id, checkins] as const;
          }),
        );
        const checkinsByHabitId: Record<string, HabitCheckin[]> = {};
        for (const [habitId, checkins] of checkinEntries) {
          checkinsByHabitId[habitId] = checkins;
        }

        const rolledChildGoalsByGoalId = buildChildGoalRollups(childGoalsByGoalId, tasksByChildGoalId);
        const rolledProfessionalGoals = professionalGoals.map((goal) =>
          applyGoalRollup(goal, rolledChildGoalsByGoalId[goal.id] ?? []),
        );
        const rolledPersonalGoals = personalGoals.map((goal) =>
          applyGoalRollup(goal, rolledChildGoalsByGoalId[goal.id] ?? []),
        );

        if (!isCancelled) {
          setHabits(loadedHabits.filter((habit) => habit.deletedAt === null));
          setHabitCheckinsByHabitId(checkinsByHabitId);
          setSnapshot({
            profile,
            professionalGoals: rolledProfessionalGoals,
            personalGoals: rolledPersonalGoals,
            childGoalsByGoalId: rolledChildGoalsByGoalId,
            tasksByChildGoalId,
          });
        }
      } catch (repositoryError) {
        if (!isCancelled) {
          setLoadError(getErrorMessage(repositoryError, "We could not load your goals workspace."));
        }
      } finally {
        if (!isCancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [enableDataHydration, refreshKey, user]);

  useEffect(() => {
    if (habits.length === 0) {
      queueMicrotask(() => {
        setSelectedHabitId(null);
      });
      return;
    }

    if (!selectedHabitId || !habits.some((habit) => habit.id === selectedHabitId)) {
      queueMicrotask(() => {
        setSelectedHabitId(habits[0].id);
      });
    }
  }, [habits, selectedHabitId]);

  useEffect(() => {
    if (!pendingOpenItem || snapshot === null) {
      return;
    }

    if (pendingOpenItem.kind === "goal") {
      const goal = allGoals.find((candidate) => candidate.id === pendingOpenItem.id);
      if (goal) {
        queueMicrotask(() => {
          setSelectedGoalId(goal.id);
          setSelectedChildGoalId(null);
          setSelectedTaskId(null);
          setMobileView("goals");
          setGoalTypeFilter(goal.type);
          setGoalType(goal.type);
          setGoalTimeframeLevel(goal.timeframeLevel ?? "quarterly");
          setGoalTitle(goal.title);
          setGoalDescription(goal.description);
          setGoalStartDate(goal.projectedStartDate ?? "");
          setGoalEndDate(goal.projectedEndDate ?? "");
          setGoalTimeframeLabel(goal.timeframe === "Ongoing" ? "" : goal.timeframe);
          setGoalIsFocus(goal.isFocus);
          setSaveError(null);
          setEditingGoalId(goal.id);
          setIsGoalModalOpen(true);
        });
      }
    } else if (pendingOpenItem.kind === "childGoal") {
      const childGoal = allChildGoals.find((candidate) => candidate.id === pendingOpenItem.id);
      if (childGoal) {
        queueMicrotask(() => {
          setSelectedGoalId(childGoal.goalId);
          setSelectedChildGoalId(childGoal.id);
          setSelectedTaskId(null);
          setMobileView("tasks");
          setChildGoalTitle(childGoal.title);
          setChildGoalDescription(childGoal.description);
          setChildGoalDueDate(childGoal.projectedEndDate ?? "");
          setChildGoalTimeframeLabel(childGoal.timeframe === "Ongoing" ? "" : childGoal.timeframe);
          setChildGoalSaveError(null);
          setEditingChildGoalId(childGoal.id);
          setIsChildGoalModalOpen(true);
        });
      }
    } else if (pendingOpenItem.kind === "task") {
      const task = allTasks.find((candidate) => candidate.id === pendingOpenItem.id);
      if (task) {
        const parentChildGoal = allChildGoals.find((candidate) => candidate.id === task.goalId);
        queueMicrotask(() => {
          if (parentChildGoal) {
            setSelectedGoalId(parentChildGoal.goalId);
            setSelectedChildGoalId(parentChildGoal.id);
          }
          setSelectedTaskId(task.id);
          setMobileView("tasks");
          setTaskTitle(task.title);
          setTaskNotes(task.notes);
          setTaskDueDate(task.dueDate ?? "");
          setTaskSaveError(null);
          setEditingTaskId(task.id);
          setIsTaskModalOpen(true);
        });
      }
    }

    onPendingItemConsumed?.();
  }, [pendingOpenItem, snapshot, allGoals, allChildGoals, allTasks, onPendingItemConsumed]);

  useEffect(() => {
    if (filteredActiveGoals.length === 0) {
      queueMicrotask(() => {
        setSelectedGoalId(null);
        setSelectedChildGoalId(null);
        setSelectedTaskId(null);
      });
      return;
    }

    if (!selectedGoalId || !filteredActiveGoals.some((goal) => goal.id === selectedGoalId)) {
      queueMicrotask(() => {
        setSelectedGoalId(filteredActiveGoals[0].id);
      });
      return;
    }

    if (childGoalsForSelectedGoal.length === 0) {
      queueMicrotask(() => {
        setSelectedChildGoalId(null);
        setSelectedTaskId(null);
      });
      return;
    }

    if (!selectedChildGoalId || !childGoalsForSelectedGoal.some((childGoal) => childGoal.id === selectedChildGoalId)) {
      queueMicrotask(() => {
        setSelectedChildGoalId(childGoalsForSelectedGoal[0].id);
      });
      return;
    }

    if (tasksForSelectedChildGoal.length === 0) {
      queueMicrotask(() => {
        setSelectedTaskId(null);
      });
      return;
    }

    if (!selectedTaskId || !tasksForSelectedChildGoal.some((task) => task.id === selectedTaskId)) {
      queueMicrotask(() => {
        setSelectedTaskId(tasksForSelectedChildGoal[0].id);
      });
    }
  }, [
    filteredActiveGoals,
    selectedGoalId,
    selectedChildGoalId,
    selectedTaskId,
    childGoalsForSelectedGoal,
    tasksForSelectedChildGoal,
  ]);

  if (isLoading || error || !user) {
    return null;
  }

  async function handleChildGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parentGoalId = editingChildGoal?.goalId ?? targetGoalIdForChildGoal;
    if (!user || !parentGoalId) {
      return;
    }

    setIsSavingChildGoal(true);
    setChildGoalSaveError(null);

    try {
      await dataRepository.saveChildGoal({
        childGoalId: editingChildGoal?.id,
        ownerUid: user.id,
        goalId: parentGoalId,
        title: childGoalTitle,
        description: childGoalDescription,
        projectedStartDate: null,
        projectedEndDate: childGoalDueDate || null,
        timeframeLabel: childGoalTimeframeLabel,
        existingChildGoal: editingChildGoal ?? undefined,
      });

      resetChildGoalForm();
      setIsChildGoalModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setChildGoalSaveError(getErrorMessage(repositoryError, "We could not save the child goal."));
    } finally {
      setIsSavingChildGoal(false);
    }
  }

  async function handleGoalArchiveToggle(goal: Goal) {
    if (!user) {
      return;
    }

    setActionError(null);
    try {
      if (goal.deletedAt) {
        await dataRepository.restoreGoal(user.id, goal.id);
      } else {
        await dataRepository.softDeleteGoal(user.id, goal.id);
      }

      if (!goal.deletedAt && editingGoalId === goal.id) {
        resetGoalForm();
      }
      if (!goal.deletedAt && editingChildGoal && editingChildGoal.goalId === goal.id) {
        resetChildGoalForm();
      }
      if (!goal.deletedAt && editingTask) {
        resetTaskForm();
      }

      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update goal archive state."));
    }
  }

  async function handleTaskArchiveToggle(task: Task) {
    if (!user) {
      return;
    }

    setActionError(null);
    try {
      if (task.deletedAt) {
        await dataRepository.restoreTask(user.id, task.id);
      } else {
        await dataRepository.softDeleteTask(user.id, task.id);
      }

      if (!task.deletedAt && editingTaskId === task.id) {
        resetTaskForm();
      }

      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update task archive state."));
    }
  }

  async function handleGoalPermanentDelete(goal: Goal) {
    if (!user || !goal.deletedAt) {
      return;
    }

    const shouldDelete = window.confirm(
      `Permanently delete "${goal.title}"? This also permanently deletes all archived sub-goals and tasks under it. This cannot be undone.`,
    );
    if (!shouldDelete) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.permanentlyDeleteGoal(user.id, goal.id);

      if (editingGoalId === goal.id) {
        resetGoalForm();
      }
      if (editingChildGoal && editingChildGoal.goalId === goal.id) {
        resetChildGoalForm();
      }
      if (editingTask) {
        resetTaskForm();
      }

      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not permanently delete the goal."));
    }
  }

  async function handleTaskPermanentDelete(task: Task) {
    if (!user || !task.deletedAt) {
      return;
    }

    const shouldDelete = window.confirm(
      `Permanently delete "${task.title}"? This cannot be undone.`,
    );
    if (!shouldDelete) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.permanentlyDeleteTask(user.id, task.id);

      if (editingTaskId === task.id) {
        resetTaskForm();
      }

      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not permanently delete the task."));
    }
  }

  async function handleGoalStatusChange(goal: Goal, status: ItemStatus) {
    if (!user || goal.deletedAt) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.updateGoalStatus(user.id, goal.id, status);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update goal status."));
    }
  }

  async function handleTaskStatusChange(task: Task, status: ItemStatus) {
    if (!user || task.deletedAt) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.updateTaskStatus(user.id, task.id, status);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update task status."));
    }
  }

  async function handleGoalReorder(type: Goal["type"], orderedGoalIds: string[]) {
    if (!user) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.reorderGoals(user.id, type, orderedGoalIds);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not reorder goals."));
    }
  }

  async function handleTaskReorder(goalId: string, orderedTaskIds: string[]) {
    if (!user) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.reorderTasks(user.id, goalId, orderedTaskIds);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not reorder tasks."));
    }
  }

  function reorderIds(ids: string[], activeId: string, overId: string): string[] | null {
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return null;
    }
    return arrayMove(ids, oldIndex, newIndex);
  }

  function handleGoalDragEnd(type: Goal["type"], goals: Goal[], event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const orderedIds = reorderIds(
      goals.map((goal) => goal.id),
      String(active.id),
      String(over.id),
    );
    if (!orderedIds) {
      return;
    }

    void handleGoalReorder(type, orderedIds);
  }

  function handleTaskDragEnd(event: DragEndEvent) {
    if (!selectedChildGoal) {
      return;
    }

    const { active, over } = event;
    if (!over) {
      return;
    }

    const orderedIds = reorderIds(
      tasksForSelectedChildGoal.map((task) => task.id),
      String(active.id),
      String(over.id),
    );
    if (!orderedIds) {
      return;
    }

    void handleTaskReorder(selectedChildGoal.id, orderedIds);
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parentChildGoalId = editingTask?.goalId ?? targetChildGoalIdForTask;
    if (!user || !parentChildGoalId) {
      return;
    }

    setIsSavingTask(true);
    setTaskSaveError(null);

    try {
      await dataRepository.saveTask({
        taskId: editingTask?.id,
        ownerUid: user.id,
        goalId: parentChildGoalId,
        title: taskTitle,
        notes: taskNotes,
        dueDate: taskDueDate || null,
        existingTask: editingTask ?? undefined,
      });

      resetTaskForm();
      setIsTaskModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setTaskSaveError(getErrorMessage(repositoryError, "We could not save the task."));
    } finally {
      setIsSavingTask(false);
    }
  }

  async function handleGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    const currentUser = user;
    setIsSaving(true);
    setSaveError(null);

    try {
      await dataRepository.saveGoal({
        goalId: editingGoal?.id,
        ownerUid: currentUser.id,
        type: goalType,
        parentGoalId: goalParentGoalId || null,
        timeframeLevel: goalTimeframeLevel,
        title: goalTitle,
        description: goalDescription,
        projectedStartDate: goalStartDate || null,
        projectedEndDate: goalEndDate || null,
        timeframeLabel: goalTimeframeLabel,
        isFocus: goalIsFocus,
        existingGoal: editingGoal ?? undefined,
      });

      resetGoalForm();
      setIsGoalModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setSaveError(getErrorMessage(repositoryError, "We could not save the goal."));
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(goal: Goal) {
    setGoalType(goal.type);
    setGoalTimeframeLevel(goal.timeframeLevel ?? "quarterly");
    setGoalParentGoalId(goal.parentGoalId ?? "");
    setGoalTitle(goal.title);
    setGoalDescription(goal.description);
    setGoalStartDate(goal.projectedStartDate ?? "");
    setGoalEndDate(goal.projectedEndDate ?? "");
    setGoalTimeframeLabel(goal.timeframe === "Ongoing" ? "" : goal.timeframe);
    setGoalIsFocus(goal.isFocus);
    setSaveError(null);
    setEditingGoalId(goal.id);
    setIsGoalModalOpen(true);
  }

  function resetChildGoalForm() {
    setEditingChildGoalId(null);
    setChildGoalTitle("");
    setChildGoalDescription("");
    setChildGoalDueDate("");
    setChildGoalTimeframeLabel("");
    setChildGoalSaveError(null);
    setTargetGoalIdForChildGoal(null);
  }

  function startEditingTask(task: Task) {
    setTaskTitle(task.title);
    setTaskNotes(task.notes);
    setTaskDueDate(task.dueDate ?? "");
    setTaskSaveError(null);
    setEditingTaskId(task.id);
    setIsTaskModalOpen(true);
  }

  function resetTaskForm() {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskNotes("");
    setTaskDueDate("");
    setTaskSaveError(null);
    setTargetChildGoalIdForTask(null);
  }

  function resetGoalForm() {
    setEditingGoalId(null);
    setGoalType("professional");
    setGoalTimeframeLevel("weekly");
    setGoalParentGoalId("");
    setGoalTitle("");
    setGoalDescription("");
    setGoalStartDate("");
    setGoalEndDate("");
    setGoalTimeframeLabel("");
    setGoalIsFocus(false);
    setSaveError(null);
  }

  function closeGoalModal() {
    setIsGoalModalOpen(false);
    resetGoalForm();
  }

  function closeChildGoalModal() {
    setIsChildGoalModalOpen(false);
    resetChildGoalForm();
  }

  function closeTaskModal() {
    setIsTaskModalOpen(false);
    resetTaskForm();
  }

  function openCreateTaskModal(childGoalId: string) {
    resetTaskForm();
    setTargetChildGoalIdForTask(childGoalId);
    setIsTaskModalOpen(true);
  }

  async function handleHabitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setIsSavingHabit(true);
    setHabitSaveError(null);

    try {
      await dataRepository.saveHabit({
        ownerUid: user.id,
        title: habitTitle,
        cadence: habitCadence,
        targetCount: Number(habitTargetCount),
      });

      setHabitTitle("");
      setHabitCadence("daily");
      setHabitTargetCount("1");
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setHabitSaveError(getErrorMessage(repositoryError, "We could not save the habit."));
    } finally {
      setIsSavingHabit(false);
    }
  }

  async function handleHabitCheckin(habitId: string) {
    if (!user) {
      return;
    }

    setIsSavingHabitCheckin(true);
    setHabitCheckinError(null);

    try {
      await dataRepository.saveHabitCheckin({
        ownerUid: user.id,
        habitId,
        checkInDate: new Date().toISOString().slice(0, 10),
        notes: null,
      });

      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setHabitCheckinError(getErrorMessage(repositoryError, "We could not save the habit check-in."));
    } finally {
      setIsSavingHabitCheckin(false);
    }
  }

  const timelineNav = (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Timeline</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[
            ["vision_5y", "Long-term", goalTimelineCounts.vision_5y],
            ["annual", "Yearly", goalTimelineCounts.annual],
            ["quarterly", "Quarterly", goalTimelineCounts.quarterly],
            ["monthly", "Monthly", goalTimelineCounts.monthly],
            ["weekly", "Weekly", goalTimelineCounts.weekly],
            ["all", "All", goalTimelineCounts.all],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGoalTimelineFilter(value as GoalTimeframeLevel | "all")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                goalTimelineFilter === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Domain</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[
            ["all", "All Goals", goalTypeCounts.all],
            ["professional", "Professional", goalTypeCounts.professional],
            ["personal", "Personal", goalTypeCounts.personal],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGoalTypeFilter(value as "all" | "professional" | "personal")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                goalTypeFilter === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600">Filter by timeframe level first, then drill into goals and tasks.</p>
    </div>
  );

  const detailLaneNav = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setMobileView("goals")}
        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
          mobileView === "goals"
            ? "bg-slate-900 text-white"
            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        Goals ({filteredActiveGoals.length})
      </button>
      <button
        type="button"
        onClick={() => setMobileView("tasks")}
        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
          mobileView === "tasks"
            ? "bg-slate-900 text-white"
            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        Tasks ({tasksForSelectedChildGoal.length})
      </button>
    </div>
  );

  return (
    <>
      {showWorkspaceShell ? (
        <WorkspaceShell
          title="Planning"
          titleTrailing={
            <span className="sm:hidden">
              <InfoPopover className="self-center" label="Planning help">
                Build and organize your professional and personal goals into clear, trackable timelines.
              </InfoPopover>
            </span>
          }
          description="Build and organize your professional and personal goals into clear, trackable timelines."
          descriptionClassName="hidden sm:block"
          headerAside={
            isRefreshing ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                Refreshing
              </span>
            ) : null
          }
          notices={
            <>
              {loadError ? <p className="mt-4 text-sm text-red-700">{loadError}</p> : null}
              {actionError ? <p className="mt-2 text-sm text-red-700">{actionError}</p> : null}
              {hasAnyArchived ? (
                <label className="mt-5 inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showArchivedGoals}
                    onChange={(event) => setShowArchivedGoals(event.target.checked)}
                    className="size-4 rounded border-slate-300"
                  />
                  Show archived
                </label>
              ) : null}
            </>
          }
        >
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">PLANNING FILTERS</p>
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((current) => !current)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {isFilterPanelOpen ? "Hide filters" : "Show filters"}
              </button>
            </div>

            {isFilterPanelOpen ? <div className="mt-3">{timelineNav}</div> : null}
          </div>

          <div className="pdp-card sticky top-2 z-10 mt-4 px-3 py-2 text-[11px] leading-5 text-slate-500 shadow-sm backdrop-blur sm:text-xs lg:static lg:shadow-none">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Relationship path:</span>{" "}
        <span className="font-semibold text-slate-700">{selectedGoal?.title ?? "Select a goal"}</span>{" "}
        <span>&gt;</span>{" "}
        <span className="font-semibold text-slate-700">{selectedTask?.title ?? "Select a task"}</span>
          </div>

            <div className="mt-3 lg:hidden">{detailLaneNav}</div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className={`${mobileView === "goals" ? "block" : "hidden"} pdp-panel-muted lg:block`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Goals</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetGoalForm();
                  setGoalType("professional");
                  setIsGoalModalOpen(true);
                }}
                className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                + Pro
              </button>
              <button
                type="button"
                onClick={() => {
                  resetGoalForm();
                  setGoalType("personal");
                  setIsGoalModalOpen(true);
                }}
                className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                + Personal
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-500">Pick a goal to view tasks and progress.</p>

          <div className="mt-3 space-y-3">
            {[
              ["professional", "Professional", professionalGoals] as const,
              ["personal", "Personal", personalGoals] as const,
            ].map(([groupType, groupLabel, groupGoals]) => (
              <div key={groupLabel}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{groupLabel}</p>
                {groupGoals.length === 0 ? (
                  <ul className="mt-2 space-y-2">
                    <li className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                      No {groupLabel.toLowerCase()} goals yet.
                    </li>
                  </ul>
                ) : (
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleGoalDragEnd(groupType, groupGoals, event)}
                  >
                    <SortableContext items={groupGoals.map((goal) => goal.id)} strategy={verticalListSortingStrategy}>
                      <ul className="mt-2 space-y-2">
                        {groupGoals.map((goal) => {
                          const isSelected = goal.id === selectedGoalId;
                          return (
                            <SortableListItem
                              key={goal.id}
                              id={goal.id}
                              label={`Drag to reorder goal ${goal.title}`}
                              isSelected={isSelected}
                            >
                              <div className="rounded-lg px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedGoalId(goal.id);
                                    setSelectedChildGoalId(null);
                                    setSelectedTaskId(null);
                                    setMobileView("tasks");
                                  }}
                                  className="w-full text-left"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-slate-900">{goal.title}</p>
                                    <GoalTypeTag type={goal.type} />
                                  </div>
                                  <p className="mt-1 text-xs text-slate-600">{goal.percentComplete}% complete</p>
                                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    {getGoalTimeframeLevelLabel(goal.timeframeLevel ?? "quarterly")}
                                  </p>
                                </button>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <IconActionButton label="Edit goal" onClick={() => startEditing(goal)}>
                                    <PencilIcon />
                                  </IconActionButton>
                                  <IconActionButton label="Archive goal" onClick={() => void handleGoalArchiveToggle(goal)}>
                                    <ArchiveIcon />
                                  </IconActionButton>
                                  <select
                                    value={goal.status}
                                    onChange={(event) => {
                                      void handleGoalStatusChange(goal, event.target.value as ItemStatus);
                                    }}
                                    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                                  >
                                    <option value="not_started">Not started</option>
                                    <option value="in_progress">In progress</option>
                                    <option value="done">Done</option>
                                  </select>
                                </div>
                              </div>
                            </SortableListItem>
                          );
                        })}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className={`${mobileView === "tasks" ? "block" : "hidden"} pdp-panel-muted lg:block`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Tasks</h3>
            <button
              type="button"
              disabled={!selectedChildGoal}
              onClick={() => {
                if (selectedChildGoal) {
                  openCreateTaskModal(selectedChildGoal.id);
                }
              }}
              className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Task
            </button>
          </div>

          {selectedGoal ? (
            <p className="mt-2 text-xs text-slate-500">
              Under goal: <span className="font-semibold text-slate-700">{selectedGoal.title}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Select a goal to view tasks.</p>
          )}

          <ul className="mt-3 space-y-2">
            {tasksForSelectedChildGoal.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                No tasks yet.
              </li>
            ) : (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
                <SortableContext
                  items={tasksForSelectedChildGoal.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {tasksForSelectedChildGoal.map((task) => {
                    const isSelected = task.id === selectedTaskId;
                    return (
                      <SortableListItem
                        key={task.id}
                        id={task.id}
                        label={`Drag to reorder task ${task.title}`}
                        isSelected={isSelected}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            startEditingTask(task);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left"
                        >
                          <p className="font-medium text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {task.dueDate ? `Due ${task.dueDate}` : "No due date"} | {task.percentComplete}% complete
                          </p>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <IconActionButton label="Edit task" onClick={() => startEditingTask(task)}>
                            <PencilIcon />
                          </IconActionButton>
                          <IconActionButton label="Archive task" onClick={() => void handleTaskArchiveToggle(task)}>
                            <ArchiveIcon />
                          </IconActionButton>
                          <select
                            value={task.status}
                            onChange={(event) => {
                              void handleTaskStatusChange(task, event.target.value as ItemStatus);
                            }}
                            className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                          >
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </SortableListItem>
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </ul>
        </article>
      </div>

      {showHabitsSection ? (
      <article className="pdp-panel-muted mt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Habits</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {habits.length} total
          </span>
        </div>

        <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={handleHabitSubmit}>
          <input
            value={habitTitle}
            onChange={(event) => setHabitTitle(event.target.value)}
            className="pdp-control rounded-xl"
            placeholder="Habit title"
            aria-label="Habit title"
          />
          <select
            value={habitCadence}
            onChange={(event) => setHabitCadence(event.target.value as HabitCadence)}
            className="pdp-control rounded-xl"
            aria-label="Habit cadence"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <input
            type="number"
            min={1}
            value={habitTargetCount}
            onChange={(event) => setHabitTargetCount(event.target.value)}
            className="pdp-control rounded-xl"
            placeholder="Target count"
            aria-label="Habit target count"
          />
          <button
            type="submit"
            disabled={isSavingHabit}
            className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSavingHabit ? "Saving..." : "Create habit"}
          </button>
        </form>
        {habitSaveError ? <p className="mt-2 text-sm text-red-700">{habitSaveError}</p> : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ul className="space-y-2">
            {habits.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                No habits yet.
              </li>
            ) : (
              habits.map((habit) => {
                const isSelected = selectedHabitId === habit.id;
                const checkinCount = habitCheckinsByHabitId[habit.id]?.length ?? 0;
                return (
                  <li key={habit.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelectedHabitId(habit.id)}
                      className="w-full text-left"
                    >
                      <p className={`font-medium ${isSelected ? "text-slate-900" : "text-slate-700"}`}>{habit.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {habit.cadence === "daily" ? "Daily" : "Weekly"} | Target {habit.targetCount} | {checkinCount} check-ins
                      </p>
                    </button>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => void handleHabitCheckin(habit.id)}
                        disabled={isSavingHabitCheckin}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Check in today
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent check-ins</p>
            {selectedHabitId ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {selectedHabitCheckins.length === 0 ? (
                  <li className="text-xs text-slate-500">No check-ins yet.</li>
                ) : (
                  selectedHabitCheckins.slice(0, 5).map((checkin) => (
                    <li key={checkin.id} className="rounded-md bg-slate-50 px-2 py-1">
                      <span className="font-medium">{checkin.checkInDate}</span>
                      {checkin.notes ? <span className="text-slate-500"> - {checkin.notes}</span> : null}
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Select a habit to view check-ins.</p>
            )}
            {habitCheckinError ? <p className="mt-2 text-sm text-red-700">{habitCheckinError}</p> : null}
          </div>
        </div>
      </article>
      ) : null}

      {showArchivedGoals && hasAnyArchived ? (
        <article className="pdp-panel-muted mt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Archived ({archivedGoals.length} goal{archivedGoals.length === 1 ? "" : "s"}, {orphanArchivedTasks.length} task
            {orphanArchivedTasks.length === 1 ? "" : "s"})
          </h3>

          {archivedGoals.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Goals ({archivedGoals.length})
              </p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {archivedGoals.map((goal) => (
                  <li key={goal.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{goal.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {goal.type === "professional" ? "Professional" : "Personal"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleGoalArchiveToggle(goal)}
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleGoalPermanentDelete(goal)}
                          className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-red-700 transition hover:border-red-400 hover:bg-red-50"
                        >
                          Delete permanently
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {orphanArchivedTasks.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Tasks ({orphanArchivedTasks.length})
              </p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {orphanArchivedTasks.map((task) => {
                  const parentChildGoal = allChildGoals.find((childGoal) => childGoal.id === task.goalId);
                  return (
                    <li key={task.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Under: {parentChildGoal?.title ?? "Unknown child goal"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTaskArchiveToggle(task)}
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTaskPermanentDelete(task)}
                            className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-red-700 transition hover:border-red-400 hover:bg-red-50"
                          >
                            Delete permanently
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}

        </WorkspaceShell>
      ) : null}

      <CrudModal
        isOpen={isGoalModalOpen}
        title={editingGoal ? "Edit goal" : "Create goal"}
        onClose={closeGoalModal}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleGoalSubmit}>
          <label className="block text-sm text-slate-700">
            Goal type
            <select
              value={goalType}
              onChange={(event) => setGoalType(event.target.value as "professional" | "personal")}
              className="pdp-control mt-1 rounded-xl"
            >
              <option value="professional">Professional</option>
              <option value="personal">Personal</option>
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Timeframe level
            <select
              value={goalTimeframeLevel}
              onChange={(event) => setGoalTimeframeLevel(event.target.value as GoalTimeframeLevel)}
              className="pdp-control mt-1 rounded-xl"
            >
              <option value="vision_5y">Long-term</option>
              <option value="annual">Yearly</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Parent goal (optional)
            <select
              value={goalParentGoalId}
              onChange={(event) => setGoalParentGoalId(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
            >
              <option value="">None</option>
              {parentGoalCandidates.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            Title
            <input
              value={goalTitle}
              onChange={(event) => setGoalTitle(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Improve leadership communication"
            />
          </label>

          <label className="block text-sm text-slate-700 md:col-span-2">
            Description
            <textarea
              value={goalDescription}
              onChange={(event) => setGoalDescription(event.target.value)}
              className="pdp-control mt-1 min-h-24 rounded-xl"
              placeholder="Capture the business outcome and why this goal matters."
            />
          </label>

          <label className="block text-sm text-slate-700">
            Projected start
            <input
              type="date"
              value={goalStartDate}
              onChange={(event) => setGoalStartDate(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Projected end
            <input
              type="date"
              value={goalEndDate}
              onChange={(event) => setGoalEndDate(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Timeframe label
            <input
              value={goalTimeframeLabel}
              onChange={(event) => setGoalTimeframeLabel(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Q3 2026"
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={goalIsFocus}
              onChange={(event) => setGoalIsFocus(event.target.checked)}
              className="size-4 rounded border-slate-300"
            />
            Mark as current focus goal
          </label>

          {saveError ? <p className="text-sm text-red-700 md:col-span-2">{saveError}</p> : null}

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Saving..." : editingGoal ? "Update goal" : "Create goal"}
            </button>
            <button
              type="button"
              onClick={closeGoalModal}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </CrudModal>

      <CrudModal
        isOpen={false}
        title={editingChildGoal ? "Edit child goal" : "Create child goal"}
        onClose={closeChildGoalModal}
      >
        <form className="grid gap-4" onSubmit={handleChildGoalSubmit}>
          {(() => {
            const parentGoalId = editingChildGoal?.goalId ?? targetGoalIdForChildGoal;
            const parentGoal = parentGoalId ? allGoals.find((goal) => goal.id === parentGoalId) : null;
            return parentGoal ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Parent goal
                </span>
                <p className="mt-1 font-semibold text-slate-900">{parentGoal.title}</p>
              </div>
            ) : null;
          })()}
          <label className="block text-sm text-slate-700">
            Title
            <input
              value={childGoalTitle}
              onChange={(event) => setChildGoalTitle(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Break goal into measurable outcomes"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Description
            <textarea
              value={childGoalDescription}
              onChange={(event) => setChildGoalDescription(event.target.value)}
              className="pdp-control mt-1 min-h-20 rounded-xl"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Due date
            <input
              type="date"
              value={childGoalDueDate}
              onChange={(event) => setChildGoalDueDate(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Timeframe label
            <input
              value={childGoalTimeframeLabel}
              onChange={(event) => setChildGoalTimeframeLabel(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Q4 2026"
            />
          </label>
          {childGoalSaveError ? <p className="text-sm text-red-700">{childGoalSaveError}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSavingChildGoal}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSavingChildGoal ? "Saving..." : editingChildGoal ? "Update child goal" : "Create child goal"}
            </button>
            <button
              type="button"
              onClick={closeChildGoalModal}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </CrudModal>

      <CrudModal
        isOpen={isTaskModalOpen}
        title={editingTask ? "Edit task" : "Create task"}
        onClose={closeTaskModal}
      >
        <form className="grid gap-4" onSubmit={handleTaskSubmit}>
          {(() => {
            const parentChildGoalId = editingTask?.goalId ?? targetChildGoalIdForTask;
            const parentChildGoal = parentChildGoalId
              ? allChildGoals.find((childGoal) => childGoal.id === parentChildGoalId)
              : null;
            const parentGoal = parentChildGoal
              ? allGoals.find((goal) => goal.id === parentChildGoal.goalId)
              : null;
            return parentChildGoal ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Parent sub-goal
                </span>
                <p className="mt-1 font-semibold text-slate-900">{parentChildGoal.title}</p>
                {parentGoal ? (
                  <p className="mt-1 text-xs text-slate-500">Goal: {parentGoal.title}</p>
                ) : null}
              </div>
            ) : null;
          })()}
          <label className="block text-sm text-slate-700">
            Title
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Define child goal and owner"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Notes
            <textarea
              value={taskNotes}
              onChange={(event) => setTaskNotes(event.target.value)}
              className="pdp-control mt-1 min-h-20 rounded-xl"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Due date
            <input
              type="date"
              value={taskDueDate}
              onChange={(event) => setTaskDueDate(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
            />
          </label>
          {taskSaveError ? <p className="text-sm text-red-700">{taskSaveError}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSavingTask || (!editingTask?.goalId && !targetChildGoalIdForTask)}
              className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSavingTask ? "Saving..." : editingTask ? "Update task" : "Create task"}
            </button>
            <button
              type="button"
              onClick={closeTaskModal}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </CrudModal>
    </>
  );
}

function SortableListItem({
  id,
  label,
  isSelected = false,
  children,
}: {
  id: string;
  label: string;
  isSelected?: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`${isDragging ? "opacity-80" : ""}`}
    >
      <div
        className={`relative rounded-lg border px-2 py-2 transition ${
          isSelected
            ? "pdp-selectable-row pdp-selectable-row-selected pdp-selectable-row-interactive"
            : "pdp-selectable-row pdp-selectable-row-interactive border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={label}
          title={label}
          className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full p-1 text-slate-600 transition hover:bg-slate-50 active:cursor-grabbing"
          onClick={(event) => event.preventDefault()}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
        <div className="min-w-0 pr-9">{children}</div>
      </div>
    </li>
  );
}

function IconActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex size-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 7h18" />
      <path d="M5 7h14v12H5z" />
      <path d="M9 3h6v4H9z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="7" r="1.4" />
      <circle cx="16" cy="7" r="1.4" />
      <circle cx="8" cy="12" r="1.4" />
      <circle cx="16" cy="12" r="1.4" />
      <circle cx="8" cy="17" r="1.4" />
      <circle cx="16" cy="17" r="1.4" />
    </svg>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return fallback;
}

function buildChildGoalRollups(
  childGoalsByGoalId: Record<string, ChildGoal[]>,
  tasksByChildGoalId: Record<string, Task[]>,
) {
  const next: Record<string, ChildGoal[]> = {};

  for (const [goalId, childGoals] of Object.entries(childGoalsByGoalId)) {
    next[goalId] = childGoals.map((childGoal) => applyChildGoalRollup(childGoal, tasksByChildGoalId[childGoal.id] ?? []));
  }

  return next;
}

function applyChildGoalRollup(childGoal: ChildGoal, tasks: Task[]) {
  if (childGoal.deletedAt !== null) {
    return childGoal;
  }

  const activeTasks = tasks.filter((task) => task.deletedAt === null);
  if (activeTasks.length === 0) {
    return childGoal;
  }

  const percentComplete = Math.round(
    activeTasks.reduce((total, task) => total + task.percentComplete, 0) / activeTasks.length,
  );

  return {
    ...childGoal,
    status: deriveRollupStatus(activeTasks.map((task) => task.status)),
    percentComplete,
  };
}

function applyGoalRollup(goal: Goal, childGoals: ChildGoal[]) {
  if (goal.deletedAt !== null) {
    return goal;
  }

  const activeChildGoals = childGoals.filter((childGoal) => childGoal.deletedAt === null);
  if (activeChildGoals.length === 0) {
    return goal;
  }

  const percentComplete = Math.round(
    activeChildGoals.reduce((total, childGoal) => total + childGoal.percentComplete, 0) / activeChildGoals.length,
  );

  return {
    ...goal,
    status: deriveRollupStatus(activeChildGoals.map((childGoal) => childGoal.status)),
    percentComplete,
  };
}

function deriveRollupStatus(statuses: ItemStatus[]): ItemStatus {
  if (statuses.every((status) => status === "done")) {
    return "done";
  }

  if (statuses.every((status) => status === "not_started")) {
    return "not_started";
  }

  return "in_progress";
}

function getGoalTimeframeLevelLabel(timeframeLevel: GoalTimeframeLevel) {
  if (timeframeLevel === "weekly") {
    return "Weekly";
  }

  if (timeframeLevel === "monthly") {
    return "Monthly";
  }

  if (timeframeLevel === "quarterly") {
    return "Quarterly";
  }

  if (timeframeLevel === "annual") {
    return "Yearly";
  }

  if (timeframeLevel === "vision_5y") {
    return "Long-term";
  }

  return "Quarterly";
}

