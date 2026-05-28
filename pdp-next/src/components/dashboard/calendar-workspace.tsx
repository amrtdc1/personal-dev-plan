"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { Goal, GoalTimeframeLevel, GoalType, ItemStatus, ChildGoal, Task } from "@/lib/domain/types";
import { getTaskParentGoalId } from "@/lib/domain/types";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import { CrudModal } from "@/components/ui/crud-modal";
import { InfoPopover } from "@/components/ui/info-popover";

type CalendarItemKind = "goal" | "childGoal" | "task";
type CreateType = "goal" | "task";
type StatusFilter = "all" | ItemStatus;
type CalendarViewPreference = "dayGridMonth" | "dayGridWeek" | "dayGridDay" | "listWeek";

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

type EventPreview = {
  kind: CalendarItemKind;
  title: string;
  status: ItemStatus;
  hierarchy: string;
  dateSummary: string;
  details: string;
  pinned: boolean;
  position: {
    left: number;
    top: number;
    width: number;
    anchorX: number;
    anchorY: number;
  };
};

type CalendarFilterPreferences = {
  showGoals: boolean;
  showGoalChildren: boolean;
  showTasks: boolean;
  statusFilter: StatusFilter;
  scopeGoalType: "all" | GoalType;
};

type CalendarDensityPreference = "compact" | "comfortable";

const DEFAULT_SELECTION = getTodaySelection();
const CALENDAR_FILTER_PREFERENCES_STORAGE_KEY = "pdp.calendarFilterPreferences";
const CALENDAR_DENSITY_PREFERENCE_STORAGE_KEY = "pdp.calendarDensityPreference";
const CALENDAR_VIEW_PREFERENCE_STORAGE_KEY = "pdp.calendarViewPreference";
const CALENDAR_CREATE_TYPE_STORAGE_KEY = "pdp.calendarCreateType";
const CALENDAR_GOAL_TYPE_STORAGE_KEY = "pdp.calendarGoalType";
// Keep existing key name for backward compatibility with prior localStorage values.
const CALENDAR_PARENT_CHILD_GOAL_STORAGE_KEY = "pdp.calendarParentChildGoalId";
const CALENDAR_FILTER_PANEL_OPEN_STORAGE_KEY = "pdp.calendarFilterPanelOpen";

