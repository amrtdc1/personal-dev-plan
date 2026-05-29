import type {
  Goal,
  GoalType,
  Habit,
  HabitCheckin,
  ItemStatus,
  JournalEntry,
  PlanningCommitment,
  Task,
} from "@/lib/domain/types";
import { getTaskParentGoalId } from "@/lib/domain/types";
import {
  validateGoalWrite,
  validateJournalEntryWrite,
  validateTaskWrite,
} from "@/lib/data/validation";
import { statusToPercent } from "@/lib/domain/status";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import {
  findOwnedGoal,
  findOwnedHabit,
  findOwnedHabitCheckin,
  findOwnedJournalEntry,
  findOwnedTask,
} from "@/lib/server/instant-route";
import {
  parseGoalWritePayload,
  parseHabitCheckinWritePayload,
  parseHabitWritePayload,
  parseJournalWritePayload,
  parseTaskWritePayload,
} from "@/lib/server/instant-write-params";
import type {
  ParsedGoalWritePayload,
  ParsedHabitCheckinWritePayload,
  ParsedHabitWritePayload,
  ParsedJournalWritePayload,
  ParsedTaskWritePayload,
} from "@/lib/server/instant-write-params";

export {
  parseGoalWritePayload,
  parseHabitCheckinWritePayload,
  parseHabitWritePayload,
  parseJournalWritePayload,
  parseTaskWritePayload,
};

export async function createGoal(ownerUid: string, payload: ParsedGoalWritePayload) {
  const instantAdmin = getInstantAdmin();
  const now = new Date().toISOString();
  const nextOrderIndex = await getNextGoalOrderIndex(ownerUid, payload.type);

  if (payload.parentGoalId) {
    await findOwnedGoal(ownerUid, payload.parentGoalId);
  }

  const { trimmedTitle, trimmedDescription } = validateGoalWrite({
    ownerUid,
    type: payload.type,
    parentGoalId: payload.parentGoalId,
    timeframeLevel: payload.timeframeLevel,
    title: payload.title,
    description: payload.description,
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    timeframeLabel: payload.timeframeLabel,
    isFocus: payload.isFocus,
  });

  const goalId = crypto.randomUUID();
  const initialStatus: ItemStatus = "not_started";
  const goal: Goal = {
    id: goalId,
    ownerUid,
    type: payload.type,
    parentGoalId: payload.parentGoalId,
    timeframeLevel: payload.timeframeLevel,
    title: trimmedTitle,
    description: trimmedDescription,
    timeframe: buildGoalTimeframe(payload.timeframeLabel, payload.projectedStartDate, payload.projectedEndDate),
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    actualStartDate: null,
    actualEndDate: null,
    status: initialStatus,
    percentComplete: statusToPercent(initialStatus),
    isFocus: payload.isFocus,
    themeColor: getGoalThemeColor(payload.type),
    orderIndex: nextOrderIndex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
  };

  await instantAdmin.transact(
    instantAdmin.tx.goals[goalId].update({
      ownerUid: goal.ownerUid,
      type: goal.type,
      parentGoalId: goal.parentGoalId,
      timeframeLevel: goal.timeframeLevel,
      title: goal.title,
      description: goal.description,
      timeframe: goal.timeframe,
      projectedStartDate: goal.projectedStartDate,
      projectedEndDate: goal.projectedEndDate,
      actualStartDate: goal.actualStartDate,
      actualEndDate: goal.actualEndDate,
      status: goal.status,
      percentComplete: goal.percentComplete,
      isFocus: goal.isFocus,
      themeColor: goal.themeColor,
      orderIndex: goal.orderIndex,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      deletedAt: goal.deletedAt,
      deletedBy: goal.deletedBy,
      restoreUntil: goal.restoreUntil,
      purgeAt: goal.purgeAt,
    }),
  );

  return goal;
}

