import type { Goal, GoalType, Habit, HabitCheckin, JournalEntry, Task } from "@/lib/domain/types";
import { getInstantAdmin } from "@/lib/instantdb/admin";
export {
  parseGoalType,
  parseIncludeDeleted,
  parseRequiredGoalId,
  parseRequiredHabitId,
} from "@/lib/server/instant-read-params";

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

export async function listOwnedTasks(ownerUid: string, input: { includeDeleted: boolean; goalId: string }) {
  const instantAdmin = getInstantAdmin();
  const { tasks = [] } = await instantAdmin.query({
    tasks: {
      $: {
        where: {
          ownerUid,
          goalId: input.goalId,
        },
      },
    },
  });

  const filteredTasks = filterDeleted((tasks as Task[]).map(normalizeTaskDefaults), input.includeDeleted);
  return filteredTasks.sort(compareByOrderIndexThenUpdatedAtDesc);
}

export async function listOwnedJournalEntries(ownerUid: string, input: { includeDeleted: boolean }) {
  const instantAdmin = getInstantAdmin();
  const { journalEntries = [] } = await instantAdmin.query({
    journalEntries: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const filteredEntries = filterDeleted(journalEntries as JournalEntry[], input.includeDeleted);
  return filteredEntries.sort(compareByUpdatedAtDesc);
}

export async function listOwnedHabits(ownerUid: string, input: { includeDeleted: boolean }) {
  const instantAdmin = getInstantAdmin();
  const { habits = [] } = await instantAdmin.query({
    habits: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const filteredHabits = filterDeleted(habits as Habit[], input.includeDeleted);
  return filteredHabits.sort(compareByUpdatedAtDesc);
}

export async function listOwnedHabitCheckins(ownerUid: string, input: { habitId: string }) {
  const instantAdmin = getInstantAdmin();
  const { habitCheckins = [] } = await instantAdmin.query({
    habitCheckins: {
      $: {
        where: {
          ownerUid,
          habitId: input.habitId,
        },
      },
    },
  });

  return (habitCheckins as HabitCheckin[]).sort((left, right) =>
    right.checkInDate.localeCompare(left.checkInDate) || right.createdAt.localeCompare(left.createdAt),
  );
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

function compareByUpdatedAtDesc<TEntity extends { updatedAt: string; createdAt: string }>(left: TEntity, right: TEntity) {
  return right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt);
}

function normalizeTaskDefaults(task: Task): Task {
  return {
    ...task,
    unplanned: task.unplanned ?? false,
    originalDueDate: task.originalDueDate ?? null,
    snoozedDueDate: task.snoozedDueDate ?? null,
    snoozeCount: task.snoozeCount ?? 0,
  };
}