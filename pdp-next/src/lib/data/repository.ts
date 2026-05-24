import { id, type InstaQLParams } from "@instantdb/react";
import { db, isInstantConfigured } from "@/lib/instantdb/client";
import { env } from "@/lib/config/env";
import { statusToPercent } from "@/lib/domain/status";
import type { Goal, GoalType, ItemStatus, JournalEntry, Subgoal, Task, UserProfile } from "@/lib/domain/types";
import type { AppSchema } from "@/lib/instantdb/schema";
import {
  enqueueOfflineMutation,
  flushOfflineMutationQueue,
  getOfflineMutationCount as getOfflineMutationCountFromQueue,
  subscribeOfflineMutationCount as subscribeOfflineMutationCountFromQueue,
  type OfflineMutation,
  type OfflineFlushResult,
} from "@/lib/offline/write-queue";
import { setOfflineSyncFailureState } from "@/lib/offline/sync-status";
import { logSyncReplayFailure } from "@/lib/observability/telemetry";
import {
  assertOwnedGoal,
  assertOwnedJournalEntry,
  assertOwnedSubgoal,
  assertOwnedTask,
  validateGoalWrite,
  validateJournalEntryWrite,
  validateReorderIds,
  validateStatusUpdate,
  validateSubgoalWrite,
  validateTaskWrite,
} from "@/lib/data/validation";

type ListOptions = {
  includeDeleted?: boolean;
};

type TransactionMutation =
  | ReturnType<(typeof db.tx.goals)[string]["update"]>
  | ReturnType<(typeof db.tx.goals)[string]["delete"]>
  | ReturnType<(typeof db.tx.subgoals)[string]["update"]>
  | ReturnType<(typeof db.tx.subgoals)[string]["delete"]>
  | ReturnType<(typeof db.tx.tasks)[string]["update"]>
  | ReturnType<(typeof db.tx.tasks)[string]["delete"]>
  | ReturnType<(typeof db.tx.journalEntries)[string]["update"]>
  | ReturnType<(typeof db.tx.journalEntries)[string]["delete"]>;

export type SaveGoalInput = {
  goalId?: string;
  ownerUid: string;
  type: GoalType;
  title: string;
  description: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  timeframeLabel?: string;
  isFocus: boolean;
  existingGoal?: Goal;
};

export type SaveSubgoalInput = {
  subgoalId?: string;
  ownerUid: string;
  goalId: string;
  title: string;
  description: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  timeframeLabel?: string;
  existingSubgoal?: Subgoal;
};

export type SaveTaskInput = {
  taskId?: string;
  ownerUid: string;
  subgoalId: string;
  title: string;
  notes: string;
  dueDate: string | null;
  existingTask?: Task;
};

export type SaveJournalEntryInput = {
  journalEntryId?: string;
  ownerUid: string;
  title: string;
  content: string;
  mood: string | null;
  tags: string[];
  relatedGoalId: string | null;
  existingJournalEntry?: JournalEntry;
};

type GoalStatusUpdateInput = {
  ownerUid: string;
  goalId: string;
  status: ItemStatus;
};

type SubgoalStatusUpdateInput = {
  ownerUid: string;
  subgoalId: string;
  status: ItemStatus;
};

type TaskStatusUpdateInput = {
  ownerUid: string;
  taskId: string;
  status: ItemStatus;
};

type GoalReorderInput = {
  ownerUid: string;
  type: GoalType;
  orderedGoalIds: string[];
};

type SubgoalReorderInput = {
  ownerUid: string;
  goalId: string;
  orderedSubgoalIds: string[];
};

type TaskReorderInput = {
  ownerUid: string;
  subgoalId: string;
  orderedTaskIds: string[];
};

type GoalArchiveInput = {
  ownerUid: string;
  goalId: string;
};

type SubgoalArchiveInput = {
  ownerUid: string;
  subgoalId: string;
};

type TaskArchiveInput = {
  ownerUid: string;
  taskId: string;
};

type JournalArchiveInput = {
  ownerUid: string;
  journalEntryId: string;
};

export type DataRepository = {
  listGoals: (ownerUid: string, type: GoalType, options?: ListOptions) => Promise<Goal[]>;
  saveGoal: (input: SaveGoalInput) => Promise<Goal>;
  updateGoalStatus: (ownerUid: string, goalId: string, status: ItemStatus) => Promise<Goal>;
  reorderGoals: (ownerUid: string, type: GoalType, orderedGoalIds: string[]) => Promise<Goal[]>;
  softDeleteGoal: (ownerUid: string, goalId: string) => Promise<Goal>;
  restoreGoal: (ownerUid: string, goalId: string) => Promise<Goal>;
  listSubgoals: (ownerUid: string, goalId: string, options?: ListOptions) => Promise<Subgoal[]>;
  saveSubgoal: (input: SaveSubgoalInput) => Promise<Subgoal>;
  updateSubgoalStatus: (ownerUid: string, subgoalId: string, status: ItemStatus) => Promise<Subgoal>;
  reorderSubgoals: (ownerUid: string, goalId: string, orderedSubgoalIds: string[]) => Promise<Subgoal[]>;
  softDeleteSubgoal: (ownerUid: string, subgoalId: string) => Promise<Subgoal>;
  restoreSubgoal: (ownerUid: string, subgoalId: string) => Promise<Subgoal>;
  listTasks: (ownerUid: string, subgoalId: string, options?: ListOptions) => Promise<Task[]>;
  saveTask: (input: SaveTaskInput) => Promise<Task>;
  updateTaskStatus: (ownerUid: string, taskId: string, status: ItemStatus) => Promise<Task>;
  reorderTasks: (ownerUid: string, subgoalId: string, orderedTaskIds: string[]) => Promise<Task[]>;
  softDeleteTask: (ownerUid: string, taskId: string) => Promise<Task>;
  restoreTask: (ownerUid: string, taskId: string) => Promise<Task>;
  purgeExpiredDeletedEntities: (ownerUid: string) => Promise<{
    goals: number;
    subgoals: number;
    tasks: number;
    purgedAt: string;
  }>;
  listJournalEntries: (ownerUid: string, options?: ListOptions) => Promise<JournalEntry[]>;
  saveJournalEntry: (input: SaveJournalEntryInput) => Promise<JournalEntry>;
  softDeleteJournalEntry: (ownerUid: string, journalEntryId: string) => Promise<JournalEntry>;
  restoreJournalEntry: (ownerUid: string, journalEntryId: string) => Promise<JournalEntry>;
  getOfflineMutationCount: () => number;
  subscribeOfflineMutationCount: (listener: (count: number) => void) => () => void;
  flushOfflineMutations: () => Promise<OfflineFlushResult>;
  getUserProfile: (ownerUid: string) => Promise<UserProfile | null>;
};

