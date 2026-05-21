import type { Goal, GoalType, ItemStatus, Subgoal, Task } from "@/lib/domain/types";
import {
  validateGoalWrite,
  validateSubgoalWrite,
  validateTaskWrite,
} from "@/lib/data/validation";
import { statusToPercent } from "@/lib/domain/status";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import {
  findOwnedGoal,
  findOwnedSubgoal,
  findOwnedTask,
} from "@/lib/server/instant-route";

type GoalWritePayload = {
  type?: GoalType;
  title?: string;
  description?: string;
  projectedStartDate?: string | null;
  projectedEndDate?: string | null;
  timeframeLabel?: string;
  isFocus?: boolean;
};

type SubgoalWritePayload = {
  goalId?: string;
  title?: string;
  description?: string;
  projectedStartDate?: string | null;
  projectedEndDate?: string | null;
  timeframeLabel?: string;
};

type TaskWritePayload = {
  subgoalId?: string;
  title?: string;
  notes?: string;
  dueDate?: string | null;
};

export async function parseGoalWritePayload(request: Request) {
  const payload = await parseJsonPayload<GoalWritePayload>(request);

  if (!payload.type || !isGoalType(payload.type)) {
    throw new InstantRouteBadRequestError("Goal type is required.");
  }

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Goal title is required.");
  }

  if (typeof payload.description !== "string") {
    throw new InstantRouteBadRequestError("Goal description is required.");
  }

  if (typeof payload.isFocus !== "boolean") {
    throw new InstantRouteBadRequestError("Goal focus flag is required.");
  }

  return {
    type: payload.type,
    title: payload.title,
    description: payload.description,
    projectedStartDate: parseOptionalString(payload.projectedStartDate),
    projectedEndDate: parseOptionalString(payload.projectedEndDate),
    timeframeLabel: payload.timeframeLabel,
    isFocus: payload.isFocus,
  };
}

export async function parseSubgoalWritePayload(request: Request) {
  const payload = await parseJsonPayload<SubgoalWritePayload>(request);

  if (!payload.goalId) {
    throw new InstantRouteBadRequestError("Goal id is required.");
  }

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Subgoal title is required.");
  }

  if (typeof payload.description !== "string") {
    throw new InstantRouteBadRequestError("Subgoal description is required.");
  }

  return {
    goalId: payload.goalId,
    title: payload.title,
    description: payload.description,
    projectedStartDate: parseOptionalString(payload.projectedStartDate),
    projectedEndDate: parseOptionalString(payload.projectedEndDate),
    timeframeLabel: payload.timeframeLabel,
  };
}

export async function parseTaskWritePayload(request: Request) {
  const payload = await parseJsonPayload<TaskWritePayload>(request);

  if (!payload.subgoalId) {
    throw new InstantRouteBadRequestError("Subgoal id is required.");
  }

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Task title is required.");
  }

  if (typeof payload.notes !== "string") {
    throw new InstantRouteBadRequestError("Task notes are required.");
  }

  return {
    subgoalId: payload.subgoalId,
    title: payload.title,
    notes: payload.notes,
    dueDate: parseOptionalString(payload.dueDate),
  };
}