export async function updateGoal(
  ownerUid: string,
  goalId: string,
  payload: ParsedGoalWritePayload,
) {
  const instantAdmin = getInstantAdmin();
  const existingGoal = await findOwnedGoal(ownerUid, goalId);
  const now = new Date().toISOString();

  if (payload.parentGoalId) {
    await findOwnedGoal(ownerUid, payload.parentGoalId);
  }

  const { trimmedTitle, trimmedDescription } = validateGoalWrite({
    goalId,
    ownerUid,
    type: payload.type,
    parentGoalId: payload.parentGoalId,
    timeframeLevel: payload.timeframeLevel,
    title: payload.title,
    description: payload.description,
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    timeframeLabel: payload.timeframeLabel,
    isFocus: payload.isFocus,
    existingGoal,
  });

  const nextOrderIndex =
    existingGoal.type === payload.type
      ? existingGoal.orderIndex
      : await getNextGoalOrderIndex(ownerUid, payload.type);

  const goal: Goal = {
    ...existingGoal,
    type: payload.type,
    parentGoalId: payload.parentGoalId,
    timeframeLevel: payload.timeframeLevel,
    title: trimmedTitle,
    description: trimmedDescription,
    timeframe: buildGoalTimeframe(payload.timeframeLabel, payload.projectedStartDate, payload.projectedEndDate),
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    isFocus: payload.isFocus,
    themeColor: getGoalThemeColor(payload.type),
    orderIndex: nextOrderIndex,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.goals[goalId].update({
      type: goal.type,
      parentGoalId: goal.parentGoalId,
      timeframeLevel: goal.timeframeLevel,
      title: goal.title,
      description: goal.description,
      timeframe: goal.timeframe,
      projectedStartDate: goal.projectedStartDate,
      projectedEndDate: goal.projectedEndDate,
      isFocus: goal.isFocus,
      themeColor: goal.themeColor,
      orderIndex: goal.orderIndex,
      updatedAt: goal.updatedAt,
    }),
  );

  return goal;
}

export async function createTask(ownerUid: string, payload: ParsedTaskWritePayload) {
  const instantAdmin = getInstantAdmin();
  if (payload.parentGoalId) {
    await findOwnedGoal(ownerUid, payload.parentGoalId);
  }

  await assertTaskCommitmentGoalAlignment(ownerUid, payload.parentGoalId, payload.commitmentId);

  const now = new Date().toISOString();
  const nextOrderIndex = await getNextTaskOrderIndex(ownerUid, payload.parentGoalId);
  const { trimmedTitle, trimmedNotes } = validateTaskWrite({
    ownerUid,
    parentGoalId: payload.parentGoalId,
    commitmentId: payload.commitmentId,
    title: payload.title,
    notes: payload.notes,
    dueDate: payload.dueDate,
  });

  const taskId = crypto.randomUUID();
  const initialStatus: ItemStatus = "not_started";
  const task: Task = {
    id: taskId,
    ownerUid,
    parentGoalId: payload.parentGoalId,
    commitmentId: payload.commitmentId,
    title: trimmedTitle,
    notes: trimmedNotes,
    dueDate: payload.dueDate,
    unplanned: payload.unplanned,
    originalDueDate: payload.originalDueDate,
    snoozedDueDate: payload.snoozedDueDate,
    snoozeCount: payload.snoozeCount,
    status: initialStatus,
    percentComplete: statusToPercent(initialStatus),
    orderIndex: nextOrderIndex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
  };

  await instantAdmin.transact(
    instantAdmin.tx.tasks[taskId].update({
      ownerUid: task.ownerUid,
      parentGoalId: task.parentGoalId,
      commitmentId: task.commitmentId,
      title: task.title,
      notes: task.notes,
      dueDate: task.dueDate,
      unplanned: task.unplanned,
      originalDueDate: task.originalDueDate,
      snoozedDueDate: task.snoozedDueDate,
      snoozeCount: task.snoozeCount,
      status: task.status,
      percentComplete: task.percentComplete,
      orderIndex: task.orderIndex,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      deletedAt: task.deletedAt,
      deletedBy: task.deletedBy,
      restoreUntil: task.restoreUntil,
      purgeAt: task.purgeAt,
    }),
  );

  return task;
}

