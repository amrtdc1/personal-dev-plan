"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { Goal, ItemStatus, Subgoal, Task, UserProfile } from "@/lib/domain/types";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import { CrudModal } from "@/components/ui/crud-modal";
import { GoalTypeTag } from "@/components/ui/tags";

type RepositorySnapshot = {
  profile: UserProfile | null;
  professionalGoals: Goal[];
  personalGoals: Goal[];
  subgoalsByGoalId: Record<string, Subgoal[]>;
  tasksBySubgoalId: Record<string, Task[]>;
};

export function MigrationDataPreview({
  pendingOpenItem,
  onPendingItemConsumed,
  showWorkspaceShell = true,
  enableDataHydration = true,
}: {
  pendingOpenItem?: { kind: "goal" | "subgoal" | "task"; id: string } | null;
  onPendingItemConsumed?: () => void;
  showWorkspaceShell?: boolean;
  enableDataHydration?: boolean;
} = {}) {
  const { isLoading, user, error } = db.useAuth();
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  const [expandedSubgoalIds, setExpandedSubgoalIds] = useState<Set<string>>(new Set());
  const [showArchivedGoals, setShowArchivedGoals] = useState(false);
  const [targetGoalIdForSubgoal, setTargetGoalIdForSubgoal] = useState<string | null>(null);
  const [targetSubgoalIdForTask, setTargetSubgoalIdForTask] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingSubgoalId, setEditingSubgoalId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isSubgoalModalOpen, setIsSubgoalModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [goalType, setGoalType] = useState<"professional" | "personal">("professional");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalStartDate, setGoalStartDate] = useState("");
  const [goalEndDate, setGoalEndDate] = useState("");
  const [goalTimeframeLabel, setGoalTimeframeLabel] = useState("");
  const [goalIsFocus, setGoalIsFocus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [subgoalTitle, setSubgoalTitle] = useState("");
  const [subgoalDescription, setSubgoalDescription] = useState("");
  const [subgoalTimeframeLabel, setSubgoalTimeframeLabel] = useState("");
  const [isSavingSubgoal, setIsSavingSubgoal] = useState(false);
  const [subgoalSaveError, setSubgoalSaveError] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskSaveError, setTaskSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const allGoals = useMemo(
    () => [
      ...(snapshot?.professionalGoals ?? []),
      ...(snapshot?.personalGoals ?? []),
    ],
    [snapshot],
  );
  const allSubgoals = useMemo(
    () => Object.values(snapshot?.subgoalsByGoalId ?? {}).flat(),
    [snapshot?.subgoalsByGoalId],
  );
  const allTasks = useMemo(
    () => Object.values(snapshot?.tasksBySubgoalId ?? {}).flat(),
    [snapshot?.tasksBySubgoalId],
  );
  const archivedGoals = useMemo(
    () => allGoals.filter((goal) => goal.deletedAt !== null),
    [allGoals],
  );
  const orphanArchivedSubgoals = useMemo(
    () =>
      allSubgoals.filter((subgoal) => {
        if (subgoal.deletedAt === null) {
          return false;
        }
        const parentGoal = allGoals.find((goal) => goal.id === subgoal.goalId);
        return parentGoal !== undefined && parentGoal.deletedAt === null;
      }),
    [allSubgoals, allGoals],
  );
  const orphanArchivedTasks = useMemo(
    () =>
      allTasks.filter((task) => {
        if (task.deletedAt === null) {
          return false;
        }
        const parentSubgoal = allSubgoals.find((subgoal) => subgoal.id === task.subgoalId);
        if (parentSubgoal === undefined || parentSubgoal.deletedAt !== null) {
          return false;
        }
        const parentGoal = allGoals.find((goal) => goal.id === parentSubgoal.goalId);
        return parentGoal !== undefined && parentGoal.deletedAt === null;
      }),
    [allTasks, allSubgoals, allGoals],
  );
  const hasAnyArchived =
    archivedGoals.length > 0 ||
    orphanArchivedSubgoals.length > 0 ||
    orphanArchivedTasks.length > 0;
  const editingGoal = allGoals.find((goal) => goal.id === editingGoalId) ?? null;
  const editingSubgoal = allSubgoals.find((subgoal) => subgoal.id === editingSubgoalId) ?? null;
  const editingTask = allTasks.find((task) => task.id === editingTaskId) ?? null;

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
        const [profile, professionalGoals, personalGoals] = await Promise.all([
          dataRepository.getUserProfile(currentUser.id),
          dataRepository.listGoals(currentUser.id, "professional", { includeDeleted: true }),
          dataRepository.listGoals(currentUser.id, "personal", { includeDeleted: true }),
        ]);

        const combinedGoals = [...professionalGoals, ...personalGoals];

        const subgoalEntries = await Promise.all(
          combinedGoals.map(async (goal) => {
            const subgoals = await dataRepository.listSubgoals(currentUser.id, goal.id, {
              includeDeleted: true,
            });
            return [goal.id, subgoals] as const;
          }),
        );
        const subgoalsByGoalId: Record<string, Subgoal[]> = {};
        for (const [goalId, subgoals] of subgoalEntries) {
          subgoalsByGoalId[goalId] = subgoals;
        }

        const allSubgoalsFlat = subgoalEntries.flatMap(([, subgoals]) => subgoals);
        const taskEntries = await Promise.all(
          allSubgoalsFlat.map(async (subgoal) => {
            const tasks = await dataRepository.listTasks(currentUser.id, subgoal.id, {
              includeDeleted: true,
            });
            return [subgoal.id, tasks] as const;
          }),
        );
        const tasksBySubgoalId: Record<string, Task[]> = {};
        for (const [subgoalId, tasks] of taskEntries) {
          tasksBySubgoalId[subgoalId] = tasks;
        }

        if (!isCancelled) {
          setSnapshot({
            profile,
            professionalGoals,
            personalGoals,
            subgoalsByGoalId,
            tasksBySubgoalId,
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
    if (!pendingOpenItem || snapshot === null) {
      return;
    }

    if (pendingOpenItem.kind === "goal") {
      const goal = allGoals.find((candidate) => candidate.id === pendingOpenItem.id);
      if (goal) {
        setGoalType(goal.type);
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
    } else if (pendingOpenItem.kind === "subgoal") {
      const subgoal = allSubgoals.find((candidate) => candidate.id === pendingOpenItem.id);
      if (subgoal) {
        setExpandedGoalIds((previous) => new Set(previous).add(subgoal.goalId));
        setSubgoalTitle(subgoal.title);
        setSubgoalDescription(subgoal.description);
        setSubgoalTimeframeLabel(subgoal.timeframe === "Ongoing" ? "" : subgoal.timeframe);
        setSubgoalSaveError(null);
        setEditingSubgoalId(subgoal.id);
        setIsSubgoalModalOpen(true);
      }
    } else if (pendingOpenItem.kind === "task") {
      const task = allTasks.find((candidate) => candidate.id === pendingOpenItem.id);
      if (task) {
        const parentSubgoal = allSubgoals.find((candidate) => candidate.id === task.subgoalId);
        if (parentSubgoal) {
          setExpandedGoalIds((previous) => new Set(previous).add(parentSubgoal.goalId));
          setExpandedSubgoalIds((previous) => new Set(previous).add(parentSubgoal.id));
        }
        setTaskTitle(task.title);
        setTaskNotes(task.notes);
        setTaskDueDate(task.dueDate ?? "");
        setTaskSaveError(null);
        setEditingTaskId(task.id);
        setIsTaskModalOpen(true);
      }
    }

    onPendingItemConsumed?.();
  }, [pendingOpenItem, snapshot, allGoals, allSubgoals, allTasks, onPendingItemConsumed]);

  if (isLoading || error || !user) {
    return null;
  }

  async function handleSubgoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parentGoalId = editingSubgoal?.goalId ?? targetGoalIdForSubgoal;
    if (!user || !parentGoalId) {
      return;
    }

    setIsSavingSubgoal(true);
    setSubgoalSaveError(null);

    try {
      await dataRepository.saveSubgoal({
        subgoalId: editingSubgoal?.id,
        ownerUid: user.id,
        goalId: parentGoalId,
        title: subgoalTitle,
        description: subgoalDescription,
        projectedStartDate: null,
        projectedEndDate: null,
        timeframeLabel: subgoalTimeframeLabel,
        existingSubgoal: editingSubgoal ?? undefined,
      });

      resetSubgoalForm();
      setIsSubgoalModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setSubgoalSaveError(getErrorMessage(repositoryError, "We could not save the subgoal."));
    } finally {
      setIsSavingSubgoal(false);
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
      if (!goal.deletedAt && editingSubgoal && editingSubgoal.goalId === goal.id) {
        resetSubgoalForm();
      }
      if (!goal.deletedAt && editingTask) {
        resetTaskForm();
      }

      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update goal archive state."));
    }
  }

  async function handleSubgoalArchiveToggle(subgoal: Subgoal) {
    if (!user) {
      return;
    }

    setActionError(null);
    try {
      if (subgoal.deletedAt) {
        await dataRepository.restoreSubgoal(user.id, subgoal.id);
      } else {
        await dataRepository.softDeleteSubgoal(user.id, subgoal.id);
      }

      if (!subgoal.deletedAt && editingSubgoalId === subgoal.id) {
        resetSubgoalForm();
      }
      if (!subgoal.deletedAt && editingTask && editingTask.subgoalId === subgoal.id) {
        resetTaskForm();
      }

      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update subgoal archive state."));
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

  async function handleSubgoalStatusChange(subgoal: Subgoal, status: ItemStatus) {
    if (!user || subgoal.deletedAt) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.updateSubgoalStatus(user.id, subgoal.id, status);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update subgoal status."));
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

  async function handleGoalMove(goal: Goal, direction: "up" | "down") {
    if (!user) {
      return;
    }

    const orderedIds = buildReorderedActiveIds(
      allGoals.filter((candidate) => candidate.type === goal.type),
      goal.id,
      direction,
    );
    if (!orderedIds) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.reorderGoals(user.id, goal.type, orderedIds);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not reorder goals."));
    }
  }

  async function handleSubgoalMove(subgoal: Subgoal, direction: "up" | "down") {
    if (!user) {
      return;
    }

    const siblings = snapshot?.subgoalsByGoalId[subgoal.goalId] ?? [];
    const orderedIds = buildReorderedActiveIds(siblings, subgoal.id, direction);
    if (!orderedIds) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.reorderSubgoals(user.id, subgoal.goalId, orderedIds);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not reorder subgoals."));
    }
  }

  async function handleTaskMove(task: Task, direction: "up" | "down") {
    if (!user) {
      return;
    }

    const siblings = snapshot?.tasksBySubgoalId[task.subgoalId] ?? [];
    const orderedIds = buildReorderedActiveIds(siblings, task.id, direction);
    if (!orderedIds) {
      return;
    }

    setActionError(null);
    try {
      await dataRepository.reorderTasks(user.id, task.subgoalId, orderedIds);
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not reorder tasks."));
    }
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parentSubgoalId = editingTask?.subgoalId ?? targetSubgoalIdForTask;
    if (!user || !parentSubgoalId) {
      return;
    }

    setIsSavingTask(true);
    setTaskSaveError(null);

    try {
      await dataRepository.saveTask({
        taskId: editingTask?.id,
        ownerUid: user.id,
        subgoalId: parentSubgoalId,
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

  function startEditingSubgoal(subgoal: Subgoal) {
    setSubgoalTitle(subgoal.title);
    setSubgoalDescription(subgoal.description);
    setSubgoalTimeframeLabel(subgoal.timeframe === "Ongoing" ? "" : subgoal.timeframe);
    setSubgoalSaveError(null);
    setEditingSubgoalId(subgoal.id);
    setIsSubgoalModalOpen(true);
  }

  function resetSubgoalForm() {
    setEditingSubgoalId(null);
    setSubgoalTitle("");
    setSubgoalDescription("");
    setSubgoalTimeframeLabel("");
    setSubgoalSaveError(null);
    setTargetGoalIdForSubgoal(null);
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
    setTargetSubgoalIdForTask(null);
  }

  function resetGoalForm() {
    setEditingGoalId(null);
    setGoalType("professional");
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

  function closeSubgoalModal() {
    setIsSubgoalModalOpen(false);
    resetSubgoalForm();
  }

  function closeTaskModal() {
    setIsTaskModalOpen(false);
    resetTaskForm();
  }

  function openCreateSubgoalModal(goalId: string) {
    resetSubgoalForm();
    setTargetGoalIdForSubgoal(goalId);
    setIsSubgoalModalOpen(true);
  }

  function openCreateTaskModal(subgoalId: string) {
    resetTaskForm();
    setTargetSubgoalIdForTask(subgoalId);
    setIsTaskModalOpen(true);
  }

  function toggleGoalExpansion(goalId: string) {
    setExpandedGoalIds((previous) => {
      const next = new Set(previous);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  }

  function toggleSubgoalExpansion(subgoalId: string) {
    setExpandedSubgoalIds((previous) => {
      const next = new Set(previous);
      if (next.has(subgoalId)) {
        next.delete(subgoalId);
      } else {
        next.add(subgoalId);
      }
      return next;
    });
  }

  return (
    <>
      {showWorkspaceShell ? (
        <section className="pdp-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Goals</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Break down your professional and personal development into clear, trackable goals.
          </p>
        </div>
        {isRefreshing ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
            Refreshing
          </span>
        ) : null}
      </div>

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

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <GoalGroup
          title="Professional goals"
          goals={(snapshot?.professionalGoals ?? []).filter((goal) => goal.deletedAt === null)}
          subgoalsByGoalId={snapshot?.subgoalsByGoalId ?? {}}
          tasksBySubgoalId={snapshot?.tasksBySubgoalId ?? {}}
          expandedGoalIds={expandedGoalIds}
          expandedSubgoalIds={expandedSubgoalIds}
          onToggleGoal={toggleGoalExpansion}
          onToggleSubgoal={toggleSubgoalExpansion}
          onAddGoal={() => {
            resetGoalForm();
            setGoalType("professional");
            setIsGoalModalOpen(true);
          }}
          onEditGoal={startEditing}
          onArchiveGoal={handleGoalArchiveToggle}
          onMoveGoal={handleGoalMove}
          onStatusChangeGoal={handleGoalStatusChange}
          onAddSubgoal={openCreateSubgoalModal}
          onEditSubgoal={startEditingSubgoal}
          onArchiveSubgoal={handleSubgoalArchiveToggle}
          onMoveSubgoal={handleSubgoalMove}
          onStatusChangeSubgoal={handleSubgoalStatusChange}
          onAddTask={openCreateTaskModal}
          onEditTask={startEditingTask}
          onArchiveTask={handleTaskArchiveToggle}
          onMoveTask={handleTaskMove}
          onStatusChangeTask={handleTaskStatusChange}
        />

        <GoalGroup
          title="Personal goals"
          goals={(snapshot?.personalGoals ?? []).filter((goal) => goal.deletedAt === null)}
          subgoalsByGoalId={snapshot?.subgoalsByGoalId ?? {}}
          tasksBySubgoalId={snapshot?.tasksBySubgoalId ?? {}}
          expandedGoalIds={expandedGoalIds}
          expandedSubgoalIds={expandedSubgoalIds}
          onToggleGoal={toggleGoalExpansion}
          onToggleSubgoal={toggleSubgoalExpansion}
          onAddGoal={() => {
            resetGoalForm();
            setGoalType("personal");
            setIsGoalModalOpen(true);
          }}
          onEditGoal={startEditing}
          onArchiveGoal={handleGoalArchiveToggle}
          onMoveGoal={handleGoalMove}
          onStatusChangeGoal={handleGoalStatusChange}
          onAddSubgoal={openCreateSubgoalModal}
          onEditSubgoal={startEditingSubgoal}
          onArchiveSubgoal={handleSubgoalArchiveToggle}
          onMoveSubgoal={handleSubgoalMove}
          onStatusChangeSubgoal={handleSubgoalStatusChange}
          onAddTask={openCreateTaskModal}
          onEditTask={startEditingTask}
          onArchiveTask={handleTaskArchiveToggle}
          onMoveTask={handleTaskMove}
          onStatusChangeTask={handleTaskStatusChange}
        />
      </div>

      {showArchivedGoals && hasAnyArchived ? (
        <article className="pdp-panel-muted mt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Archived ({archivedGoals.length} goal{archivedGoals.length === 1 ? "" : "s"},{" "}
            {orphanArchivedSubgoals.length} sub-goal{orphanArchivedSubgoals.length === 1 ? "" : "s"},{" "}
            {orphanArchivedTasks.length} task{orphanArchivedTasks.length === 1 ? "" : "s"})
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
                      <button
                        type="button"
                        onClick={() => handleGoalArchiveToggle(goal)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Restore
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {orphanArchivedSubgoals.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sub-goals ({orphanArchivedSubgoals.length})
              </p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {orphanArchivedSubgoals.map((subgoal) => {
                  const parentGoal = allGoals.find((goal) => goal.id === subgoal.goalId);
                  return (
                    <li key={subgoal.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{subgoal.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Under: {parentGoal?.title ?? "Unknown goal"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSubgoalArchiveToggle(subgoal)}
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Restore
                        </button>
                      </div>
                    </li>
                  );
                })}
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
                  const parentSubgoal = allSubgoals.find((subgoal) => subgoal.id === task.subgoalId);
                  return (
                    <li key={task.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Under: {parentSubgoal?.title ?? "Unknown sub-goal"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTaskArchiveToggle(task)}
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Restore
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}

        </section>
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
        isOpen={isSubgoalModalOpen}
        title={editingSubgoal ? "Edit subgoal" : "Create subgoal"}
        onClose={closeSubgoalModal}
      >
        <form className="grid gap-4" onSubmit={handleSubgoalSubmit}>
          {(() => {
            const parentGoalId = editingSubgoal?.goalId ?? targetGoalIdForSubgoal;
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
              value={subgoalTitle}
              onChange={(event) => setSubgoalTitle(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Break goal into measurable outcomes"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Description
            <textarea
              value={subgoalDescription}
              onChange={(event) => setSubgoalDescription(event.target.value)}
              className="pdp-control mt-1 min-h-20 rounded-xl"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Timeframe label
            <input
              value={subgoalTimeframeLabel}
              onChange={(event) => setSubgoalTimeframeLabel(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Q4 2026"
            />
          </label>
          {subgoalSaveError ? <p className="text-sm text-red-700">{subgoalSaveError}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSavingSubgoal}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSavingSubgoal ? "Saving..." : editingSubgoal ? "Update subgoal" : "Create subgoal"}
            </button>
            <button
              type="button"
              onClick={closeSubgoalModal}
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
            const parentSubgoalId = editingTask?.subgoalId ?? targetSubgoalIdForTask;
            const parentSubgoal = parentSubgoalId
              ? allSubgoals.find((subgoal) => subgoal.id === parentSubgoalId)
              : null;
            const parentGoal = parentSubgoal
              ? allGoals.find((goal) => goal.id === parentSubgoal.goalId)
              : null;
            return parentSubgoal ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Parent sub-goal
                </span>
                <p className="mt-1 font-semibold text-slate-900">{parentSubgoal.title}</p>
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
              placeholder="Define milestone and owner"
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
              disabled={isSavingTask || (!editingTask?.subgoalId && !targetSubgoalIdForTask)}
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
      className="inline-flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
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

function buildReorderedActiveIds<T extends { id: string; deletedAt: string | null }>(
  items: T[],
  movingId: string,
  direction: "up" | "down",
): string[] | null {
  const activeIds = items.filter((item) => item.deletedAt === null).map((item) => item.id);
  const currentIndex = activeIds.indexOf(movingId);
  if (currentIndex < 0) {
    return null;
  }
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= activeIds.length) {
    return null;
  }
  const nextIds = [...activeIds];
  const [movedId] = nextIds.splice(currentIndex, 1);
  nextIds.splice(targetIndex, 0, movedId);
  return nextIds;
}

type GoalGroupProps = {
  title: string;
  goals: Goal[];
  subgoalsByGoalId: Record<string, Subgoal[]>;
  tasksBySubgoalId: Record<string, Task[]>;
  expandedGoalIds: Set<string>;
  expandedSubgoalIds: Set<string>;
  onToggleGoal: (goalId: string) => void;
  onToggleSubgoal: (subgoalId: string) => void;
  onAddGoal: () => void;
  onEditGoal: (goal: Goal) => void;
  onArchiveGoal: (goal: Goal) => void;
  onMoveGoal: (goal: Goal, direction: "up" | "down") => void;
  onStatusChangeGoal: (goal: Goal, status: ItemStatus) => void;
  onAddSubgoal: (goalId: string) => void;
  onEditSubgoal: (subgoal: Subgoal) => void;
  onArchiveSubgoal: (subgoal: Subgoal) => void;
  onMoveSubgoal: (subgoal: Subgoal, direction: "up" | "down") => void;
  onStatusChangeSubgoal: (subgoal: Subgoal, status: ItemStatus) => void;
  onAddTask: (subgoalId: string) => void;
  onEditTask: (task: Task) => void;
  onArchiveTask: (task: Task) => void;
  onMoveTask: (task: Task, direction: "up" | "down") => void;
  onStatusChangeTask: (task: Task, status: ItemStatus) => void;
};

function GoalGroup({
  title,
  goals,
  subgoalsByGoalId,
  tasksBySubgoalId,
  expandedGoalIds,
  expandedSubgoalIds,
  onToggleGoal,
  onToggleSubgoal,
  onAddGoal,
  onEditGoal,
  onArchiveGoal,
  onMoveGoal,
  onStatusChangeGoal,
  onAddSubgoal,
  onEditSubgoal,
  onArchiveSubgoal,
  onMoveSubgoal,
  onStatusChangeSubgoal,
  onAddTask,
  onEditTask,
  onArchiveTask,
  onMoveTask,
  onStatusChangeTask,
}: GoalGroupProps) {
  return (
    <article className="pdp-panel-muted">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {title} ({goals.length})
        </h3>
        <IconActionButton label={`Add ${title.toLowerCase()}`} onClick={onAddGoal}>
          <PlusIcon />
        </IconActionButton>
      </header>

      {goals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No goals yet. Use the + button to create one.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {goals.map((goal) => {
            const subgoals = (subgoalsByGoalId[goal.id] ?? []).filter((subgoal) => subgoal.deletedAt === null);
            const isGoalExpanded = expandedGoalIds.has(goal.id);

            return (
              <li
                key={goal.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="pdp-heading text-2xl font-semibold leading-tight"
                        style={{ color: "var(--pdp-theme-primary)" }}
                      >
                        {goal.title}
                      </p>
                      <GoalTypeTag type={goal.type} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {goal.status.replaceAll("_", " ")} · {goal.timeframe || "No timeframe"}
                    </p>
                    {goal.description ? (
                      <p className="mt-2 text-sm text-slate-700">{goal.description}</p>
                    ) : null}
                    <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                      <select
                        value={goal.status}
                        onChange={(event) => onStatusChangeGoal(goal, event.target.value as ItemStatus)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-normal normal-case text-slate-900"
                      >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveGoal(goal, "up")}
                      className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      aria-label="Move goal up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveGoal(goal, "down")}
                      className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      aria-label="Move goal down"
                    >
                      ↓
                    </button>
                    <IconActionButton label="Edit goal" onClick={() => onEditGoal(goal)}>
                      <PencilIcon />
                    </IconActionButton>
                    <IconActionButton label="Archive goal" onClick={() => onArchiveGoal(goal)}>
                      <ArchiveIcon />
                    </IconActionButton>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleGoal(goal.id)}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-900"
                      aria-expanded={isGoalExpanded}
                    >
                      <ChevronIcon expanded={isGoalExpanded} />
                      Sub-goals ({subgoals.length})
                    </button>
                    <IconActionButton label="Add sub-goal" onClick={() => onAddSubgoal(goal.id)}>
                      <PlusIcon />
                    </IconActionButton>
                  </div>

                  {isGoalExpanded ? (
                    subgoals.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-600">No sub-goals yet. Use the + button to add one.</p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {subgoals.map((subgoal) => {
                          const tasks = (tasksBySubgoalId[subgoal.id] ?? []).filter((task) => task.deletedAt === null);
                          const isSubgoalExpanded = expandedSubgoalIds.has(subgoal.id);

                          return (
                            <li
                              key={subgoal.id}
                              className="rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-slate-900">{subgoal.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {subgoal.status.replaceAll("_", " ")} · {subgoal.timeframe || "No timeframe"}
                                  </p>
                                  {subgoal.description ? (
                                    <p className="mt-2 text-sm text-slate-700">{subgoal.description}</p>
                                  ) : null}
                                  <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Status
                                    <select
                                      value={subgoal.status}
                                      onChange={(event) =>
                                        onStatusChangeSubgoal(subgoal, event.target.value as ItemStatus)
                                      }
                                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-normal normal-case text-slate-900"
                                    >
                                      <option value="not_started">Not started</option>
                                      <option value="in_progress">In progress</option>
                                      <option value="done">Done</option>
                                    </select>
                                  </label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onMoveSubgoal(subgoal, "up")}
                                    className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                    aria-label="Move sub-goal up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onMoveSubgoal(subgoal, "down")}
                                    className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                    aria-label="Move sub-goal down"
                                  >
                                    ↓
                                  </button>
                                  <IconActionButton label="Edit sub-goal" onClick={() => onEditSubgoal(subgoal)}>
                                    <PencilIcon />
                                  </IconActionButton>
                                  <IconActionButton label="Archive sub-goal" onClick={() => onArchiveSubgoal(subgoal)}>
                                    <ArchiveIcon />
                                  </IconActionButton>
                                </div>
                              </div>

                              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => onToggleSubgoal(subgoal.id)}
                                    className="flex items-center gap-2 text-sm font-semibold text-slate-900"
                                    aria-expanded={isSubgoalExpanded}
                                  >
                                    <ChevronIcon expanded={isSubgoalExpanded} />
                                    Tasks ({tasks.length})
                                  </button>
                                  <IconActionButton label="Add task" onClick={() => onAddTask(subgoal.id)}>
                                    <PlusIcon />
                                  </IconActionButton>
                                </div>

                                {isSubgoalExpanded ? (
                                  tasks.length === 0 ? (
                                    <p className="mt-3 text-sm text-slate-600">
                                      No tasks yet. Use the + button to add one.
                                    </p>
                                  ) : (
                                    <ul className="mt-3 space-y-2">
                                      {tasks.map((task) => (
                                        <li
                                          key={task.id}
                                          className="rounded-lg border border-slate-200 bg-white p-3"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                              <p className="font-medium text-slate-900">{task.title}</p>
                                              {task.dueDate ? (
                                                <p className="mt-1 text-xs text-slate-500">Due {task.dueDate}</p>
                                              ) : null}
                                              {task.notes ? (
                                                <p className="mt-2 text-sm text-slate-700">{task.notes}</p>
                                              ) : null}
                                              <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                                                Status
                                                <select
                                                  value={task.status}
                                                  onChange={(event) =>
                                                    onStatusChangeTask(task, event.target.value as ItemStatus)
                                                  }
                                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-normal normal-case text-slate-900"
                                                >
                                                  <option value="not_started">Not started</option>
                                                  <option value="in_progress">In progress</option>
                                                  <option value="done">Done</option>
                                                </select>
                                              </label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => onMoveTask(task, "up")}
                                                className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                                aria-label="Move task up"
                                              >
                                                ↑
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => onMoveTask(task, "down")}
                                                className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                                aria-label="Move task down"
                                              >
                                                ↓
                                              </button>
                                              <IconActionButton label="Edit task" onClick={() => onEditTask(task)}>
                                                <PencilIcon />
                                              </IconActionButton>
                                              <IconActionButton
                                                label="Archive task"
                                                onClick={() => onArchiveTask(task)}
                                              >
                                                <ArchiveIcon />
                                              </IconActionButton>
                                            </div>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

