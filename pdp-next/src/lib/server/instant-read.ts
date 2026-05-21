import type { Goal, GoalType, Subgoal, Task } from "@/lib/domain/types";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";

export function parseIncludeDeleted(searchParams: URLSearchParams) {
  const includeDeleted = searchParams.get("includeDeleted");
  if (!includeDeleted) {
    return false;
  }

  if (includeDeleted === "true") {
    return true;
  }

  if (includeDeleted === "false") {
    return false;
  }

  throw new InstantRouteBadRequestError("includeDeleted must be 'true' or 'false' when provided.");
}

export function parseGoalType(searchParams: URLSearchParams) {
  const type = searchParams.get("type");
  if (!type) {
    return null;
  }

  if (type !== "professional" && type !== "personal") {
    throw new InstantRouteBadRequestError("Goal type must be 'professional' or 'personal' when provided.");
  }

  return type;
}

export function parseRequiredGoalId(searchParams: URLSearchParams) {
  const goalId = searchParams.get("goalId");
  if (!goalId) {
    throw new InstantRouteBadRequestError("Goal id is required.");
  }

  return goalId;
}

export function parseRequiredSubgoalId(searchParams: URLSearchParams) {
  const subgoalId = searchParams.get("subgoalId");
  if (!subgoalId) {
    throw new InstantRouteBadRequestError("Subgoal id is required.");
  }

  return subgoalId;
}

export async function listOwnedGoals(ownerUid: string, input: { includeDeleted: boolean; type: GoalType | null }) {
  const instantAdmin = getInstantAdmin();
  const { goals = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: input.type
          ? {
              ownerUid,
              type: input.type,
            }
          : {
              ownerUid,
            },
      },
    },
  });

  const filteredGoals = filterDeleted(goals as Goal[], input.includeDeleted);
  return filteredGoals.sort(compareByOrderIndexThenUpdatedAtDesc);
}

export async function listOwnedSubgoals(ownerUid: string, input: { includeDeleted: boolean; goalId: string }) {
  const instantAdmin = getInstantAdmin();
  const { subgoals = [] } = await instantAdmin.query({
    subgoals: {
      $: {
        where: {
          ownerUid,
          goalId: input.goalId,
        },
      },
    },
  });

  const filteredSubgoals = filterDeleted(subgoals as Subgoal[], input.includeDeleted);
  return filteredSubgoals.sort(compareByOrderIndexThenUpdatedAtDesc);
}

export async function listOwnedTasks(ownerUid: string, input: { includeDeleted: boolean; subgoalId: string }) {
  const instantAdmin = getInstantAdmin();
  const { tasks = [] } = await instantAdmin.query({
    tasks: {
      $: {
        where: {
          ownerUid,
          subgoalId: input.subgoalId,
        },
      },
    },
  });

  const filteredTasks = filterDeleted(tasks as Task[], input.includeDeleted);
  return filteredTasks.sort(compareByOrderIndexThenUpdatedAtDesc);
}

function filterDeleted<TEntity extends { deletedAt: string | null }>(entities: TEntity[], includeDeleted: boolean) {
  if (includeDeleted) {
    return entities;
  }

  return entities.filter((entity) => entity.deletedAt === null);
}

function compareByOrderIndexThenUpdatedAtDesc<TEntity extends { orderIndex: number; updatedAt: string }>(
  left: TEntity,
  right: TEntity,
) {
  if (left.orderIndex !== right.orderIndex) {
    return left.orderIndex - right.orderIndex;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}