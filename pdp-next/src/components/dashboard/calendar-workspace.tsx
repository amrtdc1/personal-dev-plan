"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { Goal, GoalType, ItemStatus, Subgoal, Task } from "@/lib/domain/types";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import { CrudModal } from "@/components/ui/crud-modal";

type CalendarItemKind = "goal" | "subgoal" | "task";
type CreateType = "goal" | "subgoal" | "task";
type StatusFilter = "all" | ItemStatus;

type CalendarSelection = {
  startDate: string;
  endDate: string;
};

type SelectedEventRef = {
  kind: CalendarItemKind;
  id: string;
};

type AgendaItem = {
  id: string;
  kind: CalendarItemKind;
  title: string;
  status: ItemStatus;
  hierarchy: string;
};

const DEFAULT_SELECTION = getTodaySelection();

export function CalendarWorkspace() {
  const { isLoading, user, error } = db.useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subgoals, setSubgoals] = useState<Subgoal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selection, setSelection] = useState<CalendarSelection>(DEFAULT_SELECTION);
  const [createType, setCreateType] = useState<CreateType>("task");
  const [goalType, setGoalType] = useState<GoalType>("professional");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetails, setDraftDetails] = useState("");
  const [draftGoalId, setDraftGoalId] = useState<string>("");
  const [draftSubgoalId, setDraftSubgoalId] = useState<string>("");
  const [selectedEventRef, setSelectedEventRef] = useState<SelectedEventRef | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>("not_started");
  const [editGoalType, setEditGoalType] = useState<GoalType>("professional");
  const [editParentGoalId, setEditParentGoalId] = useState("");
  const [editParentSubgoalId, setEditParentSubgoalId] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [showGoals, setShowGoals] = useState(true);
  const [showSubgoals, setShowSubgoals] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [scopeGoalType, setScopeGoalType] = useState<"all" | GoalType>("all");

  const [isCompactToolbar, setIsCompactToolbar] = useState(false);
  const [isTouchFriendly, setIsTouchFriendly] = useState(false);

  const goalMap = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const subgoalMap = useMemo(() => new Map(subgoals.map((subgoal) => [subgoal.id, subgoal])), [subgoals]);
  const eventColors = getCalendarEventColors();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const updateCompactToolbar = () => {
      setIsCompactToolbar(mediaQuery.matches);
      setIsTouchFriendly((current) => (current ? current : mediaQuery.matches));
    };

    updateCompactToolbar();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateCompactToolbar);
    } else {
      mediaQuery.addListener(updateCompactToolbar);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateCompactToolbar);
      } else {
        mediaQuery.removeListener(updateCompactToolbar);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;
    let isCancelled = false;

    async function loadCalendarData() {
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

        if (!isCancelled) {
          setGoals(loadedGoals);
          setSubgoals(loadedSubgoals);
          setTasks(loadedTasks);
          setDraftGoalId((current) => current || loadedGoals[0]?.id || "");
          setDraftSubgoalId((current) => current || loadedSubgoals[0]?.id || "");
        }
      } catch (loadCalendarError) {
        if (!isCancelled) {
          setLoadError(getErrorMessage(loadCalendarError, "We could not load calendar items."));
        }
      } finally {
        if (!isCancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadCalendarData();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const events = useMemo<EventInput[]>(() => {
    const builtEvents: EventInput[] = [];

    const statusMatch = (status: ItemStatus) => statusFilter === "all" || status === statusFilter;

    for (const goal of goals) {
      if (!showGoals || !statusMatch(goal.status)) {
        continue;
      }

      if (scopeGoalType !== "all" && goal.type !== scopeGoalType) {
        continue;
      }

      const range = normalizeDateRange(goal.projectedStartDate, goal.projectedEndDate);
      if (!range) {
        continue;
      }

      builtEvents.push({
        id: `goal:${goal.id}`,
        title: `G | ${goal.title}`,
        start: range.start,
        end: toExclusiveEndDate(range.end),
        allDay: true,
        editable: true,
        durationEditable: true,
        backgroundColor:
          goal.type === "professional" ? eventColors.goalProfessionalBackground : eventColors.goalPersonalBackground,
        borderColor: goal.type === "professional" ? eventColors.goalProfessionalBorder : eventColors.goalPersonalBorder,
        extendedProps: {
          kind: "goal" as CalendarItemKind,
          hierarchy: `${goal.type === "professional" ? "Professional" : "Personal"} goal`,
          status: goal.status,
        },
      });
    }

    for (const subgoal of subgoals) {
      if (!showSubgoals || !statusMatch(subgoal.status)) {
        continue;
      }

      const parentGoal = goalMap.get(subgoal.goalId);
      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const range = normalizeDateRange(subgoal.projectedStartDate, subgoal.projectedEndDate);
      if (!range) {
        continue;
      }

      builtEvents.push({
        id: `subgoal:${subgoal.id}`,
        title: `SG | ${subgoal.title}`,
        start: range.start,
        end: toExclusiveEndDate(range.end),
        allDay: true,
        editable: true,
        durationEditable: true,
        backgroundColor: eventColors.subgoalBackground,
        borderColor: eventColors.subgoalBorder,
        extendedProps: {
          kind: "subgoal" as CalendarItemKind,
          hierarchy: parentGoal ? `${parentGoal.title} -> ${subgoal.title}` : "Subgoal",
          status: subgoal.status,
        },
      });
    }

    for (const task of tasks) {
      if (!showTasks || !statusMatch(task.status)) {
        continue;
      }

      if (!task.dueDate) {
        continue;
      }

      const parentSubgoal = subgoalMap.get(task.subgoalId);
      const parentGoal = parentSubgoal ? goalMap.get(parentSubgoal.goalId) : null;

      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const hierarchyBits = [
        parentGoal ? `Goal: ${parentGoal.title}` : null,
        parentSubgoal ? `Subgoal: ${parentSubgoal.title}` : null,
      ].filter((bit): bit is string => Boolean(bit));

      builtEvents.push({
        id: `task:${task.id}`,
        title: `T | ${task.title}`,
        start: task.dueDate,
        allDay: true,
        editable: true,
        durationEditable: false,
        backgroundColor: eventColors.taskBackground,
        borderColor: eventColors.taskBorder,
        extendedProps: {
          kind: "task" as CalendarItemKind,
          hierarchy: hierarchyBits.length > 0 ? hierarchyBits.join(" | ") : "Task",
          status: task.status,
        },
      });
    }

    return builtEvents;
  }, [
    goalMap,
    goals,
    scopeGoalType,
    showGoals,
    showSubgoals,
    showTasks,
    statusFilter,
    subgoalMap,
    subgoals,
    eventColors,
    tasks,
  ]);

  const todaysAgenda = useMemo<AgendaItem[]>(() => {
    const todayDate = toDateOnly(new Date());
    const agendaItems: AgendaItem[] = [];

    const statusMatch = (status: ItemStatus) => statusFilter === "all" || status === statusFilter;

    for (const goal of goals) {
      if (!showGoals || !statusMatch(goal.status)) {
        continue;
      }

      if (scopeGoalType !== "all" && goal.type !== scopeGoalType) {
        continue;
      }

      const range = normalizeDateRange(goal.projectedStartDate, goal.projectedEndDate);
      if (!range || todayDate < range.start || todayDate > range.end) {
        continue;
      }

      agendaItems.push({
        id: `goal:${goal.id}`,
        kind: "goal",
        title: goal.title,
        status: goal.status,
        hierarchy: `${goal.type === "professional" ? "Professional" : "Personal"} goal`,
      });
    }

    for (const subgoal of subgoals) {
      if (!showSubgoals || !statusMatch(subgoal.status)) {
        continue;
      }

      const parentGoal = goalMap.get(subgoal.goalId);
      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const range = normalizeDateRange(subgoal.projectedStartDate, subgoal.projectedEndDate);
      if (!range || todayDate < range.start || todayDate > range.end) {
        continue;
      }

      agendaItems.push({
        id: `subgoal:${subgoal.id}`,
        kind: "subgoal",
        title: subgoal.title,
        status: subgoal.status,
        hierarchy: parentGoal ? `${parentGoal.title} -> ${subgoal.title}` : "Subgoal",
      });
    }

    for (const task of tasks) {
      if (!showTasks || !statusMatch(task.status) || !task.dueDate || task.dueDate !== todayDate) {
        continue;
      }

      const parentSubgoal = subgoalMap.get(task.subgoalId);
      const parentGoal = parentSubgoal ? goalMap.get(parentSubgoal.goalId) : null;

      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const hierarchyBits = [
        parentGoal ? `Goal: ${parentGoal.title}` : null,
        parentSubgoal ? `Subgoal: ${parentSubgoal.title}` : null,
      ].filter((bit): bit is string => Boolean(bit));

      agendaItems.push({
        id: `task:${task.id}`,
        kind: "task",
        title: task.title,
        status: task.status,
        hierarchy: hierarchyBits.length > 0 ? hierarchyBits.join(" | ") : "Task",
      });
    }

    const kindOrder: Record<CalendarItemKind, number> = {
      goal: 0,
      subgoal: 1,
      task: 2,
    };

    return agendaItems.sort((left, right) => {
      const kindDifference = kindOrder[left.kind] - kindOrder[right.kind];
      if (kindDifference !== 0) {
        return kindDifference;
      }

      return left.title.localeCompare(right.title);
    });
  }, [
    goalMap,
    goals,
    scopeGoalType,
    showGoals,
    showSubgoals,
    showTasks,
    statusFilter,
    subgoalMap,
    subgoals,
    tasks,
  ]);

  if (isLoading || error || !user) {
    return null;
  }

  async function reloadData() {
    if (!user) {
      return;
    }

    const currentUser = user;
    setIsRefreshing(true);
    setActionError(null);
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

      setGoals(loadedGoals);
      setSubgoals(loadedSubgoals);
      setTasks(loadedTasks);
    } catch (reloadError) {
      setActionError(getErrorMessage(reloadError, "We could not refresh calendar data."));
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleDateSelect(selectionArg: DateSelectArg) {
    const normalizedStart = toDateOnly(selectionArg.start);
    const normalizedEnd = toDateOnly(addDays(selectionArg.end, -1));

    setSelection({
      startDate: normalizedStart,
      endDate: normalizedEnd,
    });
    setActionError(null);
    setIsCreateModalOpen(true);
  }

  function handleEventClick(clickArg: EventClickArg) {
    const [kind, id] = clickArg.event.id.split(":") as [CalendarItemKind, string];

    if (kind === "goal") {
      const selectedGoal = goals.find((goal) => goal.id === id);
      if (!selectedGoal) {
        setActionError("The selected goal no longer exists.");
        return;
      }

      setEditTitle(selectedGoal.title);
      setEditDetails(selectedGoal.description);
      setEditStatus(selectedGoal.status);
      setEditGoalType(selectedGoal.type);
      setEditParentGoalId("");
      setEditParentSubgoalId("");
    } else if (kind === "subgoal") {
      const selectedSubgoal = subgoals.find((subgoal) => subgoal.id === id);
      if (!selectedSubgoal) {
        setActionError("The selected subgoal no longer exists.");
        return;
      }

      setEditTitle(selectedSubgoal.title);
      setEditDetails(selectedSubgoal.description);
      setEditStatus(selectedSubgoal.status);
      setEditGoalType("professional");
      setEditParentGoalId(selectedSubgoal.goalId);
      setEditParentSubgoalId("");
    } else {
      const selectedTask = tasks.find((task) => task.id === id);
      if (!selectedTask) {
        setActionError("The selected task no longer exists.");
        return;
      }

      setEditTitle(selectedTask.title);
      setEditDetails(selectedTask.notes);
      setEditStatus(selectedTask.status);
      setEditGoalType("professional");
      setEditParentGoalId("");
      setEditParentSubgoalId(selectedTask.subgoalId);
    }

    setSelectedEventRef({ kind, id });
    setActionError(null);
    setIsEditModalOpen(true);
  }

  async function handleEventDrop(dropArg: EventDropArg) {
    await persistCalendarMove(dropArg.event.id, dropArg.event.start, dropArg.event.end, () => dropArg.revert());
  }

  async function handleEventResize(resizeArg: EventResizeDoneArg) {
    await persistCalendarMove(
      resizeArg.event.id,
      resizeArg.event.start,
      resizeArg.event.end,
      () => resizeArg.revert(),
    );
  }

  async function persistCalendarMove(
    eventId: string,
    start: Date | null,
    end: Date | null,
    revert: () => void,
  ) {
    if (!user || !start) {
      revert();
      return;
    }

    const [kind, itemId] = eventId.split(":");
    const nextStart = toDateOnly(start);
    const nextEndInclusive = end ? toDateOnly(addDays(end, -1)) : nextStart;

    setIsSaving(true);
    setActionError(null);
    try {
      if (kind === "goal") {
        const existingGoal = goals.find((goal) => goal.id === itemId);
        if (!existingGoal) {
          throw new Error("Goal was not found for drag update.");
        }

        await dataRepository.saveGoal({
          goalId: existingGoal.id,
          ownerUid: user.id,
          type: existingGoal.type,
          title: existingGoal.title,
          description: existingGoal.description,
          projectedStartDate: nextStart,
          projectedEndDate: nextEndInclusive,
          timeframeLabel: existingGoal.timeframe === "Ongoing" ? "" : existingGoal.timeframe,
          isFocus: existingGoal.isFocus,
          existingGoal,
        });
      } else if (kind === "subgoal") {
        const existingSubgoal = subgoals.find((subgoal) => subgoal.id === itemId);
        if (!existingSubgoal) {
          throw new Error("Subgoal was not found for drag update.");
        }

        await dataRepository.saveSubgoal({
          subgoalId: existingSubgoal.id,
          ownerUid: user.id,
          goalId: existingSubgoal.goalId,
          title: existingSubgoal.title,
          description: existingSubgoal.description,
          projectedStartDate: nextStart,
          projectedEndDate: nextEndInclusive,
          timeframeLabel: existingSubgoal.timeframe === "Ongoing" ? "" : existingSubgoal.timeframe,
          existingSubgoal,
        });
      } else if (kind === "task") {
        const existingTask = tasks.find((task) => task.id === itemId);
        if (!existingTask) {
          throw new Error("Task was not found for drag update.");
        }

        await dataRepository.saveTask({
          taskId: existingTask.id,
          ownerUid: user.id,
          subgoalId: existingTask.subgoalId,
          title: existingTask.title,
          notes: existingTask.notes,
          dueDate: nextStart,
          existingTask,
        });
      } else {
        throw new Error("Unsupported event type for calendar update.");
      }

      await reloadData();
    } catch (moveError) {
      revert();
      setActionError(getErrorMessage(moveError, "We could not update this calendar item."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    if (!draftTitle.trim()) {
      setActionError("A title is required to create a calendar item.");
      return;
    }

    setIsSaving(true);
    setActionError(null);

    try {
      if (createType === "goal") {
        await dataRepository.saveGoal({
          ownerUid: user.id,
          type: goalType,
          title: draftTitle,
          description: draftDetails,
          projectedStartDate: selection.startDate,
          projectedEndDate: selection.endDate,
          timeframeLabel: "",
          isFocus: false,
        });
      } else if (createType === "subgoal") {
        if (!draftGoalId) {
          throw new Error("Select a parent goal before creating a subgoal.");
        }

        await dataRepository.saveSubgoal({
          ownerUid: user.id,
          goalId: draftGoalId,
          title: draftTitle,
          description: draftDetails,
          projectedStartDate: selection.startDate,
          projectedEndDate: selection.endDate,
          timeframeLabel: "",
        });
      } else {
        if (!draftSubgoalId) {
          throw new Error("Select a parent subgoal before creating a task.");
        }

        await dataRepository.saveTask({
          ownerUid: user.id,
          subgoalId: draftSubgoalId,
          title: draftTitle,
          notes: draftDetails,
          dueDate: selection.startDate,
        });
      }

      setDraftTitle("");
      setDraftDetails("");
      setIsCreateModalOpen(false);
      await reloadData();
    } catch (saveError) {
      setActionError(getErrorMessage(saveError, "We could not create this calendar item."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selectedEventRef) {
      return;
    }

    const normalizedTitle = editTitle.trim();
    if (!normalizedTitle) {
      setActionError("A title is required to save this calendar item.");
      return;
    }

    setIsSaving(true);
    setActionError(null);

    try {
      if (selectedEventRef.kind === "goal") {
        const existingGoal = goals.find((goal) => goal.id === selectedEventRef.id);
        if (!existingGoal) {
          throw new Error("The selected goal no longer exists.");
        }

        const updatedGoal = await dataRepository.saveGoal({
          goalId: existingGoal.id,
          ownerUid: user.id,
          type: editGoalType,
          title: normalizedTitle,
          description: editDetails,
          projectedStartDate: existingGoal.projectedStartDate,
          projectedEndDate: existingGoal.projectedEndDate,
          timeframeLabel: existingGoal.timeframe === "Ongoing" ? "" : existingGoal.timeframe,
          isFocus: existingGoal.isFocus,
          existingGoal,
        });

        if (updatedGoal.status !== editStatus) {
          await dataRepository.updateGoalStatus(user.id, updatedGoal.id, editStatus);
        }
      } else if (selectedEventRef.kind === "subgoal") {
        const existingSubgoal = subgoals.find((subgoal) => subgoal.id === selectedEventRef.id);
        if (!existingSubgoal) {
          throw new Error("The selected subgoal no longer exists.");
        }

        if (!editParentGoalId) {
          throw new Error("Select a parent goal for this subgoal.");
        }

        const updatedSubgoal = await dataRepository.saveSubgoal({
          subgoalId: existingSubgoal.id,
          ownerUid: user.id,
          goalId: editParentGoalId,
          title: normalizedTitle,
          description: editDetails,
          projectedStartDate: existingSubgoal.projectedStartDate,
          projectedEndDate: existingSubgoal.projectedEndDate,
          timeframeLabel: existingSubgoal.timeframe === "Ongoing" ? "" : existingSubgoal.timeframe,
          existingSubgoal,
        });

        if (updatedSubgoal.status !== editStatus) {
          await dataRepository.updateSubgoalStatus(user.id, updatedSubgoal.id, editStatus);
        }
      } else {
        const existingTask = tasks.find((task) => task.id === selectedEventRef.id);
        if (!existingTask) {
          throw new Error("The selected task no longer exists.");
        }

        if (!editParentSubgoalId) {
          throw new Error("Select a parent subgoal for this task.");
        }

        const updatedTask = await dataRepository.saveTask({
          taskId: existingTask.id,
          ownerUid: user.id,
          subgoalId: editParentSubgoalId,
          title: normalizedTitle,
          notes: editDetails,
          dueDate: existingTask.dueDate,
          existingTask,
        });

        if (updatedTask.status !== editStatus) {
          await dataRepository.updateTaskStatus(user.id, updatedTask.id, editStatus);
        }
      }

      setIsEditModalOpen(false);
      await reloadData();
    } catch (saveError) {
      setActionError(getErrorMessage(saveError, "We could not save this event."));
    } finally {
      setIsSaving(false);
    }
  }

  function clearSelectedEvent() {
    setSelectedEventRef(null);
    setEditTitle("");
    setEditDetails("");
    setEditStatus("not_started");
    setEditParentGoalId("");
    setEditParentSubgoalId("");
    setIsEditModalOpen(false);
  }

  const selectedEventLabel = selectedEventRef
    ? selectedEventRef.kind === "goal"
      ? "Goal"
      : selectedEventRef.kind === "subgoal"
        ? "Subgoal"
        : "Task"
    : null;

  const calendarToolbar = isCompactToolbar
    ? {
        left: "prev,next",
        center: "title",
        right: "today dayGridMonth,listWeek",
      }
    : {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,dayGridWeek,dayGridDay",
      };

  const primaryActionClass = isTouchFriendly
    ? "pdp-btn-primary mt-4 w-full px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    : "pdp-btn-primary mt-4 w-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

  const secondaryActionClass = isTouchFriendly
    ? "mt-4 w-full rounded-full bg-slate-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
    : "mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400";

  return (
    <section className={`pdp-panel ${isTouchFriendly ? "pdp-touch-mode" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Calendar</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Select dates to create goals/subgoals/tasks, drag events to reschedule, and inspect hierarchy links directly in the calendar.
          </p>
        </div>
        {isRefreshing || isSaving ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
            {isRefreshing ? "Refreshing" : "Saving"}
          </span>
        ) : null}
      </div>

      {loadError ? <p className="mt-4 text-sm text-red-700">{loadError}</p> : null}
      {actionError ? <p className="mt-2 text-sm text-red-700">{actionError}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="order-1 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:order-1">
          <div className="mb-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Type filters</p>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={showGoals} onChange={(event) => setShowGoals(event.target.checked)} />
                Goals
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={showSubgoals}
                  onChange={(event) => setShowSubgoals(event.target.checked)}
                />
                Subgoals
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={showTasks} onChange={(event) => setShowTasks(event.target.checked)} />
                Tasks
              </label>
            </div>

            <label className="block text-xs text-slate-700">
              Status filter
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="pdp-control mt-1 px-2 py-2 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            <label className="block text-xs text-slate-700">
              Goal scope
              <select
                value={scopeGoalType}
                onChange={(event) => setScopeGoalType(event.target.value as "all" | GoalType)}
                className="pdp-control mt-1 px-2 py-2 text-xs"
              >
                <option value="all">All goals</option>
                <option value="professional">Professional only</option>
                <option value="personal">Personal only</option>
              </select>
            </label>

            <label className="block text-xs text-slate-700">
              Interaction density
              <button
                type="button"
                onClick={() => setIsTouchFriendly((current) => !current)}
                className="pdp-btn-secondary mt-1 w-full rounded-lg px-2 py-2 text-xs font-medium"
              >
                {isTouchFriendly ? "Comfortable taps enabled" : "Compact controls"}
              </button>
            </label>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[320px] md:min-w-[680px] lg:min-w-0">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
                initialView="dayGridMonth"
                height="auto"
                headerToolbar={calendarToolbar}
                editable
                selectable
                selectMirror
                dayMaxEventRows={4}
                events={events}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventContent={(contentArg) => {
                  const hierarchy = String(contentArg.event.extendedProps.hierarchy ?? "");
                  const status = String(contentArg.event.extendedProps.status ?? "not_started") as ItemStatus;
                  return (
                    <div className="pdp-calendar-event">
                      <div className="truncate font-semibold leading-tight">{contentArg.event.title}</div>
                      <div className="truncate text-[11px] opacity-90">{hierarchy}</div>
                      <span className={`pdp-status-chip ${statusChipClass(status)}`}>
                        {status.replaceAll("_", " ")}
                      </span>
                    </div>
                  );
                }}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 sm:grid-cols-3">
            <p><span className="font-semibold text-blue-700">G</span> Goal range events</p>
            <p><span className="font-semibold text-amber-600">SG</span> Subgoal child events</p>
            <p><span className="font-semibold text-emerald-600">T</span> Task due-date markers</p>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-semibold text-slate-900">Today&apos;s agenda</h3>
            {todaysAgenda.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {todaysAgenda.slice(0, 8).map((agendaItem) => (
                  <li key={agendaItem.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{agendaLabel(agendaItem.kind)} | {agendaItem.title}</p>
                      <span className={`pdp-status-chip ${statusChipClass(agendaItem.status)}`}>
                        {agendaItem.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{agendaItem.hierarchy}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No visible items scheduled for today.</p>
            )}
          </div>
        </div>

        <aside className="order-2 space-y-4 lg:order-2">
          <div className="pdp-panel-muted">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setIsCreateModalOpen(true);
                }}
                className="rounded-full bg-blue-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-600"
              >
                + New item
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Selection: {selection.startDate} to {selection.endDate}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Drag to select dates or click an event to edit it.
            </p>
          </div>

          <CrudModal
            isOpen={isCreateModalOpen}
            title="Create from selected dates"
            onClose={() => setIsCreateModalOpen(false)}
          >
            <form onSubmit={handleCreateSubmit} className="grid gap-3">
              <p className="text-xs text-slate-600">
                Selection: {selection.startDate} to {selection.endDate}
              </p>

              <label className="block text-sm text-slate-700">
                Item type
                <select
                  value={createType}
                  onChange={(event) => setCreateType(event.target.value as CreateType)}
                  className="pdp-control mt-1"
                >
                  <option value="goal">Goal</option>
                  <option value="subgoal">Subgoal</option>
                  <option value="task">Task</option>
                </select>
              </label>

              {createType === "goal" ? (
                <label className="block text-sm text-slate-700">
                  Goal type
                  <select
                    value={goalType}
                    onChange={(event) => setGoalType(event.target.value as GoalType)}
                    className="pdp-control mt-1"
                  >
                    <option value="professional">Professional</option>
                    <option value="personal">Personal</option>
                  </select>
                </label>
              ) : null}

              {createType === "subgoal" ? (
                <label className="block text-sm text-slate-700">
                  Parent goal
                  <select
                    value={draftGoalId}
                    onChange={(event) => setDraftGoalId(event.target.value)}
                    className="pdp-control mt-1"
                  >
                    <option value="">Select goal</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {createType === "task" ? (
                <label className="block text-sm text-slate-700">
                  Parent subgoal
                  <select
                    value={draftSubgoalId}
                    onChange={(event) => setDraftSubgoalId(event.target.value)}
                    className="pdp-control mt-1"
                  >
                    <option value="">Select subgoal</option>
                    {subgoals.map((subgoal) => (
                      <option key={subgoal.id} value={subgoal.id}>
                        {subgoal.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block text-sm text-slate-700">
                Title
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  className="pdp-control mt-1"
                  placeholder="Add item title"
                />
              </label>

              <label className="block text-sm text-slate-700">
                {createType === "task" ? "Notes" : "Description"}
                <textarea
                  value={draftDetails}
                  onChange={(event) => setDraftDetails(event.target.value)}
                  className="pdp-control mt-1 min-h-20"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={isSaving} className={primaryActionClass}>
                  {isSaving ? "Saving..." : "Create on calendar"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CrudModal>

          <CrudModal
            isOpen={isEditModalOpen && selectedEventRef !== null}
            title={selectedEventLabel ? `Edit ${selectedEventLabel.toLowerCase()}` : "Edit event"}
            onClose={clearSelectedEvent}
          >
            <form onSubmit={handleEditSubmit} className="grid gap-3">
              {selectedEventRef ? (
                <>
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">Editing</span>{" "}
                    {selectedEventLabel}
                  </p>

                  <label className="block text-sm text-slate-700">
                    Title
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="pdp-control mt-1"
                    />
                  </label>

                  <label className="block text-sm text-slate-700">
                    {selectedEventRef.kind === "task" ? "Notes" : "Description"}
                    <textarea
                      value={editDetails}
                      onChange={(event) => setEditDetails(event.target.value)}
                      className="pdp-control mt-1 min-h-20"
                    />
                  </label>

                  <label className="block text-sm text-slate-700">
                    Status
                    <select
                      value={editStatus}
                      onChange={(event) => setEditStatus(event.target.value as ItemStatus)}
                      className="pdp-control mt-1"
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </label>

                  {selectedEventRef.kind === "goal" ? (
                    <label className="block text-sm text-slate-700">
                      Goal type
                      <select
                        value={editGoalType}
                        onChange={(event) => setEditGoalType(event.target.value as GoalType)}
                        className="pdp-control mt-1"
                      >
                        <option value="professional">Professional</option>
                        <option value="personal">Personal</option>
                      </select>
                    </label>
                  ) : null}

                  {selectedEventRef.kind === "subgoal" ? (
                    <label className="block text-sm text-slate-700">
                      Parent goal
                      <select
                        value={editParentGoalId}
                        onChange={(event) => setEditParentGoalId(event.target.value)}
                        className="pdp-control mt-1"
                      >
                        <option value="">Select goal</option>
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {selectedEventRef.kind === "task" ? (
                    <label className="block text-sm text-slate-700">
                      Parent subgoal
                      <select
                        value={editParentSubgoalId}
                        onChange={(event) => setEditParentSubgoalId(event.target.value)}
                        className="pdp-control mt-1"
                      >
                        <option value="">Select subgoal</option>
                        {subgoals.map((subgoal) => (
                          <option key={subgoal.id} value={subgoal.id}>
                            {subgoal.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={isSaving} className={secondaryActionClass}>
                      {isSaving ? "Saving..." : "Save event updates"}
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedEvent}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : null}
            </form>
          </CrudModal>
        </aside>
      </div>
    </section>
  );
}

function normalizeDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) {
    return null;
  }

  const normalizedStart = startDate ?? endDate;
  const normalizedEnd = endDate ?? startDate;

  if (!normalizedStart || !normalizedEnd) {
    return null;
  }

  return normalizedStart <= normalizedEnd
    ? { start: normalizedStart, end: normalizedEnd }
    : { start: normalizedEnd, end: normalizedStart };
}

function toExclusiveEndDate(dateOnly: string) {
  const parsed = new Date(`${dateOnly}T00:00:00`);
  return toDateOnly(addDays(parsed, 1));
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getTodaySelection(): CalendarSelection {
  const today = toDateOnly(new Date());
  return {
    startDate: today,
    endDate: today,
  };
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: string }).message;
    if (message) {
      return message;
    }
  }

  return fallbackMessage;
}

function statusChipClass(status: ItemStatus) {
  if (status === "done") {
    return "pdp-status-done";
  }

  if (status === "in_progress") {
    return "pdp-status-progress";
  }

  return "pdp-status-not-started";
}

function agendaLabel(kind: CalendarItemKind) {
  if (kind === "goal") {
    return "G";
  }

  if (kind === "subgoal") {
    return "SG";
  }

  return "T";
}

function getCalendarEventColors() {
  if (typeof document === "undefined") {
    return {
      goalProfessionalBackground: "#2563eb",
      goalProfessionalBorder: "#1d4ed8",
      goalPersonalBackground: "#db2777",
      goalPersonalBorder: "#be185d",
      subgoalBackground: "#f59e0b",
      subgoalBorder: "#d97706",
      taskBackground: "#059669",
      taskBorder: "#047857",
    };
  }

  const computed = window.getComputedStyle(document.documentElement);
  return {
    goalProfessionalBackground: readCssColor(computed, "--pdp-event-goal-professional-bg", "#2563eb"),
    goalProfessionalBorder: readCssColor(computed, "--pdp-event-goal-professional-border", "#1d4ed8"),
    goalPersonalBackground: readCssColor(computed, "--pdp-event-goal-personal-bg", "#db2777"),
    goalPersonalBorder: readCssColor(computed, "--pdp-event-goal-personal-border", "#be185d"),
    subgoalBackground: readCssColor(computed, "--pdp-event-subgoal-bg", "#f59e0b"),
    subgoalBorder: readCssColor(computed, "--pdp-event-subgoal-border", "#d97706"),
    taskBackground: readCssColor(computed, "--pdp-event-task-bg", "#059669"),
    taskBorder: readCssColor(computed, "--pdp-event-task-border", "#047857"),
  };
}

function readCssColor(computed: CSSStyleDeclaration, propertyName: string, fallback: string) {
  const value = computed.getPropertyValue(propertyName).trim();
  return value.length > 0 ? value : fallback;
}