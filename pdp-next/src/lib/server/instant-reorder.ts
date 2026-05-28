import { getTaskParentGoalId, type Goal, type GoalType, type Task } from "@/lib/domain/types";
import { validateReorderIds } from "@/lib/data/validation";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";

type ReorderGoalsPayload = {
  type?: GoalType;
  orderedGoalIds?: string[];
};

type ReorderTasksPayload = {
  parentGoalId?: string | null;
  orderedTaskIds?: string[];
};

export async function parseGoalReorderPayload(request: Request) {
  const payload = await parseJsonPayload<ReorderGoalsPayload>(request);

  if (!payload.type || !isGoalType(payload.type)) {
    throw new InstantRouteBadRequestError("Goal type is required.");
  }

  const orderedGoalIds = parseOrderedIds(payload.orderedGoalIds, "orderedGoalIds");
  return {
    type: payload.type,
    orderedGoalIds,
  };
}

export async function parseTaskReorderPayload(request: Request) {
  const payload = await parseJsonPayload<ReorderTasksPayload>(request);

  const orderedTaskIds = parseOrderedIds(payload.orderedTaskIds, "orderedTaskIds");
  return {
    parentGoalId: typeof payload.parentGoalId === "string" ? payload.parentGoalId.trim() || null : null,
    orderedTaskIds,
  };
}

export async function reorderGoals(ownerUid: string, type: GoalType, orderedGoalIds: string[]) {
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

  const activeGoals = (goals as Goal[]).filter((goal) => goal.deletedAt === null);
  validateReorderIds(activeGoals, orderedGoalIds, "goal");

  return applyReorder({
    entities: activeGoals,
    orderedIds: orderedGoalIds,
    updateMutation: (goalId, orderIndex, updatedAt) =>
      instantAdmin.tx.goals[goalId].update({
        orderIndex,
        updatedAt,
      }),
  });
}

export async function reorderTasks(ownerUid: string, parentGoalId: string | null, orderedTaskIds: string[]) {
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

  const activeTasks = (tasks as Task[])
    .map((task) => ({
      ...task,
      parentGoalId: getTaskParentGoalId(task),
    }))
    .filter((task) => task.deletedAt === null && task.parentGoalId === parentGoalId);
  validateReorderIds(activeTasks, orderedTaskIds, "task");

  return applyReorder({
    entities: activeTasks,
    orderedIds: orderedTaskIds,
    updateMutation: (taskId, orderIndex, updatedAt) =>
      instantAdmin.tx.tasks[taskId].update({
        orderIndex,
        updatedAt,
      }),
  });
}

async function parseJsonPayload<TPayload>(request: Request) {
  try {
    return (await request.json()) as TPayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }
}

function parseOrderedIds(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new InstantRouteBadRequestError(`${label} must be an array of ids.`);
  }

  if (value.some((entry) => typeof entry !== "string" || !entry)) {
    throw new InstantRouteBadRequestError(`${label} must contain only non-empty string ids.`);
  }

  return value;
}

function isGoalType(value: string): value is GoalType {
  return value === "professional" || value === "personal";
}

async function applyReorder<TEntity extends { id: string; orderIndex: number; updatedAt: string }>(input: {
  entities: TEntity[];
  orderedIds: string[];
  updateMutation: (entityId: string, orderIndex: number, updatedAt: string) => unknown;
}) {
  const instantAdmin = getInstantAdmin();
  const now = new Date().toISOString();
  const entityById = new Map(input.entities.map((entity) => [entity.id, entity]));

  const reordered = input.orderedIds.map((entityId, orderIndex) => {
    const entity = entityById.get(entityId);
    if (!entity) {
      throw new InstantRouteBadRequestError("Reorder request referenced an entity that was not loaded.");
    }

    return {
      ...entity,
      orderIndex,
      updatedAt: now,
    };
  });

  const mutations = reordered.map((entity) =>
    input.updateMutation(entity.id, entity.orderIndex, entity.updatedAt),
  ) as Parameters<typeof instantAdmin.transact>[0];

  await instantAdmin.transact(mutations);
  return reordered;
}