export async function updateTask(
  ownerUid: string,
  taskId: string,
  payload: ParsedTaskWritePayload,
) {
  const instantAdmin = getInstantAdmin();
  const existingTask = normalizeTaskParentGoal(await findOwnedTask(ownerUid, taskId));
  const parentGoalChanged = payload.parentGoalId !== existingTask.parentGoalId;
  if (parentGoalChanged && payload.parentGoalId) {
    await findOwnedGoal(ownerUid, payload.parentGoalId);
  }

  await assertTaskCommitmentGoalAlignment(ownerUid, payload.parentGoalId, payload.commitmentId);

  const now = new Date().toISOString();

  const { trimmedTitle, trimmedNotes } = validateTaskWrite({
    taskId,
    ownerUid,
    parentGoalId: payload.parentGoalId,
    commitmentId: payload.commitmentId,
    title: payload.title,
    notes: payload.notes,
    dueDate: payload.dueDate,
    existingTask,
  });

  const nextOrderIndex =
    existingTask.parentGoalId === payload.parentGoalId
      ? existingTask.orderIndex
      : await getNextTaskOrderIndex(ownerUid, payload.parentGoalId);

  const task: Task = {
    ...existingTask,
    parentGoalId: payload.parentGoalId,
    commitmentId: payload.commitmentId,
    title: trimmedTitle,
    notes: trimmedNotes,
    dueDate: payload.dueDate,
    unplanned: payload.unplanned,
    originalDueDate: payload.originalDueDate,
    snoozedDueDate: payload.snoozedDueDate,
    snoozeCount: payload.snoozeCount,
    orderIndex: nextOrderIndex,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.tasks[taskId].update({
      parentGoalId: task.parentGoalId,
      commitmentId: task.commitmentId,
      title: task.title,
      notes: task.notes,
      dueDate: task.dueDate,
      unplanned: task.unplanned,
      originalDueDate: task.originalDueDate,
      snoozedDueDate: task.snoozedDueDate,
      snoozeCount: task.snoozeCount,
      orderIndex: task.orderIndex,
      updatedAt: task.updatedAt,
    }),
  );

  return task;
}

export async function createJournalEntry(ownerUid: string, payload: ParsedJournalWritePayload) {
  const instantAdmin = getInstantAdmin();
  const now = new Date().toISOString();

  const {
    trimmedTitle,
    trimmedContent,
    normalizedMood,
    normalizedTags,
    normalizedRelatedGoalId,
  } = validateJournalEntryWrite({
    ownerUid,
    title: payload.title,
    content: payload.content,
    mood: payload.mood,
    tags: payload.tags,
    relatedGoalId: payload.relatedGoalId,
  });

  const journalEntryId = crypto.randomUUID();
  const journalEntry: JournalEntry = {
    id: journalEntryId,
    ownerUid,
    title: trimmedTitle,
    content: trimmedContent,
    mood: normalizedMood,
    tags: normalizedTags,
    relatedGoalId: normalizedRelatedGoalId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
  };

  await instantAdmin.transact(
    instantAdmin.tx.journalEntries[journalEntryId].update({
      ownerUid: journalEntry.ownerUid,
      title: journalEntry.title,
      content: journalEntry.content,
      mood: journalEntry.mood,
      tags: journalEntry.tags,
      relatedGoalId: journalEntry.relatedGoalId,
      createdAt: journalEntry.createdAt,
      updatedAt: journalEntry.updatedAt,
      deletedAt: journalEntry.deletedAt,
      deletedBy: journalEntry.deletedBy,
      restoreUntil: journalEntry.restoreUntil,
      purgeAt: journalEntry.purgeAt,
    }),
  );

  return journalEntry;
}