export function CalendarWorkspace() {
  const { isLoading, user, error } = db.useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [childGoals, setChildGoals] = useState<ChildGoal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selection, setSelection] = useState<CalendarSelection>(DEFAULT_SELECTION);
  const [createType, setCreateType] = useState<CreateType>(() => readCalendarCreateTypePreference());
  const [goalType, setGoalType] = useState<GoalType>(() => readCalendarGoalTypePreference());
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetails, setDraftDetails] = useState("");
  const [draftChildGoalId, setDraftChildGoalId] = useState<string>(() => readCalendarParentChildGoalPreference());
  const [selectedEventRef, setSelectedEventRef] = useState<SelectedEventRef | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>("not_started");
  const [editGoalType, setEditGoalType] = useState<GoalType>("professional");
  const [editParentGoalId, setEditParentGoalId] = useState("");
  const [editParentChildGoalId, setEditParentChildGoalId] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const persistedFilters = useMemo(() => readCalendarFilterPreferences(), []);
  const [showGoals, setShowGoals] = useState(persistedFilters.showGoals);
  const [showGoalChildren, setShowGoalChildren] = useState(persistedFilters.showGoalChildren);
  const [showTasks, setShowTasks] = useState(persistedFilters.showTasks);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(persistedFilters.statusFilter);
  const [scopeGoalType, setScopeGoalType] = useState<"all" | GoalType>(persistedFilters.scopeGoalType);
  const [densityPreference, setDensityPreference] = useState<CalendarDensityPreference | null>(() => readCalendarDensityPreference());
  const [calendarViewPreference, setCalendarViewPreference] = useState<CalendarViewPreference>(() =>
    readCalendarViewPreference(),
  );
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(() => readCalendarFilterPanelOpenPreference());
  const [eventPreview, setEventPreview] = useState<EventPreview | null>(null);

  const [isCompactToolbar, setIsCompactToolbar] = useState(false);
  const [isTouchFriendly, setIsTouchFriendly] = useState(false);
  const [isMobileCalendar, setIsMobileCalendar] = useState(false);
  const suppressNextEventClickRef = useRef<{ id: string; until: number } | null>(null);
  const previewCardRef = useRef<HTMLDivElement | null>(null);
  const previewCloseTimerRef = useRef<number | null>(null);

  const goalMap = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const childGoalMap = useMemo(() => new Map(childGoals.map((childGoal) => [childGoal.id, childGoal])), [childGoals]);
  const eventColors = getCalendarEventColors();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const updateCompactToolbar = () => {
      setIsCompactToolbar(mediaQuery.matches);
      setIsTouchFriendly(densityPreference ? densityPreference === "comfortable" : mediaQuery.matches);
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
  }, [densityPreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CALENDAR_VIEW_PREFERENCE_STORAGE_KEY, calendarViewPreference);
  }, [calendarViewPreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CALENDAR_CREATE_TYPE_STORAGE_KEY, createType);
  }, [createType]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CALENDAR_GOAL_TYPE_STORAGE_KEY, goalType);
  }, [goalType]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!draftChildGoalId) {
      window.localStorage.removeItem(CALENDAR_PARENT_CHILD_GOAL_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CALENDAR_PARENT_CHILD_GOAL_STORAGE_KEY, draftChildGoalId);
  }, [draftChildGoalId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!densityPreference) {
      window.localStorage.removeItem(CALENDAR_DENSITY_PREFERENCE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CALENDAR_DENSITY_PREFERENCE_STORAGE_KEY, densityPreference);
  }, [densityPreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CALENDAR_FILTER_PANEL_OPEN_STORAGE_KEY, isFilterPanelOpen ? "true" : "false");
  }, [isFilterPanelOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const preferences: CalendarFilterPreferences = {
      showGoals,
      showGoalChildren,
      showTasks,
      statusFilter,
      scopeGoalType,
    };

    window.localStorage.setItem(CALENDAR_FILTER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }, [scopeGoalType, showGoals, showGoalChildren, showTasks, statusFilter]);

  useEffect(() => {
    if (!eventPreview || !previewCardRef.current) {
      return;
    }

    const rect = previewCardRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const isMobileViewport = window.innerWidth <= 640;
    const previewGap = 10;

    let nextLeft = eventPreview.position.left;
    let nextTop = eventPreview.position.top;

    if (isMobileViewport) {
      nextLeft = Math.max(viewportPadding, (window.innerWidth - rect.width) / 2);
      const prefersAbove = eventPreview.position.anchorY > window.innerHeight / 2;
      const preferredTop = prefersAbove
        ? eventPreview.position.anchorY - rect.height - previewGap
        : eventPreview.position.anchorY + previewGap;
      nextTop = preferredTop;
    } else {
      const rightCandidate = eventPreview.position.anchorX + previewGap;
      const leftCandidate = eventPreview.position.anchorX - rect.width - previewGap;

      if (rightCandidate + rect.width <= window.innerWidth - viewportPadding) {
        nextLeft = rightCandidate;
      } else if (leftCandidate >= viewportPadding) {
        nextLeft = leftCandidate;
      } else {
        nextLeft = eventPreview.position.anchorX - rect.width / 2;
      }

      nextTop = eventPreview.position.anchorY - rect.height / 2;
    }

    nextLeft = Math.min(
      Math.max(nextLeft, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - viewportPadding - rect.width),
    );
    nextTop = Math.min(
      Math.max(nextTop, viewportPadding),
      Math.max(viewportPadding, window.innerHeight - viewportPadding - rect.height),
    );

    if (
      Math.abs(nextLeft - eventPreview.position.left) > 0.5 ||
      Math.abs(nextTop - eventPreview.position.top) > 0.5
    ) {
      setEventPreview((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          position: {
            ...current.position,
            left: nextLeft,
            top: nextTop,
          },
        };
      });
    }
  }, [eventPreview]);

  useEffect(() => {
    return () => {
      if (previewCloseTimerRef.current !== null) {
        window.clearTimeout(previewCloseTimerRef.current);
        previewCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!eventPreview || typeof window === "undefined") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (previewCloseTimerRef.current !== null) {
        window.clearTimeout(previewCloseTimerRef.current);
        previewCloseTimerRef.current = null;
      }

      setEventPreview(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [eventPreview]);

  useEffect(() => {
    if (typeof window === "undefined" || isCreateModalOpen || isEditModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setActionError(null);
      setIsCreateModalOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isCreateModalOpen, isEditModalOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || isCreateModalOpen || isEditModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setIsFilterPanelOpen((current) => !current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isCreateModalOpen, isEditModalOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const viewportQuery = window.matchMedia("(max-width: 640px)");
    const syncMobileCalendar = () => {
      setIsMobileCalendar(viewportQuery.matches);
    };

    syncMobileCalendar();

    if (typeof viewportQuery.addEventListener === "function") {
      viewportQuery.addEventListener("change", syncMobileCalendar);
    } else {
      viewportQuery.addListener(syncMobileCalendar);
    }

    return () => {
      if (typeof viewportQuery.removeEventListener === "function") {
        viewportQuery.removeEventListener("change", syncMobileCalendar);
      } else {
        viewportQuery.removeListener(syncMobileCalendar);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
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

        const childGoalGroups = await Promise.all(
          loadedGoals.map((goal) => dataRepository.listChildGoals(currentUser.id, goal.id, { includeDeleted: true })),
        );
        const loadedChildGoals = childGoalGroups.flat().filter((childGoal) => !childGoal.deletedAt);

        const taskGroups = await Promise.all(
          [...loadedGoals.map((goal) => goal.id), ...loadedChildGoals.map((childGoal) => childGoal.id), null].map((parentGoalId) =>
            dataRepository.listTasks(currentUser.id, parentGoalId, { includeDeleted: true }),
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

        if (!isCancelled) {
          setGoals(loadedGoals);
          setChildGoals(loadedChildGoals);
          setTasks(loadedTasks);
          setDraftChildGoalId((current) => {
            if (current && loadedChildGoals.some((childGoal) => childGoal.id === current)) {
              return current;
            }

            return loadedChildGoals[0]?.id || "";
          });
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
        title: goal.title,
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
          goalTypeLabel: goal.type === "professional" ? "Professional" : "Personal",
          kindLabel: "Goal",
          status: goal.status,
        },
      });
    }

    for (const childGoal of childGoals) {
      if (!showGoalChildren || !statusMatch(childGoal.status)) {
        continue;
      }

      const parentGoal = goalMap.get(childGoal.goalId);
      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const range = normalizeDateRange(childGoal.projectedStartDate, childGoal.projectedEndDate);
      if (!range) {
        continue;
      }

      builtEvents.push({
        id: `childGoal:${childGoal.id}`,
        title: childGoal.title,
        start: range.start,
        end: toExclusiveEndDate(range.end),
        allDay: true,
        editable: true,
        durationEditable: true,
        backgroundColor: eventColors.childGoalBackground,
        borderColor: eventColors.childGoalBorder,
        extendedProps: {
          kind: "childGoal" as CalendarItemKind,
          hierarchy: parentGoal ? `${parentGoal.title} -> ${childGoal.title}` : "Child goal",
          goalTypeLabel: parentGoal ? (parentGoal.type === "professional" ? "Professional" : "Personal") : "No goal type",
          kindLabel: "Goal child",
          status: childGoal.status,
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

      const parentGoalId = getTaskParentGoalId(task);
      const parentChildGoal = parentGoalId ? childGoalMap.get(parentGoalId) : null;
      const parentGoal = parentChildGoal ? goalMap.get(parentChildGoal.goalId) : parentGoalId ? goalMap.get(parentGoalId) : null;

      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const hierarchyBits = [
        parentGoal ? `Goal: ${parentGoal.title}` : null,
        parentChildGoal ? `Child goal: ${parentChildGoal.title}` : null,
      ].filter((bit): bit is string => Boolean(bit));

      builtEvents.push({
        id: `task:${task.id}`,
        title: task.title,
        start: task.dueDate,
        allDay: true,
        editable: true,
        durationEditable: false,
        backgroundColor: eventColors.taskBackground,
        borderColor: eventColors.taskBorder,
        extendedProps: {
          kind: "task" as CalendarItemKind,
          hierarchy: hierarchyBits.length > 0 ? hierarchyBits.join(" | ") : "Task",
          goalTypeLabel: parentGoal ? (parentGoal.type === "professional" ? "Professional" : "Personal") : "No goal type",
          kindLabel: "Task",
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
    showGoalChildren,
    showTasks,
    statusFilter,
    childGoalMap,
    childGoals,
    eventColors,
    tasks,
  ]);

  const formatPreviewDateSummary = (startDate: string | null, endDate: string | null) => {
    const normalized = normalizeDateRange(startDate, endDate);
    if (!normalized) {
      return "No scheduled date";
    }

    if (normalized.start === normalized.end) {
      return `Due ${normalized.start}`;
    }

    return `${normalized.start} to ${normalized.end}`;
  };

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

    for (const childGoal of childGoals) {
      if (!showGoalChildren || !statusMatch(childGoal.status)) {
        continue;
      }

      const parentGoal = goalMap.get(childGoal.goalId);
      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const range = normalizeDateRange(childGoal.projectedStartDate, childGoal.projectedEndDate);
      if (!range || todayDate < range.start || todayDate > range.end) {
        continue;
      }

      agendaItems.push({
        id: `childGoal:${childGoal.id}`,
        kind: "childGoal",
        title: childGoal.title,
        status: childGoal.status,
        hierarchy: parentGoal ? `${parentGoal.title} -> ${childGoal.title}` : "Child goal",
      });
    }

    for (const task of tasks) {
      if (!showTasks || !statusMatch(task.status) || !task.dueDate || task.dueDate !== todayDate) {
        continue;
      }

      const parentGoalId = getTaskParentGoalId(task);
      const parentChildGoal = parentGoalId ? childGoalMap.get(parentGoalId) : null;
      const parentGoal = parentChildGoal ? goalMap.get(parentChildGoal.goalId) : parentGoalId ? goalMap.get(parentGoalId) : null;

      if (scopeGoalType !== "all" && parentGoal?.type !== scopeGoalType) {
        continue;
      }

      const hierarchyBits = [
        parentGoal ? `Goal: ${parentGoal.title}` : null,
        parentChildGoal ? `Child goal: ${parentChildGoal.title}` : null,
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
      childGoal: 1,
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
    showGoalChildren,
    showTasks,
    statusFilter,
    childGoalMap,
    childGoals,
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
      const childGoalGroups = await Promise.all(
        loadedGoals.map((goal) => dataRepository.listChildGoals(currentUser.id, goal.id, { includeDeleted: true })),
      );
      const loadedChildGoals = childGoalGroups.flat().filter((childGoal) => !childGoal.deletedAt);
      const taskGroups = await Promise.all(
        [...loadedGoals.map((goal) => goal.id), ...loadedChildGoals.map((childGoal) => childGoal.id), null].map((parentGoalId) =>
          dataRepository.listTasks(currentUser.id, parentGoalId, { includeDeleted: true }),
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

      setGoals(loadedGoals);
      setChildGoals(loadedChildGoals);
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

  function handleDateClick(clickArg: { date: Date }) {
    const normalizedDate = toDateOnly(clickArg.date);

    setSelection({
      startDate: normalizedDate,
      endDate: normalizedDate,
    });
    setActionError(null);
    setIsCreateModalOpen(true);
  }

  function handleDatesSet(datesArg: DatesSetArg) {
    const nextView = datesArg.view.type;
    if (
      nextView === "dayGridMonth" ||
      nextView === "dayGridWeek" ||
      nextView === "dayGridDay" ||
      nextView === "listWeek"
    ) {
      setCalendarViewPreference(nextView);
    }
  }

  function resetCalendarFilters() {
    setShowGoals(true);
    setShowGoalChildren(true);
    setShowTasks(true);
    setStatusFilter("all");
    setScopeGoalType("all");
  }

  function handleEventClick(clickArg: EventClickArg) {
    const suppressClick = suppressNextEventClickRef.current;
    if (suppressClick && suppressClick.id === clickArg.event.id && Date.now() < suppressClick.until) {
      suppressNextEventClickRef.current = null;
      return;
    }

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
      setEditParentChildGoalId("");
    } else if (kind === "childGoal") {
      const selectedChildGoal = childGoals.find((childGoal) => childGoal.id === id);
      if (!selectedChildGoal) {
        setActionError("The selected child goal no longer exists.");
        return;
      }

      setEditTitle(selectedChildGoal.title);
      setEditDetails(selectedChildGoal.description);
      setEditStatus(selectedChildGoal.status);
      setEditGoalType("professional");
      setEditParentGoalId(selectedChildGoal.goalId);
      setEditParentChildGoalId("");
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
      setEditParentChildGoalId(getTaskParentGoalId(selectedTask) ?? "");
    }

    setSelectedEventRef({ kind, id });
    setActionError(null);
    setIsEditModalOpen(true);
  }

  function getPreviewPosition(anchorEl: HTMLElement, anchorPoint?: { x: number; y: number }) {
    const rect = anchorEl.getBoundingClientRect();
    const viewportPadding = 12;
    const preferredWidth = 280;
    const estimatedHeight = 240;
    const previewGap = 10;
    const isMobileViewport = window.innerWidth <= 640;
    const anchorX = anchorPoint?.x ?? rect.left + rect.width / 2;
    const anchorY = anchorPoint?.y ?? rect.top + rect.height / 2;

    if (isMobileViewport) {
      const width = Math.min(320, Math.max(220, window.innerWidth - viewportPadding * 2));
      const left = Math.max(viewportPadding, (window.innerWidth - width) / 2);
      const prefersAbove = anchorY > window.innerHeight / 2;
      const topCandidate = prefersAbove ? anchorY - previewGap - estimatedHeight : anchorY + previewGap;
      const top = Math.min(
        Math.max(topCandidate, viewportPadding),
        Math.max(viewportPadding, window.innerHeight - viewportPadding - estimatedHeight),
      );

      return { left, top, width, anchorX, anchorY };
    }

    const width = Math.min(preferredWidth, Math.max(220, window.innerWidth - viewportPadding * 2));
    const enoughRoomRight = anchorX + previewGap + width <= window.innerWidth - viewportPadding;
    const enoughRoomLeft = anchorX - previewGap - width >= viewportPadding;

    let left = anchorX + previewGap;
    if (enoughRoomRight) {
      left = anchorX + previewGap;
    } else if (enoughRoomLeft) {
      left = anchorX - previewGap - width;
    } else {
      left = anchorX - width / 2;
    }

    left = Math.min(
      Math.max(left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - viewportPadding - width),
    );

    let top = anchorY - estimatedHeight / 2;
    top = Math.min(
      Math.max(top, viewportPadding),
      Math.max(viewportPadding, window.innerHeight - viewportPadding - estimatedHeight),
    );

    return { left, top, width, anchorX, anchorY };
  }

  function buildPreview(
    eventId: string,
    pinned: boolean,
    anchorEl: HTMLElement,
    anchorPoint?: { x: number; y: number },
  ): EventPreview | null {
    const [kind, id] = eventId.split(":") as [CalendarItemKind, string];
    const position = getPreviewPosition(anchorEl, anchorPoint);

    if (kind === "goal") {
      const goal = goals.find((item) => item.id === id);
      if (!goal) {
        return null;
      }

      return {
        kind,
        title: goal.title,
        status: goal.status,
        hierarchy: `${goal.type === "professional" ? "Professional" : "Personal"} goal`,
        dateSummary: formatPreviewDateSummary(goal.projectedStartDate, goal.projectedEndDate),
        details: goal.description || "No description provided.",
        pinned,
        position,
      };
    }

    if (kind === "childGoal") {
      const childGoal = childGoals.find((item) => item.id === id);
      if (!childGoal) {
        return null;
      }

      const parentGoal = goalMap.get(childGoal.goalId);

      return {
        kind,
        title: childGoal.title,
        status: childGoal.status,
        hierarchy: parentGoal ? `${parentGoal.title} -> ${childGoal.title}` : "Child goal",
        dateSummary: formatPreviewDateSummary(childGoal.projectedStartDate, childGoal.projectedEndDate),
        details: childGoal.description || "No description provided.",
        pinned,
        position,
      };
    }

    const task = tasks.find((item) => item.id === id);
    if (!task) {
      return null;
    }

    const parentGoalId = getTaskParentGoalId(task);
    const parentChildGoal = parentGoalId ? childGoalMap.get(parentGoalId) : null;
    const parentGoal = parentChildGoal ? goalMap.get(parentChildGoal.goalId) : parentGoalId ? goalMap.get(parentGoalId) : null;
    const hierarchyBits = [
      parentGoal ? `Goal: ${parentGoal.title}` : null,
      parentChildGoal ? `Child goal: ${parentChildGoal.title}` : null,
    ].filter((bit): bit is string => Boolean(bit));

    return {
      kind,
      title: task.title,
      status: task.status,
      hierarchy: hierarchyBits.length > 0 ? hierarchyBits.join(" | ") : "Task",
      dateSummary: task.dueDate ? `Due ${task.dueDate}` : "No due date",
      details: task.notes || "No notes provided.",
      pinned,
      position,
    };
  }

  function cancelPreviewClose() {
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  }

  function openEventPreview(
    eventId: string,
    anchorEl: HTMLElement,
    pinned: boolean,
    anchorPoint?: { x: number; y: number },
  ) {
    cancelPreviewClose();
    const preview = buildPreview(eventId, pinned, anchorEl, anchorPoint);
    if (!preview) {
      return;
    }

    setEventPreview(preview);
  }

  function closeEventPreview(immediate = false) {
    if (immediate) {
      cancelPreviewClose();
      setEventPreview((current) => (current?.pinned ? current : null));
      return;
    }

    cancelPreviewClose();
    previewCloseTimerRef.current = window.setTimeout(() => {
      setEventPreview((current) => (current?.pinned ? current : null));
      previewCloseTimerRef.current = null;
    }, 120);
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
          timeframeLevel: existingGoal.timeframeLevel,
          title: existingGoal.title,
          description: existingGoal.description,
          projectedStartDate: nextStart,
          projectedEndDate: nextEndInclusive,
          timeframeLabel: existingGoal.timeframe === "Ongoing" ? "" : existingGoal.timeframe,
          isFocus: existingGoal.isFocus,
          existingGoal,
        });
      } else if (kind === "childGoal") {
        const existingChildGoal = childGoals.find((childGoal) => childGoal.id === itemId);
        if (!existingChildGoal) {
          throw new Error("Child goal was not found for drag update.");
        }

        await dataRepository.saveChildGoal({
          childGoalId: existingChildGoal.id,
          ownerUid: user.id,
          goalId: existingChildGoal.goalId,
          title: existingChildGoal.title,
          description: existingChildGoal.description,
          projectedStartDate: nextStart,
          projectedEndDate: nextEndInclusive,
          timeframeLabel: existingChildGoal.timeframe === "Ongoing" ? "" : existingChildGoal.timeframe,
          existingChildGoal,
        });
      } else if (kind === "task") {
        const existingTask = tasks.find((task) => task.id === itemId);
        if (!existingTask) {
          throw new Error("Task was not found for drag update.");
        }

        await dataRepository.saveTask({
          taskId: existingTask.id,
          ownerUid: user.id,
          parentGoalId: getTaskParentGoalId(existingTask),
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
          timeframeLevel: inferGoalTimeframeLevel(selection.startDate, selection.endDate),
          title: draftTitle,
          description: draftDetails,
          projectedStartDate: selection.startDate,
          projectedEndDate: selection.endDate,
          timeframeLabel: "",
          isFocus: false,
        });
      } else {
        if (!draftChildGoalId) {
          throw new Error("Select a parent child goal before creating a task.");
        }

        await dataRepository.saveTask({
          ownerUid: user.id,
          parentGoalId: draftChildGoalId,
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
          timeframeLevel: existingGoal.timeframeLevel,
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
      } else if (selectedEventRef.kind === "childGoal") {
        const existingChildGoal = childGoals.find((childGoal) => childGoal.id === selectedEventRef.id);
        if (!existingChildGoal) {
          throw new Error("The selected child goal no longer exists.");
        }

        if (!editParentGoalId) {
          throw new Error("Select a parent goal for this child goal.");
        }

        const updatedChildGoal = await dataRepository.saveChildGoal({
          childGoalId: existingChildGoal.id,
          ownerUid: user.id,
          goalId: editParentGoalId,
          title: normalizedTitle,
          description: editDetails,
          projectedStartDate: existingChildGoal.projectedStartDate,
          projectedEndDate: existingChildGoal.projectedEndDate,
          timeframeLabel: existingChildGoal.timeframe === "Ongoing" ? "" : existingChildGoal.timeframe,
          existingChildGoal,
        });

        if (updatedChildGoal.status !== editStatus) {
          await dataRepository.updateChildGoalStatus(user.id, updatedChildGoal.id, editStatus);
        }
      } else {
        const existingTask = tasks.find((task) => task.id === selectedEventRef.id);
        if (!existingTask) {
          throw new Error("The selected task no longer exists.");
        }

        if (!editParentChildGoalId) {
          throw new Error("Select a parent child goal for this task.");
        }

        const updatedTask = await dataRepository.saveTask({
          taskId: existingTask.id,
          ownerUid: user.id,
          parentGoalId: editParentChildGoalId,
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
    setEditParentChildGoalId("");
    setIsEditModalOpen(false);
  }

  const selectedEventLabel = selectedEventRef
    ? selectedEventRef.kind === "goal"
      ? "Goal"
      : selectedEventRef.kind === "childGoal"
        ? "Child goal"
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

  const previewCardNode = eventPreview ? (
    <div
      ref={previewCardRef}
      className="pdp-card fixed z-40 max-h-[min(56vh,18rem)] overflow-auto p-3 text-xs shadow-xl"
      onMouseEnter={cancelPreviewClose}
      onMouseLeave={() => closeEventPreview()}
      style={{
        left: `${eventPreview.position.left}px`,
        top: `${eventPreview.position.top}px`,
        width: `${eventPreview.position.width}px`,
        maxWidth: "calc(100vw - 24px)",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--pdp-text-muted)" }}
          >
            {eventPreview.kind === "goal" ? "Goal" : eventPreview.kind === "childGoal" ? "Child goal" : "Task"}
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--pdp-text-strong)" }}>
            {eventPreview.title}
          </p>
        </div>
        {eventPreview.pinned ? (
          <button
            type="button"
            onClick={() => {
              cancelPreviewClose();
              setEventPreview(null);
            }}
            className="rounded-full border px-2 py-1 text-[11px] font-semibold transition hover:opacity-90"
            style={{
              borderColor: "var(--pdp-border)",
              color: "var(--pdp-text-muted)",
              backgroundColor: "color-mix(in srgb, var(--pdp-surface) 92%, var(--pdp-muted-surface))",
            }}
          >
            Close
          </button>
        ) : null}
      </div>

      <p className="mt-2" style={{ color: "var(--pdp-text-muted)" }}>{eventPreview.hierarchy}</p>
      <p className="mt-1" style={{ color: "var(--pdp-text-muted)" }}>{eventPreview.dateSummary}</p>
      <span className={`mt-2 inline-flex pdp-status-chip ${statusChipClass(eventPreview.status)}`}>
        {eventPreview.status.replaceAll("_", " ")}
      </span>
      <p className="mt-2 leading-5" style={{ color: "var(--pdp-text)" }}>{eventPreview.details}</p>
    </div>
  ) : null;

  return (
    <section className={`pdp-panel ${isTouchFriendly ? "pdp-touch-mode" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="pdp-section-title text-slate-900">Calendar</h2>
            <InfoPopover
              className="self-center sm:hidden"
              label="Calendar help"
            >
              Select dates to create goals/tasks, drag events to reschedule, and inspect hierarchy links directly in the calendar.
            </InfoPopover>
          </div>
          <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-slate-700 sm:block">
            Select dates to create goals/tasks, drag events to reschedule, and inspect hierarchy links directly in the calendar.
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

      <div className="mt-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Calendar filters</p>
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((current) => !current)}
                className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                aria-expanded={isFilterPanelOpen}
              >
                {isFilterPanelOpen ? "Hide filters" : "Show filters"}
              </button>
            </div>

            {isFilterPanelOpen ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={showGoals} onChange={(event) => setShowGoals(event.target.checked)} />
                    Goals
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={showGoalChildren}
                      onChange={(event) => setShowGoalChildren(event.target.checked)}
                    />
                    Goal children
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={showTasks} onChange={(event) => setShowTasks(event.target.checked)} />
                    Tasks
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      onClick={() => {
                        const nextPreference: CalendarDensityPreference = isTouchFriendly ? "compact" : "comfortable";
                        setDensityPreference(nextPreference);
                        setIsTouchFriendly(nextPreference === "comfortable");
                      }}
                      className="pdp-btn-secondary mt-1 w-full rounded-lg px-2 py-2 text-xs font-medium"
                    >
                      {isTouchFriendly ? "Comfortable taps enabled" : "Compact controls"}
                    </button>
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={resetCalendarFilters}
                    className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Reset filters
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="pdp-calendar min-w-0">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
                initialView={calendarViewPreference}
                height="auto"
                headerToolbar={calendarToolbar}
                editable
                selectable
                selectMirror
                datesSet={handleDatesSet}
                dayMaxEventRows={isMobileCalendar ? 2 : 4}
                dayMaxEvents={isMobileCalendar ? 2 : false}
                fixedWeekCount={false}
                events={events}
                select={handleDateSelect}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                eventMouseEnter={(hoverArg) => {
                  if (eventPreview?.pinned) {
                    return;
                  }

                  openEventPreview(hoverArg.event.id, hoverArg.el, false, {
                    x: hoverArg.jsEvent.clientX,
                    y: hoverArg.jsEvent.clientY,
                  });
                }}
                eventMouseLeave={() => {
                  closeEventPreview();
                }}
                eventDidMount={(mountArg) => {
                  const { event, el } = mountArg;
                  let pressTimer: number | null = null;

                  const handleTouchStart = () => {
                    pressTimer = window.setTimeout(() => {
                      openEventPreview(event.id, el, true);
                      suppressNextEventClickRef.current = {
                        id: event.id,
                        until: Date.now() + 900,
                      };
                    }, 420);
                  };

                  const clearPressTimer = () => {
                    if (pressTimer !== null) {
                      window.clearTimeout(pressTimer);
                      pressTimer = null;
                    }
                  };

                  el.addEventListener("touchstart", handleTouchStart, { passive: true });
                  el.addEventListener("touchend", clearPressTimer, { passive: true });
                  el.addEventListener("touchcancel", clearPressTimer, { passive: true });

                  (el as HTMLElement & {
                    __pdpTouchCleanup?: () => void;
                  }).__pdpTouchCleanup = () => {
                    clearPressTimer();
                    el.removeEventListener("touchstart", handleTouchStart);
                    el.removeEventListener("touchend", clearPressTimer);
                    el.removeEventListener("touchcancel", clearPressTimer);
                  };
                }}
                eventWillUnmount={(unmountArg) => {
                  const el = unmountArg.el as HTMLElement & {
                    __pdpTouchCleanup?: () => void;
                  };

                  el.__pdpTouchCleanup?.();
                  delete el.__pdpTouchCleanup;
                }}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventContent={(contentArg) => {
                  const hierarchy = String(contentArg.event.extendedProps.hierarchy ?? "");
                  const status = String(contentArg.event.extendedProps.status ?? "not_started") as ItemStatus;
                  const kind = String(contentArg.event.extendedProps.kind ?? "task") as CalendarItemKind;
                  const goalTypeLabel = String(contentArg.event.extendedProps.goalTypeLabel ?? "No goal type");
                  const kindLabel = String(contentArg.event.extendedProps.kindLabel ?? "Task");
                  const isListView = contentArg.view.type.startsWith("list");

                  if (isMobileCalendar && contentArg.view.type === "dayGridMonth") {
                    return (
                      <div className="pdp-calendar-event-dot" title={`${contentArg.event.title} - ${hierarchy}`}>
                        <span
                          className={`pdp-calendar-event-dot-marker pdp-calendar-event-dot-marker-${kind}`}
                          style={{
                            backgroundColor:
                              typeof contentArg.backgroundColor === "string" && contentArg.backgroundColor.length > 0
                                ? contentArg.backgroundColor
                                : "var(--pdp-theme-primary)",
                          }}
                        />
                        <span className="sr-only">{contentArg.event.title}</span>
                      </div>
                    );
                  }

                  if (isListView) {
                    return (
                      <div className="pdp-calendar-list-item">
                        <div className="text-sm font-semibold leading-tight text-slate-900">{contentArg.event.title}</div>
                        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          <span className="whitespace-nowrap">{goalTypeLabel}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          <span className="whitespace-nowrap">{kindLabel}</span>
                        </div>
                        <div className="mt-2">
                          <span className={`pdp-status-chip ${statusChipClass(status)}`}>
                            {status.replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>
                    );
                  }

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

          {previewCardNode && typeof document !== "undefined" ? createPortal(previewCardNode, document.body) : null}

          {isMobileCalendar ? (
            <div className="pdp-card sticky top-2 z-20 mt-3 p-3 text-xs text-slate-700 backdrop-blur">
              <p className="font-semibold uppercase tracking-wide text-slate-500">Glyph legend</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="pdp-calendar-event-dot-marker pdp-calendar-event-dot-marker-goal"
                    style={{ backgroundColor: eventColors.goalProfessionalBackground }}
                  />
                  Goal
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="pdp-calendar-event-dot-marker pdp-calendar-event-dot-marker-goal"
                    style={{ backgroundColor: eventColors.goalPersonalBackground }}
                  />
                  Goal child
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="pdp-calendar-event-dot-marker pdp-calendar-event-dot-marker-task"
                    style={{ backgroundColor: eventColors.taskBackground }}
                  />
                  Task
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 sm:grid-cols-3">
              <p><span className="font-semibold text-blue-700">G</span> Goal range events</p>
              <p><span className="font-semibold text-amber-600">GC</span> Goal child range events</p>
              <p><span className="font-semibold text-emerald-600">T</span> Task due-date markers</p>
            </div>
          )}

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

              {createType === "task" ? (
                <label className="block text-sm text-slate-700">
                  Parent child goal
                  <select
                    value={draftChildGoalId}
                    onChange={(event) => setDraftChildGoalId(event.target.value)}
                    className="pdp-control mt-1"
                  >
                    <option value="">Select child goal</option>
                    {childGoals.map((childGoal) => (
                      <option key={childGoal.id} value={childGoal.id}>
                        {childGoal.title}
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

                  {selectedEventRef.kind === "childGoal" ? (
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
                      Parent child goal
                      <select
                        value={editParentChildGoalId}
                        onChange={(event) => setEditParentChildGoalId(event.target.value)}
                        className="pdp-control mt-1"
                      >
                        <option value="">Select child goal</option>
                        {childGoals.map((childGoal) => (
                          <option key={childGoal.id} value={childGoal.id}>
                            {childGoal.title}
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

function inferGoalTimeframeLevel(startDate: string, endDate: string): GoalTimeframeLevel {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffMs = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays <= 7) {
    return "weekly";
  }

  if (diffDays <= 31) {
    return "monthly";
  }

  if (diffDays <= 120) {
    return "quarterly";
  }

  if (diffDays <= 370) {
    return "annual";
  }

  return "vision_5y";
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

  if (kind === "childGoal") {
    return "GC";
  }

  return "T";
}

function readCalendarFilterPreferences(): CalendarFilterPreferences {
  const defaults: CalendarFilterPreferences = {
    showGoals: true,
    showGoalChildren: true,
    showTasks: true,
    statusFilter: "all",
    scopeGoalType: "all",
  };

  if (typeof window === "undefined") {
    return defaults;
  }

  const stored = window.localStorage.getItem(CALENDAR_FILTER_PREFERENCES_STORAGE_KEY);
  if (!stored) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<CalendarFilterPreferences>;

    return {
      showGoals: typeof parsed.showGoals === "boolean" ? parsed.showGoals : defaults.showGoals,
      showGoalChildren:
        typeof parsed.showGoalChildren === "boolean" ? parsed.showGoalChildren : defaults.showGoalChildren,
      showTasks: typeof parsed.showTasks === "boolean" ? parsed.showTasks : defaults.showTasks,
      statusFilter:
        parsed.statusFilter === "all" || parsed.statusFilter === "not_started" || parsed.statusFilter === "in_progress" || parsed.statusFilter === "done"
          ? parsed.statusFilter
          : defaults.statusFilter,
      scopeGoalType:
        parsed.scopeGoalType === "all" || parsed.scopeGoalType === "professional" || parsed.scopeGoalType === "personal"
          ? parsed.scopeGoalType
          : defaults.scopeGoalType,
    };
  } catch {
    return defaults;
  }
}

function readCalendarDensityPreference(): CalendarDensityPreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(CALENDAR_DENSITY_PREFERENCE_STORAGE_KEY);
  if (stored === "compact" || stored === "comfortable") {
    return stored;
  }

  return null;
}

function readCalendarViewPreference(): CalendarViewPreference {
  if (typeof window === "undefined") {
    return "dayGridMonth";
  }

  const stored = window.localStorage.getItem(CALENDAR_VIEW_PREFERENCE_STORAGE_KEY);
  if (stored === "dayGridMonth" || stored === "dayGridWeek" || stored === "dayGridDay" || stored === "listWeek") {
    return stored;
  }

  return "dayGridMonth";
}

function readCalendarCreateTypePreference(): CreateType {
  if (typeof window === "undefined") {
    return "task";
  }

  const stored = window.localStorage.getItem(CALENDAR_CREATE_TYPE_STORAGE_KEY);
  if (stored === "goal" || stored === "task") {
    return stored;
  }

  return "task";
}

function readCalendarGoalTypePreference(): GoalType {
  if (typeof window === "undefined") {
    return "professional";
  }

  const stored = window.localStorage.getItem(CALENDAR_GOAL_TYPE_STORAGE_KEY);
  if (stored === "professional" || stored === "personal") {
    return stored;
  }

  return "professional";
}

function readCalendarParentChildGoalPreference(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(CALENDAR_PARENT_CHILD_GOAL_STORAGE_KEY) ?? "";
}

function readCalendarFilterPanelOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage.getItem(CALENDAR_FILTER_PANEL_OPEN_STORAGE_KEY);
  if (stored === "false") {
    return false;
  }

  return true;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  return target.isContentEditable;
}

function getCalendarEventColors() {
  if (typeof document === "undefined") {
    return {
      goalProfessionalBackground: "#2563eb",
      goalProfessionalBorder: "#1d4ed8",
      goalPersonalBackground: "#db2777",
      goalPersonalBorder: "#be185d",
      childGoalBackground: "#f59e0b",
      childGoalBorder: "#d97706",
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
    childGoalBackground: readCssColor(computed, "--pdp-event-childGoal-bg", "#f59e0b"),
    childGoalBorder: readCssColor(computed, "--pdp-event-childGoal-border", "#d97706"),
    taskBackground: readCssColor(computed, "--pdp-event-task-bg", "#059669"),
    taskBorder: readCssColor(computed, "--pdp-event-task-border", "#047857"),
  };
}

function readCssColor(computed: CSSStyleDeclaration, propertyName: string, fallback: string) {
  const value = computed.getPropertyValue(propertyName).trim();
  return value.length > 0 ? value : fallback;
}