let isFlushingOfflineMutations = false;

export class UnsupportedRepositoryError extends Error {
  constructor(message = "Data repository has not been wired yet.") {
    super(message);
    this.name = "UnsupportedRepositoryError";
  }
}

export const dataRepository: DataRepository = {
  async listGoals(ownerUid, type, options) {
    if (canUseProtectedApiRoutes()) {
      const searchParams = new URLSearchParams({
        includeDeleted: String(Boolean(options?.includeDeleted)),
        type,
      });
      const response = await invokeProtectedRead<{ goals?: Goal[] }>(`/api/goals?${searchParams.toString()}`);
      return filterDeleted(response.goals ?? [], options).sort(compareGoals);
    }

    const data = await runClientQuery<{ goals?: Goal[] }>({
      goals: {
        $: {
          where: {
            ownerUid,
            type,
          },
        },
      },
    });

    return filterDeleted(data.goals ?? [], options).sort(compareGoals);
  },
  async saveGoal(input) {
    ensureClientMutationSupport();

    const now = new Date().toISOString();
    const { trimmedTitle, trimmedDescription } = validateGoalWrite(input);

    const nextOrderIndex = input.existingGoal
      ? input.existingGoal.type === input.type
        ? input.existingGoal.orderIndex
        : await getNextGoalOrderIndex(input.ownerUid, input.type)
      : await getNextGoalOrderIndex(input.ownerUid, input.type);

    const goalId = input.existingGoal?.id ?? input.goalId ?? id();
    const goal: Goal = {
      id: goalId,
      ownerUid: input.ownerUid,
      type: input.type,
      title: trimmedTitle,
      description: trimmedDescription,
      timeframe: buildGoalTimeframe(
        input.timeframeLabel,
        input.projectedStartDate,
        input.projectedEndDate,
      ),
      projectedStartDate: input.projectedStartDate,
      projectedEndDate: input.projectedEndDate,
      actualStartDate: input.existingGoal?.actualStartDate ?? null,
      actualEndDate: input.existingGoal?.actualEndDate ?? null,
      status: input.existingGoal?.status ?? "not_started",
      percentComplete:
        input.existingGoal?.percentComplete ?? statusToPercent(input.existingGoal?.status ?? "not_started"),
      isFocus: input.isFocus,
      themeColor: getGoalThemeColor(input.type),
      orderIndex: nextOrderIndex,
      createdAt: input.existingGoal?.createdAt ?? now,
      updatedAt: now,
      deletedAt: input.existingGoal?.deletedAt ?? null,
      deletedBy: input.existingGoal?.deletedBy ?? null,
      restoreUntil: input.existingGoal?.restoreUntil ?? null,
      purgeAt: input.existingGoal?.purgeAt ?? null,
    };

    await commitOrQueueMutation(
      "saveGoal",
      input,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await saveGoalViaApi(goal, Boolean(input.existingGoal));
          return;
        }

        await runClientMutationWithServerFallback(
          async () => {
            await db.transact(
              db.tx.goals[goalId].update({
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
          },
          async () => {
            await saveGoalViaApi(goal, Boolean(input.existingGoal));
          },
        );
      },
    );

    return goal;
  },
  async updateGoalStatus(ownerUid, goalId, status) {
    ensureClientMutationSupport();

    validateStatusUpdate(status);

    const goal = assertOwnedGoal(await findGoalById(ownerUid, goalId), ownerUid);

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(status);

    await commitOrQueueMutation(
      "updateGoalStatus",
      { ownerUid, goalId, status } as GoalStatusUpdateInput,
      async () => {
        await db.transact(
          db.tx.goals[goalId].update({
            status,
            percentComplete,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...goal,
      status,
      percentComplete,
      updatedAt: now,
    };
  },
  async reorderGoals(ownerUid, type, orderedGoalIds) {
    ensureClientMutationSupport();

    const goals = await dataRepository.listGoals(ownerUid, type);
    validateReorderIds(goals, orderedGoalIds, "goal");

    const reordered = buildReorderedEntities({
      entities: goals,
      orderedIds: orderedGoalIds,
      updateMutation: (goalId, orderIndex, updatedAt) =>
        db.tx.goals[goalId].update({
          orderIndex,
          updatedAt,
        }),
    });

    await commitOrQueueMutation(
      "reorderGoals",
      { ownerUid, type, orderedGoalIds } as GoalReorderInput,
      async () => {
        await db.transact(reordered.mutations);
      },
    );

    return reordered.entities;
  },
  async softDeleteGoal(ownerUid, goalId) {
    ensureClientMutationSupport();

    const goal = assertOwnedGoal(await findGoalById(ownerUid, goalId), ownerUid);

    if (goal.deletedAt) {
      return goal;
    }

    const now = new Date().toISOString();
    const lifecycle = buildSoftDeleteLifecycle(now);
    const subgoals = await dataRepository.listSubgoals(ownerUid, goalId, { includeDeleted: true });
    const taskGroups = await Promise.all(
      subgoals.map((subgoal) => dataRepository.listTasks(ownerUid, subgoal.id, { includeDeleted: true })),
    );
    const tasks = taskGroups.flat();

    const goalMutation = db.tx.goals[goalId].update({
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
      isFocus: false,
    });

    const subgoalMutations = subgoals
      .filter((subgoal) => !subgoal.deletedAt)
      .map((subgoal) =>
        db.tx.subgoals[subgoal.id].update({
          deletedAt: now,
          deletedBy: ownerUid,
          restoreUntil: lifecycle.restoreUntil,
          purgeAt: lifecycle.purgeAt,
          updatedAt: now,
        }),
      );

    const taskMutations = tasks
      .filter((task) => !task.deletedAt)
      .map((task) =>
        db.tx.tasks[task.id].update({
          deletedAt: now,
          deletedBy: ownerUid,
          restoreUntil: lifecycle.restoreUntil,
          purgeAt: lifecycle.purgeAt,
          updatedAt: now,
        }),
      );

    await commitOrQueueMutation(
      "softDeleteGoal",
      { ownerUid, goalId } as GoalArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await archiveGoalViaApi(goalId);
          return;
        }

        await db.transact([goalMutation, ...subgoalMutations, ...taskMutations]);
      },
    );

    return {
      ...goal,
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
      isFocus: false,
    };
  },
  async restoreGoal(ownerUid, goalId) {
    ensureClientMutationSupport();

    const goal = assertOwnedGoal(await findGoalById(ownerUid, goalId), ownerUid);

    if (!goal.deletedAt) {
      return goal;
    }

    assertRestoreWindowOpen(goal.restoreUntil, "Goal");

    const now = new Date().toISOString();
    const cascadeDeletedAt = goal.deletedAt;
    const subgoals = await dataRepository.listSubgoals(ownerUid, goalId, { includeDeleted: true });
    const subgoalsToRestore = subgoals.filter((subgoal) =>
      shouldRestoreCascadeEntity(subgoal.deletedAt, cascadeDeletedAt),
    );
    const taskGroups = await Promise.all(
      subgoalsToRestore.map((subgoal) =>
        dataRepository.listTasks(ownerUid, subgoal.id, { includeDeleted: true }),
      ),
    );
    const tasks = taskGroups.flat();

    const goalMutation = db.tx.goals[goalId].update({
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    });

    const subgoalMutations = subgoalsToRestore.map((subgoal) =>
        db.tx.subgoals[subgoal.id].update({
          deletedAt: null,
          deletedBy: null,
          restoreUntil: null,
          purgeAt: null,
          updatedAt: now,
        }),
      );

    const taskMutations = tasks
      .filter((task) => shouldRestoreCascadeEntity(task.deletedAt, cascadeDeletedAt))
      .map((task) =>
        db.tx.tasks[task.id].update({
          deletedAt: null,
          deletedBy: null,
          restoreUntil: null,
          purgeAt: null,
          updatedAt: now,
        }),
      );

    await commitOrQueueMutation(
      "restoreGoal",
      { ownerUid, goalId } as GoalArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await restoreGoalViaApi(goalId);
          return;
        }

        await db.transact([goalMutation, ...subgoalMutations, ...taskMutations]);
      },
    );

    return {
      ...goal,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    };
  },
  async listSubgoals(ownerUid, goalId, options) {
    if (canUseProtectedApiRoutes()) {
      const searchParams = new URLSearchParams({
        includeDeleted: String(Boolean(options?.includeDeleted)),
        goalId,
      });
      const response = await invokeProtectedRead<{ subgoals?: Subgoal[] }>(`/api/subgoals?${searchParams.toString()}`);
      return filterDeleted(response.subgoals ?? [], options).sort(compareSubgoals);
    }

    const data = await runClientQuery<{ subgoals?: Subgoal[] }>({
      subgoals: {
        $: {
          where: {
            ownerUid,
            goalId,
          },
        },
      },
    });

    return filterDeleted(data.subgoals ?? [], options).sort(compareSubgoals);
  },
  async saveSubgoal(input) {
    ensureClientMutationSupport();

    const now = new Date().toISOString();
    const { trimmedTitle, trimmedDescription } = validateSubgoalWrite(input);

    const nextOrderIndex = input.existingSubgoal
      ? input.existingSubgoal.goalId === input.goalId
        ? input.existingSubgoal.orderIndex
        : await getNextSubgoalOrderIndex(input.ownerUid, input.goalId)
      : await getNextSubgoalOrderIndex(input.ownerUid, input.goalId);

    const subgoalId = input.existingSubgoal?.id ?? input.subgoalId ?? id();
    const subgoal: Subgoal = {
      id: subgoalId,
      ownerUid: input.ownerUid,
      goalId: input.goalId,
      title: trimmedTitle,
      description: trimmedDescription,
      timeframe: buildGoalTimeframe(
        input.timeframeLabel,
        input.projectedStartDate,
        input.projectedEndDate,
      ),
      projectedStartDate: input.projectedStartDate,
      projectedEndDate: input.projectedEndDate,
      actualStartDate: input.existingSubgoal?.actualStartDate ?? null,
      actualEndDate: input.existingSubgoal?.actualEndDate ?? null,
      status: input.existingSubgoal?.status ?? "not_started",
      percentComplete:
        input.existingSubgoal?.percentComplete ??
        statusToPercent(input.existingSubgoal?.status ?? "not_started"),
      orderIndex: nextOrderIndex,
      createdAt: input.existingSubgoal?.createdAt ?? now,
      updatedAt: now,
      deletedAt: input.existingSubgoal?.deletedAt ?? null,
      deletedBy: input.existingSubgoal?.deletedBy ?? null,
      restoreUntil: input.existingSubgoal?.restoreUntil ?? null,
      purgeAt: input.existingSubgoal?.purgeAt ?? null,
    };

    await commitOrQueueMutation(
      "saveSubgoal",
      input,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await saveSubgoalViaApi(subgoal, Boolean(input.existingSubgoal));
          return;
        }

        await runClientMutationWithServerFallback(
          async () => {
            await db.transact(
              db.tx.subgoals[subgoalId].update({
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
          },
          async () => {
            await saveSubgoalViaApi(subgoal, Boolean(input.existingSubgoal));
          },
        );
      },
    );

    return subgoal;
  },
  async updateSubgoalStatus(ownerUid, subgoalId, status) {
    ensureClientMutationSupport();

    validateStatusUpdate(status);

    const subgoal = assertOwnedSubgoal(await findSubgoalById(ownerUid, subgoalId), ownerUid);

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(status);

    await commitOrQueueMutation(
      "updateSubgoalStatus",
      { ownerUid, subgoalId, status } as SubgoalStatusUpdateInput,
      async () => {
        await db.transact(
          db.tx.subgoals[subgoalId].update({
            status,
            percentComplete,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...subgoal,
      status,
      percentComplete,
      updatedAt: now,
    };
  },
  async reorderSubgoals(ownerUid, goalId, orderedSubgoalIds) {
    ensureClientMutationSupport();

    const subgoals = await dataRepository.listSubgoals(ownerUid, goalId);
    validateReorderIds(subgoals, orderedSubgoalIds, "subgoal");

    const reordered = buildReorderedEntities({
      entities: subgoals,
      orderedIds: orderedSubgoalIds,
      updateMutation: (subgoalId, orderIndex, updatedAt) =>
        db.tx.subgoals[subgoalId].update({
          orderIndex,
          updatedAt,
        }),
    });

    await commitOrQueueMutation(
      "reorderSubgoals",
      { ownerUid, goalId, orderedSubgoalIds } as SubgoalReorderInput,
      async () => {
        await db.transact(reordered.mutations);
      },
    );

    return reordered.entities;
  },
  async softDeleteSubgoal(ownerUid, subgoalId) {
    ensureClientMutationSupport();

    const subgoal = assertOwnedSubgoal(await findSubgoalById(ownerUid, subgoalId), ownerUid);

    if (subgoal.deletedAt) {
      return subgoal;
    }

    const now = new Date().toISOString();
    const lifecycle = buildSoftDeleteLifecycle(now);
    const tasks = await dataRepository.listTasks(ownerUid, subgoalId, { includeDeleted: true });

    const subgoalMutation = db.tx.subgoals[subgoalId].update({
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
    });

    const taskMutations = tasks
      .filter((task) => !task.deletedAt)
      .map((task) =>
        db.tx.tasks[task.id].update({
          deletedAt: now,
          deletedBy: ownerUid,
          restoreUntil: lifecycle.restoreUntil,
          purgeAt: lifecycle.purgeAt,
          updatedAt: now,
        }),
      );

    await commitOrQueueMutation(
      "softDeleteSubgoal",
      { ownerUid, subgoalId } as SubgoalArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await archiveSubgoalViaApi(subgoalId);
          return;
        }

        await db.transact([subgoalMutation, ...taskMutations]);
      },
    );

    return {
      ...subgoal,
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
    };
  },
  async restoreSubgoal(ownerUid, subgoalId) {
    ensureClientMutationSupport();

    const subgoal = assertOwnedSubgoal(await findSubgoalById(ownerUid, subgoalId), ownerUid);

    if (!subgoal.deletedAt) {
      return subgoal;
    }

    assertRestoreWindowOpen(subgoal.restoreUntil, "Subgoal");

    const now = new Date().toISOString();
    const cascadeDeletedAt = subgoal.deletedAt;
    const tasks = await dataRepository.listTasks(ownerUid, subgoalId, { includeDeleted: true });

    const subgoalMutation = db.tx.subgoals[subgoalId].update({
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    });

    const taskMutations = tasks
      .filter((task) => shouldRestoreCascadeEntity(task.deletedAt, cascadeDeletedAt))
      .map((task) =>
        db.tx.tasks[task.id].update({
          deletedAt: null,
          deletedBy: null,
          restoreUntil: null,
          purgeAt: null,
          updatedAt: now,
        }),
      );

    await commitOrQueueMutation(
      "restoreSubgoal",
      { ownerUid, subgoalId } as SubgoalArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await restoreSubgoalViaApi(subgoalId);
          return;
        }

        await db.transact([subgoalMutation, ...taskMutations]);
      },
    );

    return {
      ...subgoal,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    };
  },
  async listTasks(ownerUid, subgoalId, options) {
    if (canUseProtectedApiRoutes()) {
      const searchParams = new URLSearchParams({
        includeDeleted: String(Boolean(options?.includeDeleted)),
        subgoalId,
      });
      const response = await invokeProtectedRead<{ tasks?: Task[] }>(`/api/tasks?${searchParams.toString()}`);
      return filterDeleted(response.tasks ?? [], options).sort(compareTasks);
    }

    const data = await runClientQuery<{ tasks?: Task[] }>({
      tasks: {
        $: {
          where: {
            ownerUid,
            subgoalId,
          },
        },
      },
    });

    return filterDeleted(data.tasks ?? [], options).sort(compareTasks);
  },
  async saveTask(input) {
    ensureClientMutationSupport();

    const now = new Date().toISOString();
    const { trimmedTitle, trimmedNotes } = validateTaskWrite(input);

    const nextOrderIndex = input.existingTask
      ? input.existingTask.subgoalId === input.subgoalId
        ? input.existingTask.orderIndex
        : await getNextTaskOrderIndex(input.ownerUid, input.subgoalId)
      : await getNextTaskOrderIndex(input.ownerUid, input.subgoalId);

    const taskId = input.existingTask?.id ?? input.taskId ?? id();
    const task: Task = {
      id: taskId,
      ownerUid: input.ownerUid,
      subgoalId: input.subgoalId,
      title: trimmedTitle,
      notes: trimmedNotes,
      dueDate: input.dueDate,
      status: input.existingTask?.status ?? "not_started",
      percentComplete:
        input.existingTask?.percentComplete ??
        statusToPercent(input.existingTask?.status ?? "not_started"),
      orderIndex: nextOrderIndex,
      createdAt: input.existingTask?.createdAt ?? now,
      updatedAt: now,
      deletedAt: input.existingTask?.deletedAt ?? null,
      deletedBy: input.existingTask?.deletedBy ?? null,
      restoreUntil: input.existingTask?.restoreUntil ?? null,
      purgeAt: input.existingTask?.purgeAt ?? null,
    };

    await commitOrQueueMutation(
      "saveTask",
      input,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await saveTaskViaApi(task, Boolean(input.existingTask));
          return;
        }

        await runClientMutationWithServerFallback(
          async () => {
            await db.transact(
              db.tx.tasks[taskId].update({
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
          },
          async () => {
            await saveTaskViaApi(task, Boolean(input.existingTask));
          },
        );
      },
    );

    return task;
  },
  async updateTaskStatus(ownerUid, taskId, status) {
    ensureClientMutationSupport();

    validateStatusUpdate(status);

    const task = assertOwnedTask(await findTaskById(ownerUid, taskId), ownerUid);

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(status);

    await commitOrQueueMutation(
      "updateTaskStatus",
      { ownerUid, taskId, status } as TaskStatusUpdateInput,
      async () => {
        await db.transact(
          db.tx.tasks[taskId].update({
            status,
            percentComplete,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...task,
      status,
      percentComplete,
      updatedAt: now,
    };
  },
  async reorderTasks(ownerUid, subgoalId, orderedTaskIds) {
    ensureClientMutationSupport();

    const tasks = await dataRepository.listTasks(ownerUid, subgoalId);
    validateReorderIds(tasks, orderedTaskIds, "task");

    const reordered = buildReorderedEntities({
      entities: tasks,
      orderedIds: orderedTaskIds,
      updateMutation: (taskId, orderIndex, updatedAt) =>
        db.tx.tasks[taskId].update({
          orderIndex,
          updatedAt,
        }),
    });

    await commitOrQueueMutation(
      "reorderTasks",
      { ownerUid, subgoalId, orderedTaskIds } as TaskReorderInput,
      async () => {
        await db.transact(reordered.mutations);
      },
    );

    return reordered.entities;
  },
  async softDeleteTask(ownerUid, taskId) {
    ensureClientMutationSupport();

    const task = assertOwnedTask(await findTaskById(ownerUid, taskId), ownerUid);

    if (task.deletedAt) {
      return task;
    }

    const now = new Date().toISOString();
    const lifecycle = buildSoftDeleteLifecycle(now);

    await commitOrQueueMutation(
      "softDeleteTask",
      { ownerUid, taskId } as TaskArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await archiveTaskViaApi(taskId);
          return;
        }

        await db.transact(
          db.tx.tasks[taskId].update({
            deletedAt: now,
            deletedBy: ownerUid,
            restoreUntil: lifecycle.restoreUntil,
            purgeAt: lifecycle.purgeAt,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...task,
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
    };
  },
  async restoreTask(ownerUid, taskId) {
    ensureClientMutationSupport();

    const task = assertOwnedTask(await findTaskById(ownerUid, taskId), ownerUid);

    if (!task.deletedAt) {
      return task;
    }

    assertRestoreWindowOpen(task.restoreUntil, "Task");

    const now = new Date().toISOString();

    await commitOrQueueMutation(
      "restoreTask",
      { ownerUid, taskId } as TaskArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await restoreTaskViaApi(taskId);
          return;
        }

        await db.transact(
          db.tx.tasks[taskId].update({
            deletedAt: null,
            deletedBy: null,
            restoreUntil: null,
            purgeAt: null,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...task,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    };
  },
  async purgeExpiredDeletedEntities(ownerUid) {
    ensureClientMutationSupport();

    const nowIso = new Date().toISOString();
    const [goals, subgoals, tasks] = await Promise.all([
      dataRepository.listGoals(ownerUid, "professional", { includeDeleted: true }).then(async (professionalGoals) => {
        const personalGoals = await dataRepository.listGoals(ownerUid, "personal", { includeDeleted: true });
        return [...professionalGoals, ...personalGoals];
      }),
      listAllSubgoalsForOwner(ownerUid),
      listAllTasksForOwner(ownerUid),
    ]);

    const expiredGoalIds = new Set(
      goals
        .filter((goal) => isExpiredSoftDeletedEntity(goal.deletedAt, goal.purgeAt, nowIso))
        .map((goal) => goal.id),
    );

    const expiredSubgoalIds = new Set(
      subgoals
        .filter(
          (subgoal) =>
            isExpiredSoftDeletedEntity(subgoal.deletedAt, subgoal.purgeAt, nowIso) || expiredGoalIds.has(subgoal.goalId),
        )
        .map((subgoal) => subgoal.id),
    );

    const expiredTaskIds = new Set(
      tasks
        .filter(
          (task) =>
            isExpiredSoftDeletedEntity(task.deletedAt, task.purgeAt, nowIso) || expiredSubgoalIds.has(task.subgoalId),
        )
        .map((task) => task.id),
    );

    const mutations: TransactionMutation[] = [
      ...Array.from(expiredTaskIds, (taskId) => db.tx.tasks[taskId].delete()),
      ...Array.from(expiredSubgoalIds, (subgoalId) => db.tx.subgoals[subgoalId].delete()),
      ...Array.from(expiredGoalIds, (goalId) => db.tx.goals[goalId].delete()),
    ];

    if (mutations.length > 0) {
      await db.transact(mutations);
    }

    return {
      goals: expiredGoalIds.size,
      subgoals: expiredSubgoalIds.size,
      tasks: expiredTaskIds.size,
      purgedAt: nowIso,
    };
  },
  async listJournalEntries(ownerUid, options) {
    const data = await runClientQuery<{ journalEntries?: JournalEntry[] }>({
      journalEntries: {
        $: {
          where: {
            ownerUid,
          },
        },
      },
    });

    return filterDeleted(data.journalEntries ?? [], options).sort(compareJournalEntries);
  },
  async saveJournalEntry(input) {
    ensureClientMutationSupport();

    const now = new Date().toISOString();
    const {
      trimmedTitle,
      trimmedContent,
      normalizedMood,
      normalizedTags,
      normalizedRelatedGoalId,
    } = validateJournalEntryWrite(input);

    const journalEntryId = input.existingJournalEntry?.id ?? input.journalEntryId ?? id();
    const journalEntry: JournalEntry = {
      id: journalEntryId,
      ownerUid: input.ownerUid,
      title: trimmedTitle,
      content: trimmedContent,
      mood: normalizedMood,
      tags: normalizedTags,
      relatedGoalId: normalizedRelatedGoalId,
      createdAt: input.existingJournalEntry?.createdAt ?? now,
      updatedAt: now,
      deletedAt: input.existingJournalEntry?.deletedAt ?? null,
      deletedBy: input.existingJournalEntry?.deletedBy ?? null,
      restoreUntil: input.existingJournalEntry?.restoreUntil ?? null,
      purgeAt: input.existingJournalEntry?.purgeAt ?? null,
    };

    await commitOrQueueMutation(
      "saveJournalEntry",
      input,
      async () => {
        await db.transact(
          db.tx.journalEntries[journalEntryId].update({
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
      },
    );

    return journalEntry;
  },
  async softDeleteJournalEntry(ownerUid, journalEntryId) {
    ensureClientMutationSupport();

    const entry = assertOwnedJournalEntry(await findJournalEntryById(ownerUid, journalEntryId), ownerUid);

    if (entry.deletedAt) {
      return entry;
    }

    const now = new Date().toISOString();
    const lifecycle = buildSoftDeleteLifecycle(now);

    await commitOrQueueMutation(
      "softDeleteJournalEntry",
      { ownerUid, journalEntryId } as JournalArchiveInput,
      async () => {
        await db.transact(
          db.tx.journalEntries[journalEntryId].update({
            deletedAt: now,
            deletedBy: ownerUid,
            restoreUntil: lifecycle.restoreUntil,
            purgeAt: lifecycle.purgeAt,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...entry,
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
    };
  },
  async restoreJournalEntry(ownerUid, journalEntryId) {
    ensureClientMutationSupport();

    const entry = assertOwnedJournalEntry(await findJournalEntryById(ownerUid, journalEntryId), ownerUid);

    if (!entry.deletedAt) {
      return entry;
    }

    assertRestoreWindowOpen(entry.restoreUntil, "Journal entry");

    const now = new Date().toISOString();

    await commitOrQueueMutation(
      "restoreJournalEntry",
      { ownerUid, journalEntryId } as JournalArchiveInput,
      async () => {
        await db.transact(
          db.tx.journalEntries[journalEntryId].update({
            deletedAt: null,
            deletedBy: null,
            restoreUntil: null,
            purgeAt: null,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...entry,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    };
  },
  getOfflineMutationCount() {
    return getOfflineMutationCountFromQueue();
  },
  subscribeOfflineMutationCount(listener) {
    return subscribeOfflineMutationCountFromQueue(listener);
  },
  async flushOfflineMutations() {
    if (typeof window === "undefined" || !isNavigatorOnline()) {
      return {
        processed: 0,
        failed: 0,
        remaining: getOfflineMutationCountFromQueue(),
        failedOperation: null,
        failedError: null,
      };
    }

    isFlushingOfflineMutations = true;

    try {
      const result = await flushOfflineMutationQueue(async (mutation) => {
        await replayOfflineMutation(mutation);
      });

      if (result.failed > 0 && result.failedOperation) {
        setOfflineSyncFailureState({
          failedOperation: result.failedOperation,
          failedError: result.failedError,
        });

        logSyncReplayFailure({
          operation: result.failedOperation,
          error: result.failedError,
          remaining: result.remaining,
          processed: result.processed,
          failed: result.failed,
        });
      } else if (result.remaining === 0) {
        setOfflineSyncFailureState(null);
      }

      return result;
    } finally {
      isFlushingOfflineMutations = false;
    }
  },
  async getUserProfile(ownerUid) {
    const data = await runClientQuery<{ userProfiles?: UserProfile[] }>({
      userProfiles: {
        $: {
          where: {
            uid: ownerUid,
          },
        },
      },
    });

    return data.userProfiles?.[0] ?? null;
  },
};

async function runClientQuery<TData>(query: InstaQLParams<AppSchema>) {
  if (!isInstantConfigured) {
    throw new UnsupportedRepositoryError("InstantDB is not configured.");
  }

  if (typeof window === "undefined") {
    throw new UnsupportedRepositoryError(
      "InstantDB repository reads must run in a client component. Use the admin API for server-side reads.",
    );
  }

  const result = await db.queryOnce(query as Parameters<typeof db.queryOnce>[0]);
  return (result.data ?? {}) as TData;
}

function ensureClientMutationSupport() {
  if (!isInstantConfigured) {
    throw new UnsupportedRepositoryError("InstantDB is not configured.");
  }

  if (typeof window === "undefined") {
    throw new UnsupportedRepositoryError(
      "InstantDB repository mutations must run in a client component. Use the admin API for server-side writes.",
    );
  }
}

async function findGoalById(ownerUid: string, goalId: string) {
  if (canUseProtectedApiRoutes()) {
    try {
      const response = await invokeProtectedRead<{ goal?: Goal }>(`/api/goals/${goalId}`);
      return response.goal ?? null;
    } catch (error) {
      if (isProtectedNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  const data = await runClientQuery<{ goals?: Goal[] }>({
    goals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return (data.goals ?? []).find((goal) => goal.id === goalId) ?? null;
}

async function findSubgoalById(ownerUid: string, subgoalId: string) {
  if (canUseProtectedApiRoutes()) {
    try {
      const response = await invokeProtectedRead<{ subgoal?: Subgoal }>(`/api/subgoals/${subgoalId}`);
      return response.subgoal ?? null;
    } catch (error) {
      if (isProtectedNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  const data = await runClientQuery<{ subgoals?: Subgoal[] }>({
    subgoals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return (data.subgoals ?? []).find((subgoal) => subgoal.id === subgoalId) ?? null;
}

async function findTaskById(ownerUid: string, taskId: string) {
  if (canUseProtectedApiRoutes()) {
    try {
      const response = await invokeProtectedRead<{ task?: Task }>(`/api/tasks/${taskId}`);
      return response.task ?? null;
    } catch (error) {
      if (isProtectedNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  const data = await runClientQuery<{ tasks?: Task[] }>({
    tasks: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return (data.tasks ?? []).find((task) => task.id === taskId) ?? null;
}

async function findJournalEntryById(ownerUid: string, journalEntryId: string) {
  const data = await runClientQuery<{ journalEntries?: JournalEntry[] }>({
    journalEntries: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return (data.journalEntries ?? []).find((entry) => entry.id === journalEntryId) ?? null;
}

function filterDeleted<
  TEntity extends {
    deletedAt: string | null;
  },
>(entities: TEntity[], options?: ListOptions) {
  if (options?.includeDeleted) {
    return [...entities];
  }

  return entities.filter((entity) => entity.deletedAt === null);
}

function buildSoftDeleteLifecycle(deletedAtIso: string) {
  const deletedAt = new Date(deletedAtIso);
  const purgeAtDate = new Date(deletedAt);
  purgeAtDate.setDate(purgeAtDate.getDate() + env.softDeleteRetentionDays);

  const purgeAt = purgeAtDate.toISOString();

  return {
    restoreUntil: purgeAt,
    purgeAt,
  };
}

function shouldRestoreCascadeEntity(entityDeletedAt: string | null, parentDeletedAt: string) {
  if (!entityDeletedAt) {
    return false;
  }

  return entityDeletedAt === parentDeletedAt;
}

function assertRestoreWindowOpen(restoreUntil: string | null, entityLabel: string) {
  const expiry = restoreUntil ? Date.parse(restoreUntil) : Number.NaN;

  if (Number.isNaN(expiry) || expiry < Date.now()) {
    throw new Error(`${entityLabel} can no longer be restored because the restore window has expired.`);
  }
}

function isExpiredSoftDeletedEntity(deletedAt: string | null, purgeAt: string | null, nowIso: string) {
  if (!deletedAt || !purgeAt) {
    return false;
  }

  const purgeAtMs = Date.parse(purgeAt);
  if (Number.isNaN(purgeAtMs)) {
    return false;
  }

  return purgeAtMs <= Date.parse(nowIso);
}

async function listAllSubgoalsForOwner(ownerUid: string) {
  const data = await runClientQuery<{ subgoals?: Subgoal[] }>({
    subgoals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return data.subgoals ?? [];
}

async function listAllTasksForOwner(ownerUid: string) {
  const data = await runClientQuery<{ tasks?: Task[] }>({
    tasks: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return data.tasks ?? [];
}

function buildReorderedEntities<TEntity extends { id: string; orderIndex: number; updatedAt: string }>(input: {
  entities: TEntity[];
  orderedIds: string[];
  updateMutation: (entityId: string, orderIndex: number, updatedAt: string) => TransactionMutation;
}) {
  const now = new Date().toISOString();
  const entityById = new Map(input.entities.map((entity) => [entity.id, entity]));
  const reordered = input.orderedIds.map((entityId, orderIndex) => {
    const entity = entityById.get(entityId);

    if (!entity) {
      throw new Error("Reorder request referenced an entity that was not loaded.");
    }

    return {
      ...entity,
      orderIndex,
      updatedAt: now,
    };
  });

  const mutations = reordered.map((entity) =>
    input.updateMutation(entity.id, entity.orderIndex, entity.updatedAt),
  );

  return {
    entities: reordered,
    mutations,
  };
}

async function getNextGoalOrderIndex(ownerUid: string, type: GoalType) {
  const goals = await dataRepository.listGoals(ownerUid, type, { includeDeleted: true });
  const maxIndex = goals.reduce((max, goal) => Math.max(max, goal.orderIndex), -1);
  return maxIndex + 1;
}

async function getNextSubgoalOrderIndex(ownerUid: string, goalId: string) {
  const subgoals = await dataRepository.listSubgoals(ownerUid, goalId, { includeDeleted: true });
  const maxIndex = subgoals.reduce((max, subgoal) => Math.max(max, subgoal.orderIndex), -1);
  return maxIndex + 1;
}

async function getNextTaskOrderIndex(ownerUid: string, subgoalId: string) {
  const tasks = await dataRepository.listTasks(ownerUid, subgoalId, { includeDeleted: true });
  const maxIndex = tasks.reduce((max, task) => Math.max(max, task.orderIndex), -1);
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

function compareGoals(left: Goal, right: Goal) {
  if (left.orderIndex !== right.orderIndex) {
    return left.orderIndex - right.orderIndex;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareSubgoals(left: Subgoal, right: Subgoal) {
  if (left.orderIndex !== right.orderIndex) {
    return left.orderIndex - right.orderIndex;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareTasks(left: Task, right: Task) {
  if (left.orderIndex !== right.orderIndex) {
    return left.orderIndex - right.orderIndex;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareJournalEntries(left: JournalEntry, right: JournalEntry) {
  return right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt);
}

async function commitOrQueueMutation(
  operation: string,
  payload: unknown,
  apply: () => Promise<void>,
) {
  if (typeof window !== "undefined" && !isNavigatorOnline() && !isFlushingOfflineMutations) {
    enqueueOfflineMutation(operation, payload);
    return;
  }

  try {
    await apply();
  } catch (error) {
    if (shouldQueueMutation(error)) {
      enqueueOfflineMutation(operation, payload);
      return;
    }

    throw error;
  }
}

async function runClientMutationWithServerFallback(
  runClientMutation: () => Promise<void>,
  runServerFallback: () => Promise<void>,
) {
  try {
    await runClientMutation();
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }

    await runServerFallback();
  }
}

function isPermissionDeniedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("not perms-pass") || message.includes("permission denied");
}

async function saveGoalViaApi(goal: Goal, isUpdate: boolean) {
  const path = isUpdate ? `/api/goals/${goal.id}` : "/api/goals";
  const method = isUpdate ? "PATCH" : "POST";

  await invokeProtectedWrite(path, method, {
    type: goal.type,
    title: goal.title,
    description: goal.description,
    projectedStartDate: goal.projectedStartDate,
    projectedEndDate: goal.projectedEndDate,
    timeframeLabel: goal.timeframe,
    isFocus: goal.isFocus,
  });
}

async function saveSubgoalViaApi(subgoal: Subgoal, isUpdate: boolean) {
  const path = isUpdate ? `/api/subgoals/${subgoal.id}` : "/api/subgoals";
  const method = isUpdate ? "PATCH" : "POST";

  await invokeProtectedWrite(path, method, {
    goalId: subgoal.goalId,
    title: subgoal.title,
    description: subgoal.description,
    projectedStartDate: subgoal.projectedStartDate,
    projectedEndDate: subgoal.projectedEndDate,
    timeframeLabel: subgoal.timeframe,
  });
}

async function saveTaskViaApi(task: Task, isUpdate: boolean) {
  const path = isUpdate ? `/api/tasks/${task.id}` : "/api/tasks";
  const method = isUpdate ? "PATCH" : "POST";

  await invokeProtectedWrite(path, method, {
    subgoalId: task.subgoalId,
    title: task.title,
    notes: task.notes,
    dueDate: task.dueDate,
  });
}

async function archiveGoalViaApi(goalId: string) {
  await invokeProtectedWrite(`/api/goals/${goalId}/archive`, "PATCH", {});
}

async function restoreGoalViaApi(goalId: string) {
  await invokeProtectedWrite(`/api/goals/${goalId}/restore`, "PATCH", {});
}

async function archiveSubgoalViaApi(subgoalId: string) {
  await invokeProtectedWrite(`/api/subgoals/${subgoalId}/archive`, "PATCH", {});
}

async function restoreSubgoalViaApi(subgoalId: string) {
  await invokeProtectedWrite(`/api/subgoals/${subgoalId}/restore`, "PATCH", {});
}

async function archiveTaskViaApi(taskId: string) {
  await invokeProtectedWrite(`/api/tasks/${taskId}/archive`, "PATCH", {});
}

async function restoreTaskViaApi(taskId: string) {
  await invokeProtectedWrite(`/api/tasks/${taskId}/restore`, "PATCH", {});
}

async function invokeProtectedWrite(path: string, method: "POST" | "PATCH", payload: unknown) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return;
  }

  const fallbackMessage = `Protected write failed (${response.status}).`;
  let messageFromBody: string | null = null;

  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim().length > 0) {
      messageFromBody = body.error;
    }
  } catch {
    // Ignore JSON parse errors and fall back to status-only message.
  }

  throw new Error(messageFromBody ?? fallbackMessage);
}

async function invokeProtectedRead<TResponse>(path: string) {
  const response = await fetch(path, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Protected read failed (${response.status}).`);
  }

  return (await response.json()) as TResponse;
}

function canUseProtectedApiRoutes() {
  return (
    typeof window !== "undefined" &&
    typeof window.location?.origin === "string"
  );
}

function isProtectedNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes("Protected read failed (404)");
}

function shouldQueueMutation(error: unknown) {
  if (isFlushingOfflineMutations || typeof window === "undefined") {
    return false;
  }

  if (!isNavigatorOnline()) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("network") || message.includes("fetch") || message.includes("offline");
}

function isNavigatorOnline() {
  return typeof navigator === "undefined" || typeof navigator.onLine !== "boolean" || navigator.onLine;
}

async function replayOfflineMutation(mutation: OfflineMutation) {
  try {
    switch (mutation.operation) {
      case "saveGoal":
        await dataRepository.saveGoal(mutation.payload as SaveGoalInput);
        return;
      case "updateGoalStatus": {
        const payload = mutation.payload as GoalStatusUpdateInput;
        await dataRepository.updateGoalStatus(payload.ownerUid, payload.goalId, payload.status);
        return;
      }
      case "reorderGoals": {
        const payload = mutation.payload as GoalReorderInput;
        await dataRepository.reorderGoals(payload.ownerUid, payload.type, payload.orderedGoalIds);
        return;
      }
      case "softDeleteGoal": {
        const payload = mutation.payload as GoalArchiveInput;
        await dataRepository.softDeleteGoal(payload.ownerUid, payload.goalId);
        return;
      }
      case "restoreGoal": {
        const payload = mutation.payload as GoalArchiveInput;
        await dataRepository.restoreGoal(payload.ownerUid, payload.goalId);
        return;
      }
      case "saveSubgoal":
        await dataRepository.saveSubgoal(mutation.payload as SaveSubgoalInput);
        return;
      case "updateSubgoalStatus": {
        const payload = mutation.payload as SubgoalStatusUpdateInput;
        await dataRepository.updateSubgoalStatus(payload.ownerUid, payload.subgoalId, payload.status);
        return;
      }
      case "reorderSubgoals": {
        const payload = mutation.payload as SubgoalReorderInput;
        await dataRepository.reorderSubgoals(payload.ownerUid, payload.goalId, payload.orderedSubgoalIds);
        return;
      }
      case "softDeleteSubgoal": {
        const payload = mutation.payload as SubgoalArchiveInput;
        await dataRepository.softDeleteSubgoal(payload.ownerUid, payload.subgoalId);
        return;
      }
      case "restoreSubgoal": {
        const payload = mutation.payload as SubgoalArchiveInput;
        await dataRepository.restoreSubgoal(payload.ownerUid, payload.subgoalId);
        return;
      }
      case "saveTask":
        await dataRepository.saveTask(mutation.payload as SaveTaskInput);
        return;
      case "updateTaskStatus": {
        const payload = mutation.payload as TaskStatusUpdateInput;
        await dataRepository.updateTaskStatus(payload.ownerUid, payload.taskId, payload.status);
        return;
      }
      case "reorderTasks": {
        const payload = mutation.payload as TaskReorderInput;
        await dataRepository.reorderTasks(payload.ownerUid, payload.subgoalId, payload.orderedTaskIds);
        return;
      }
      case "softDeleteTask": {
        const payload = mutation.payload as TaskArchiveInput;
        await dataRepository.softDeleteTask(payload.ownerUid, payload.taskId);
        return;
      }
      case "restoreTask": {
        const payload = mutation.payload as TaskArchiveInput;
        await dataRepository.restoreTask(payload.ownerUid, payload.taskId);
        return;
      }
      case "saveJournalEntry":
        await dataRepository.saveJournalEntry(mutation.payload as SaveJournalEntryInput);
        return;
      case "softDeleteJournalEntry": {
        const payload = mutation.payload as JournalArchiveInput;
        await dataRepository.softDeleteJournalEntry(payload.ownerUid, payload.journalEntryId);
        return;
      }
      case "restoreJournalEntry": {
        const payload = mutation.payload as JournalArchiveInput;
        await dataRepository.restoreJournalEntry(payload.ownerUid, payload.journalEntryId);
        return;
      }
      default:
        throw new Error(`Unsupported offline mutation operation: ${mutation.operation}`);
    }
  } catch (error) {
    if (isOfflineReplayConflict(error)) {
      const message = error instanceof Error ? error.message : "Offline replay conflict detected.";
      throw new Error(`Offline conflict: ${message}`);
    }

    throw error;
  }
}

function isOfflineReplayConflict(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("was not found") ||
    message.includes("does not belong") ||
    message.includes("unknown") ||
    message.includes("not loaded") ||
    message.includes("restore window has expired") ||
    message.includes("reorder request")
  );
}