export async function updateJournalEntry(
  ownerUid: string,
  journalEntryId: string,
  payload: ParsedJournalWritePayload,
) {
  const instantAdmin = getInstantAdmin();
  const existingEntry = await findOwnedJournalEntry(ownerUid, journalEntryId);
  const now = new Date().toISOString();

  const {
    trimmedTitle,
    trimmedContent,
    normalizedMood,
    normalizedTags,
    normalizedRelatedGoalId,
  } = validateJournalEntryWrite({
    ownerUid,
    journalEntryId,
    title: payload.title,
    content: payload.content,
    mood: payload.mood,
    tags: payload.tags,
    relatedGoalId: payload.relatedGoalId,
    existingJournalEntry: existingEntry,
  });

  const journalEntry: JournalEntry = {
    ...existingEntry,
    title: trimmedTitle,
    content: trimmedContent,
    mood: normalizedMood,
    tags: normalizedTags,
    relatedGoalId: normalizedRelatedGoalId,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.journalEntries[journalEntryId].update({
      title: journalEntry.title,
      content: journalEntry.content,
      mood: journalEntry.mood,
      tags: journalEntry.tags,
      relatedGoalId: journalEntry.relatedGoalId,
      updatedAt: journalEntry.updatedAt,
    }),
  );

  return journalEntry;
}

export async function createHabit(ownerUid: string, payload: ParsedHabitWritePayload) {
  const instantAdmin = getInstantAdmin();
  const now = new Date().toISOString();
  const habitId = crypto.randomUUID();
  const trimmedTitle = payload.title.trim();

  if (!trimmedTitle) {
    throw new InstantRouteBadRequestError("Habit title is required.");
  }

  const habit: Habit = {
    id: habitId,
    ownerUid,
    title: trimmedTitle,
    cadence: payload.cadence,
    targetCount: payload.targetCount,
    status: payload.status,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
  };

  await instantAdmin.transact(
    instantAdmin.tx.habits[habitId].update({
      ownerUid: habit.ownerUid,
      title: habit.title,
      cadence: habit.cadence,
      targetCount: habit.targetCount,
      status: habit.status,
      createdAt: habit.createdAt,
      updatedAt: habit.updatedAt,
      deletedAt: habit.deletedAt,
      deletedBy: habit.deletedBy,
      restoreUntil: habit.restoreUntil,
      purgeAt: habit.purgeAt,
    }),
  );

  return habit;
}

export async function updateHabit(ownerUid: string, habitId: string, payload: ParsedHabitWritePayload) {
  const instantAdmin = getInstantAdmin();
  const existingHabit = await findOwnedHabit(ownerUid, habitId);
  const now = new Date().toISOString();
  const trimmedTitle = payload.title.trim();

  if (!trimmedTitle) {
    throw new InstantRouteBadRequestError("Habit title is required.");
  }

  const habit: Habit = {
    ...existingHabit,
    title: trimmedTitle,
    cadence: payload.cadence,
    targetCount: payload.targetCount,
    status: payload.status,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.habits[habitId].update({
      title: habit.title,
      cadence: habit.cadence,
      targetCount: habit.targetCount,
      status: habit.status,
      updatedAt: habit.updatedAt,
    }),
  );

  return habit;
}

export async function createHabitCheckin(
  ownerUid: string,
  habitId: string,
  payload: ParsedHabitCheckinWritePayload,
) {
  const instantAdmin = getInstantAdmin();
  await findOwnedHabit(ownerUid, habitId);
  const now = new Date().toISOString();
  const checkinId = crypto.randomUUID();

  const checkin: HabitCheckin = {
    id: checkinId,
    ownerUid,
    habitId,
    checkInDate: payload.checkInDate,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.habitCheckins[checkinId].update({
      ownerUid: checkin.ownerUid,
      habitId: checkin.habitId,
      checkInDate: checkin.checkInDate,
      notes: checkin.notes,
      createdAt: checkin.createdAt,
      updatedAt: checkin.updatedAt,
    }),
  );

  return checkin;
}