export async function createGoal(ownerUid: string, payload: Awaited<ReturnType<typeof parseGoalWritePayload>>) {
  const instantAdmin = getInstantAdmin();
  const now = new Date().toISOString();
  const nextOrderIndex = await getNextGoalOrderIndex(ownerUid, payload.type);

  const { trimmedTitle, trimmedDescription } = validateGoalWrite({
    ownerUid,
    type: payload.type,
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
  payload: Awaited<ReturnType<typeof parseGoalWritePayload>>,
) {
  const instantAdmin = getInstantAdmin();
  const existingGoal = await findOwnedGoal(ownerUid, goalId);
  const now = new Date().toISOString();

  const { trimmedTitle, trimmedDescription } = validateGoalWrite({
    goalId,
    ownerUid,
    type: payload.type,
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

export async function createSubgoal(
  ownerUid: string,
  payload: Awaited<ReturnType<typeof parseSubgoalWritePayload>>,
) {
  const instantAdmin = getInstantAdmin();
  await findOwnedGoal(ownerUid, payload.goalId);

  const now = new Date().toISOString();
  const nextOrderIndex = await getNextSubgoalOrderIndex(ownerUid, payload.goalId);
  const { trimmedTitle, trimmedDescription } = validateSubgoalWrite({
    ownerUid,
    goalId: payload.goalId,
    title: payload.title,
    description: payload.description,
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    timeframeLabel: payload.timeframeLabel,
  });

  const subgoalId = crypto.randomUUID();
  const initialStatus: ItemStatus = "not_started";
  const subgoal: Subgoal = {
    id: subgoalId,
    ownerUid,
    goalId: payload.goalId,
    title: trimmedTitle,
    description: trimmedDescription,
    timeframe: buildGoalTimeframe(payload.timeframeLabel, payload.projectedStartDate, payload.projectedEndDate),
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    actualStartDate: null,
    actualEndDate: null,
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
    instantAdmin.tx.subgoals[subgoalId].update({
      ownerUid: subgoal.ownerUid,
      goalId: subgoal.goalId,
      title: subgoal.title,
      description: subgoal.description,
      timeframe: subgoal.timeframe,
      projectedStartDate: subgoal.projectedStartDate,
      projectedEndDate: subgoal.projectedEndDate,
      actualStartDate: subgoal.actualStartDate,
      actualEndDate: subgoal.actualEndDate,
      status: subgoal.status,
      percentComplete: subgoal.percentComplete,
      orderIndex: subgoal.orderIndex,
      createdAt: subgoal.createdAt,
      updatedAt: subgoal.updatedAt,
      deletedAt: subgoal.deletedAt,
      deletedBy: subgoal.deletedBy,
      restoreUntil: subgoal.restoreUntil,
      purgeAt: subgoal.purgeAt,
    }),
  );

  return subgoal;
}

export async function updateSubgoal(
  ownerUid: string,
  subgoalId: string,
  payload: Awaited<ReturnType<typeof parseSubgoalWritePayload>>,
) {
  const instantAdmin = getInstantAdmin();
  const existingSubgoal = await findOwnedSubgoal(ownerUid, subgoalId);
  await findOwnedGoal(ownerUid, payload.goalId);
  const now = new Date().toISOString();

  const { trimmedTitle, trimmedDescription } = validateSubgoalWrite({
    subgoalId,
    ownerUid,
    goalId: payload.goalId,
    title: payload.title,
    description: payload.description,
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    timeframeLabel: payload.timeframeLabel,
    existingSubgoal,
  });

  const nextOrderIndex =
    existingSubgoal.goalId === payload.goalId
      ? existingSubgoal.orderIndex
      : await getNextSubgoalOrderIndex(ownerUid, payload.goalId);

  const subgoal: Subgoal = {
    ...existingSubgoal,
    goalId: payload.goalId,
    title: trimmedTitle,
    description: trimmedDescription,
    timeframe: buildGoalTimeframe(payload.timeframeLabel, payload.projectedStartDate, payload.projectedEndDate),
    projectedStartDate: payload.projectedStartDate,
    projectedEndDate: payload.projectedEndDate,
    orderIndex: nextOrderIndex,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.subgoals[subgoalId].update({
      goalId: subgoal.goalId,
      title: subgoal.title,
      description: subgoal.description,
      timeframe: subgoal.timeframe,
      projectedStartDate: subgoal.projectedStartDate,
      projectedEndDate: subgoal.projectedEndDate,
      orderIndex: subgoal.orderIndex,
      updatedAt: subgoal.updatedAt,
    }),
  );

  return subgoal;
}

export async function createTask(ownerUid: string, payload: Awaited<ReturnType<typeof parseTaskWritePayload>>) {
  const instantAdmin = getInstantAdmin();
  await findOwnedSubgoal(ownerUid, payload.subgoalId);

  const now = new Date().toISOString();
  const nextOrderIndex = await getNextTaskOrderIndex(ownerUid, payload.subgoalId);
  const { trimmedTitle, trimmedNotes } = validateTaskWrite({
    ownerUid,
    subgoalId: payload.subgoalId,
    title: payload.title,
    notes: payload.notes,
    dueDate: payload.dueDate,
  });

  const taskId = crypto.randomUUID();
  const initialStatus: ItemStatus = "not_started";
  const task: Task = {
    id: taskId,
    ownerUid,
    subgoalId: payload.subgoalId,
    title: trimmedTitle,
    notes: trimmedNotes,
    dueDate: payload.dueDate,
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
      subgoalId: task.subgoalId,
      title: task.title,
      notes: task.notes,
      dueDate: task.dueDate,
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
  payload: Awaited<ReturnType<typeof parseTaskWritePayload>>,
) {
  const instantAdmin = getInstantAdmin();
  const existingTask = await findOwnedTask(ownerUid, taskId);
  await findOwnedSubgoal(ownerUid, payload.subgoalId);
  const now = new Date().toISOString();

  const { trimmedTitle, trimmedNotes } = validateTaskWrite({
    taskId,
    ownerUid,
    subgoalId: payload.subgoalId,
    title: payload.title,
    notes: payload.notes,
    dueDate: payload.dueDate,
    existingTask,
  });

  const nextOrderIndex =
    existingTask.subgoalId === payload.subgoalId
      ? existingTask.orderIndex
      : await getNextTaskOrderIndex(ownerUid, payload.subgoalId);

  const task: Task = {
    ...existingTask,
    subgoalId: payload.subgoalId,
    title: trimmedTitle,
    notes: trimmedNotes,
    dueDate: payload.dueDate,
    orderIndex: nextOrderIndex,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.tasks[taskId].update({
      subgoalId: task.subgoalId,
      title: task.title,
      notes: task.notes,
      dueDate: task.dueDate,
      orderIndex: task.orderIndex,
      updatedAt: task.updatedAt,
    }),
  );

  return task;
}

async function parseJsonPayload<TPayload>(request: Request) {
  try {
    return (await request.json()) as TPayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }
}

function parseOptionalString(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new InstantRouteBadRequestError("Optional date fields must be strings when provided.");
  }

  return value;
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

async function getNextSubgoalOrderIndex(ownerUid: string, goalId: string) {
  const instantAdmin = getInstantAdmin();
  const { subgoals = [] } = await instantAdmin.query({
    subgoals: {
      $: {
        where: {
          ownerUid,
          goalId,
        },
      },
    },
  });

  const maxIndex = (subgoals as Subgoal[]).reduce((max, subgoal) => Math.max(max, subgoal.orderIndex), -1);
  return maxIndex + 1;
}

async function getNextTaskOrderIndex(ownerUid: string, subgoalId: string) {
  const instantAdmin = getInstantAdmin();
  const { tasks = [] } = await instantAdmin.query({
    tasks: {
      $: {
        where: {
          ownerUid,
          subgoalId,
        },
      },
    },
  });

  const maxIndex = (tasks as Task[]).reduce((max, task) => Math.max(max, task.orderIndex), -1);
  return maxIndex + 1;
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

function isGoalType(value: string): value is GoalType {
  return value === "professional" || value === "personal";
}