export async function updateHabitCheckin(
  ownerUid: string,
  habitId: string,
  checkinId: string,
  payload: ParsedHabitCheckinWritePayload,
) {
  const instantAdmin = getInstantAdmin();
  await findOwnedHabit(ownerUid, habitId);
  const existingCheckin = await findOwnedHabitCheckin(ownerUid, habitId, checkinId);
  const now = new Date().toISOString();

  const checkin: HabitCheckin = {
    ...existingCheckin,
    checkInDate: payload.checkInDate,
    notes: payload.notes,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.habitCheckins[checkinId].update({
      checkInDate: checkin.checkInDate,
      notes: checkin.notes,
      updatedAt: checkin.updatedAt,
    }),
  );

  return checkin;
}

export async function deleteHabitCheckin(ownerUid: string, habitId: string, checkinId: string) {
  const instantAdmin = getInstantAdmin();
  await findOwnedHabit(ownerUid, habitId);
  await findOwnedHabitCheckin(ownerUid, habitId, checkinId);

  await instantAdmin.transact(instantAdmin.tx.habitCheckins[checkinId].delete());

  return {
    deletedCheckinId: checkinId,
  };
}

async function getNextGoalOrderIndex(ownerUid: string, type: GoalType) {
  const instantAdmin = getInstantAdmin();
  const { goals = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: {
          ownerUid,
          type,
        },
      },
    },
  });

  const maxIndex = (goals as Goal[]).reduce((max, goal) => Math.max(max, goal.orderIndex), -1);
  return maxIndex + 1;
}

async function getNextTaskOrderIndex(ownerUid: string, parentGoalId: string | null) {
  const instantAdmin = getInstantAdmin();
  const { tasks = [] } = await instantAdmin.query({
    tasks: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const maxIndex = (tasks as Task[])
    .map((task) => normalizeTaskParentGoal(task))
    .filter((task) => task.parentGoalId === parentGoalId)
    .reduce((max, task) => {
      const orderIndex = Number.isFinite(task.orderIndex) ? task.orderIndex : -1;
      return Math.max(max, orderIndex);
    }, -1);
  return maxIndex + 1;
}

function normalizeTaskParentGoal(task: Task): Task {
  return {
    ...task,
    parentGoalId: getTaskParentGoalId(task),
    commitmentId: task.commitmentId ?? null,
  };
}

async function assertTaskCommitmentGoalAlignment(
  ownerUid: string,
  parentGoalId: string | null,
  commitmentId: string | null,
) {
  if (!commitmentId) {
    return;
  }

  const commitment = await findOwnedPlanningCommitment(ownerUid, commitmentId);
  if (!parentGoalId || !commitment.linkedGoalId) {
    return;
  }

  const parentGoal = await findOwnedGoal(ownerUid, parentGoalId);
  const taskRootGoalId = parentGoal.parentGoalId ?? parentGoal.id;
  if (taskRootGoalId !== commitment.linkedGoalId) {
    throw new InstantRouteBadRequestError("Task parent goal conflicts with the selected commitment goal.");
  }
}

async function findOwnedPlanningCommitment(ownerUid: string, commitmentId: string) {
  const instantAdmin = getInstantAdmin();
  const { planningCommitments = [] } = await instantAdmin.query({
    planningCommitments: {
      $: {
        where: {
          ownerUid,
          id: commitmentId,
        },
      },
    },
  });

  const commitment = planningCommitments[0] as PlanningCommitment | undefined;
  if (!commitment) {
    throw new InstantRouteBadRequestError("Task commitment was not found for this user.");
  }

  return commitment;
}

function buildGoalTimeframe(
  timeframeLabel: string | undefined,
  projectedStartDate: string | null,
  projectedEndDate: string | null,
) {
  const trimmedLabel = timeframeLabel?.trim();

  if (trimmedLabel) {
    return trimmedLabel;
  }

  if (projectedStartDate && projectedEndDate) {
    return `${projectedStartDate} -> ${projectedEndDate}`;
  }

  return "Ongoing";
}

function getGoalThemeColor(type: GoalType) {
  return type === "professional" ? "#2563eb" : "#ec4899";
}

