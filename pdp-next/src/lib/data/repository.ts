import { id, type InstaQLParams } from "@instantdb/react";
import { db, isInstantConfigured } from "@/lib/instantdb/client";
import { env } from "@/lib/config/env";
import { statusToPercent } from "@/lib/domain/status";
import type {
  Goal,
  GoalTimeframeLevel,
  GoalType,
  Habit,
  HabitCadence,
  HabitCheckin,
  HabitState,
  ItemStatus,
  JournalEntry,
  ChildGoal,
  Task,
  UserProfile,
} from "@/lib/domain/types";
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
  assertOwnedChildGoal,
  assertOwnedTask,
  validateGoalWrite,
  validateJournalEntryWrite,
  validateReorderIds,
  validateStatusUpdate,
  validateChildGoalWrite,
  validateTaskWrite,
} from "@/lib/data/validation";

type ListOptions = {
  includeDeleted?: boolean;
};

type TransactionMutation =
  | ReturnType<(typeof db.tx.goals)[string]["update"]>
  | ReturnType<(typeof db.tx.goals)[string]["delete"]>
  | ReturnType<(typeof db.tx.tasks)[string]["update"]>
  | ReturnType<(typeof db.tx.tasks)[string]["delete"]>
  | ReturnType<(typeof db.tx.journalEntries)[string]["update"]>
  | ReturnType<(typeof db.tx.journalEntries)[string]["delete"]>;

export type SaveGoalInput = {
  goalId?: string;
  ownerUid: string;
  type: GoalType;
  parentGoalId?: string | null;
  timeframeLevel: GoalTimeframeLevel;
  title: string;
  description: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  timeframeLabel?: string;
  isFocus: boolean;
  existingGoal?: Goal;
};

export type SaveChildGoalInput = {
  childGoalId?: string;
  ownerUid: string;
  goalId: string;
  title: string;
  description: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  timeframeLabel?: string;
  existingChildGoal?: ChildGoal;
};

export type SaveTaskInput = {
  taskId?: string;
  ownerUid: string;
  goalId: string;
  title: string;
  notes: string;
  dueDate: string | null;
  unplanned?: boolean;
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

export type SaveHabitInput = {
  habitId?: string;
  ownerUid: string;
  title: string;
  cadence: HabitCadence;
  targetCount: number;
  status?: HabitState;
  existingHabit?: Habit;
};

export type SaveHabitCheckinInput = {
  checkinId?: string;
  ownerUid: string;
  habitId: string;
  checkInDate: string;
  notes: string | null;
  existingCheckin?: HabitCheckin;
};

type GoalStatusUpdateInput = {
  ownerUid: string;
  goalId: string;
  status: ItemStatus;
};

type ChildGoalStatusUpdateInput = {
  ownerUid: string;
  childGoalId: string;
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

type ChildGoalReorderInput = {
  ownerUid: string;
  goalId: string;
  orderedChildGoalIds: string[];
};

type TaskReorderInput = {
  ownerUid: string;
  goalId: string;
  orderedTaskIds: string[];
};

type GoalArchiveInput = {
  ownerUid: string;
  goalId: string;
};

type ChildGoalArchiveInput = {
  ownerUid: string;
  childGoalId: string;
};

type TaskArchiveInput = {
  ownerUid: string;
  taskId: string;
};

type GoalPermanentDeleteInput = {
  ownerUid: string;
  goalId: string;
};

type ChildGoalPermanentDeleteInput = {
  ownerUid: string;
  childGoalId: string;
};

type TaskPermanentDeleteInput = {
  ownerUid: string;
  taskId: string;
};

type JournalArchiveInput = {
  ownerUid: string;
  journalEntryId: string;
};

type JournalPermanentDeleteInput = {
  ownerUid: string;
  journalEntryId: string;
};

type HabitArchiveInput = {
  ownerUid: string;
  habitId: string;
};

type HabitPermanentDeleteInput = {
  ownerUid: string;
  habitId: string;
};

type HabitCheckinDeleteInput = {
  ownerUid: string;
  habitId: string;
  checkinId: string;
};

export type DataRepository = {
  listGoals: (ownerUid: string, type: GoalType, options?: ListOptions) => Promise<Goal[]>;
  saveGoal: (input: SaveGoalInput) => Promise<Goal>;
  updateGoalStatus: (ownerUid: string, goalId: string, status: ItemStatus) => Promise<Goal>;
  reorderGoals: (ownerUid: string, type: GoalType, orderedGoalIds: string[]) => Promise<Goal[]>;
  softDeleteGoal: (ownerUid: string, goalId: string) => Promise<Goal>;
  restoreGoal: (ownerUid: string, goalId: string) => Promise<Goal>;
  permanentlyDeleteGoal: (ownerUid: string, goalId: string) => Promise<void>;
  listChildGoals: (ownerUid: string, goalId: string, options?: ListOptions) => Promise<ChildGoal[]>;
  saveChildGoal: (input: SaveChildGoalInput) => Promise<ChildGoal>;
  updateChildGoalStatus: (ownerUid: string, childGoalId: string, status: ItemStatus) => Promise<ChildGoal>;
  reorderChildGoals: (ownerUid: string, goalId: string, orderedChildGoalIds: string[]) => Promise<ChildGoal[]>;
  softDeleteChildGoal: (ownerUid: string, childGoalId: string) => Promise<ChildGoal>;
  restoreChildGoal: (ownerUid: string, childGoalId: string) => Promise<ChildGoal>;
  permanentlyDeleteChildGoal: (ownerUid: string, childGoalId: string) => Promise<void>;
  listTasks: (ownerUid: string, goalId: string, options?: ListOptions) => Promise<Task[]>;
  saveTask: (input: SaveTaskInput) => Promise<Task>;
  updateTaskStatus: (ownerUid: string, taskId: string, status: ItemStatus) => Promise<Task>;
  reorderTasks: (ownerUid: string, goalId: string, orderedTaskIds: string[]) => Promise<Task[]>;
  softDeleteTask: (ownerUid: string, taskId: string) => Promise<Task>;
  restoreTask: (ownerUid: string, taskId: string) => Promise<Task>;
  permanentlyDeleteTask: (ownerUid: string, taskId: string) => Promise<void>;
  purgeExpiredDeletedEntities: (ownerUid: string) => Promise<{
    goals: number;
    childGoals: number;
    tasks: number;
    purgedAt: string;
  }>;
  listJournalEntries: (ownerUid: string, options?: ListOptions) => Promise<JournalEntry[]>;
  saveJournalEntry: (input: SaveJournalEntryInput) => Promise<JournalEntry>;
  softDeleteJournalEntry: (ownerUid: string, journalEntryId: string) => Promise<JournalEntry>;
  restoreJournalEntry: (ownerUid: string, journalEntryId: string) => Promise<JournalEntry>;
  permanentlyDeleteJournalEntry: (ownerUid: string, journalEntryId: string) => Promise<void>;
  listHabits: (ownerUid: string, options?: ListOptions) => Promise<Habit[]>;
  saveHabit: (input: SaveHabitInput) => Promise<Habit>;
  softDeleteHabit: (ownerUid: string, habitId: string) => Promise<Habit>;
  restoreHabit: (ownerUid: string, habitId: string) => Promise<Habit>;
  permanentlyDeleteHabit: (ownerUid: string, habitId: string) => Promise<void>;
  listHabitCheckins: (ownerUid: string, habitId: string) => Promise<HabitCheckin[]>;
  saveHabitCheckin: (input: SaveHabitCheckinInput) => Promise<HabitCheckin>;
  deleteHabitCheckin: (ownerUid: string, habitId: string, checkinId: string) => Promise<void>;
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
      return filterDeleted(response.goals ?? [], options)
        .map(normalizeGoalDefaults)
        .sort(compareGoals);
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

    return filterDeleted(data.goals ?? [], options)
      .map(normalizeGoalDefaults)
      .sort(compareGoals);
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
      parentGoalId: input.parentGoalId ?? input.existingGoal?.parentGoalId ?? null,
      timeframeLevel: input.timeframeLevel,
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
    const childGoals = await dataRepository.listChildGoals(ownerUid, goalId, { includeDeleted: true });
    const taskGroups = await Promise.all(
      childGoals.map((childGoal) => dataRepository.listTasks(ownerUid, childGoal.id, { includeDeleted: true })),
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

    const childGoalMutations = childGoals
      .filter((childGoal) => !childGoal.deletedAt)
      .map((childGoal) =>
        db.tx.goals[childGoal.id].update({
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

        await db.transact([goalMutation, ...childGoalMutations, ...taskMutations]);
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
    const childGoals = await dataRepository.listChildGoals(ownerUid, goalId, { includeDeleted: true });
    const childGoalsToRestore = childGoals.filter((childGoal) =>
      shouldRestoreCascadeEntity(childGoal.deletedAt, cascadeDeletedAt),
    );
    const taskGroups = await Promise.all(
      childGoalsToRestore.map((childGoal) =>
        dataRepository.listTasks(ownerUid, childGoal.id, { includeDeleted: true }),
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

    const childGoalMutations = childGoalsToRestore.map((childGoal) =>
        db.tx.goals[childGoal.id].update({
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

        await db.transact([goalMutation, ...childGoalMutations, ...taskMutations]);
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
  async permanentlyDeleteGoal(ownerUid, goalId) {
    ensureClientMutationSupport();

    const goal = assertOwnedGoal(await findGoalById(ownerUid, goalId), ownerUid);
    if (!goal.deletedAt) {
      throw new Error("Goal must be archived before permanent deletion.");
    }

    const childGoals = await dataRepository.listChildGoals(ownerUid, goalId, { includeDeleted: true });
    const taskGroups = await Promise.all(
      childGoals.map((childGoal) => dataRepository.listTasks(ownerUid, childGoal.id, { includeDeleted: true })),
    );
    const tasks = taskGroups.flat();

    const mutations: TransactionMutation[] = [
      ...tasks.map((task) => db.tx.tasks[task.id].delete()),
      ...childGoals.map((childGoal) => db.tx.goals[childGoal.id].delete()),
      db.tx.goals[goalId].delete(),
    ];

    await commitOrQueueMutation(
      "permanentlyDeleteGoal",
      { ownerUid, goalId } as GoalPermanentDeleteInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await permanentlyDeleteGoalViaApi(goalId);
          return;
        }

        await db.transact(mutations);
      },
    );
  },
  async listChildGoals(ownerUid, goalId, options) {
    const data = await runClientQuery<{ goals?: Goal[] }>({
      goals: {
        $: {
          where: {
            ownerUid,
            parentGoalId: goalId,
          },
        },
      },
    });

    const childGoals = (data.goals ?? [])
      .map((goal) => ({
        id: goal.id,
        ownerUid: goal.ownerUid,
        goalId,
        title: goal.title,
        description: goal.description,
        timeframe: goal.timeframe,
        projectedStartDate: goal.projectedStartDate,
        projectedEndDate: goal.projectedEndDate,
        actualStartDate: goal.actualStartDate,
        actualEndDate: goal.actualEndDate,
        status: goal.status,
        percentComplete: goal.percentComplete,
        orderIndex: goal.orderIndex,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        deletedAt: goal.deletedAt,
        deletedBy: goal.deletedBy,
        restoreUntil: goal.restoreUntil,
        purgeAt: goal.purgeAt,
      }));

    return filterDeleted(childGoals, options).sort(compareChildGoals);
  },
  async saveChildGoal(input) {
    const parentGoal = assertOwnedGoal(await findGoalById(input.ownerUid, input.goalId), input.ownerUid);
    const { trimmedTitle, trimmedDescription } = validateChildGoalWrite(input);

    const goal = await dataRepository.saveGoal({
      goalId: input.existingChildGoal?.id ?? input.childGoalId,
      ownerUid: input.ownerUid,
      type: parentGoal.type,
      parentGoalId: input.goalId,
      timeframeLevel: parentGoal.timeframeLevel,
      title: trimmedTitle,
      description: trimmedDescription,
      projectedStartDate: input.projectedStartDate,
      projectedEndDate: input.projectedEndDate,
      timeframeLabel: input.timeframeLabel,
      isFocus: false,
    });

    return {
      id: goal.id,
      ownerUid: goal.ownerUid,
      goalId: input.goalId,
      title: goal.title,
      description: goal.description,
      timeframe: goal.timeframe,
      projectedStartDate: goal.projectedStartDate,
      projectedEndDate: goal.projectedEndDate,
      actualStartDate: goal.actualStartDate,
      actualEndDate: goal.actualEndDate,
      status: goal.status,
      percentComplete: goal.percentComplete,
      orderIndex: goal.orderIndex,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      deletedAt: goal.deletedAt,
      deletedBy: goal.deletedBy,
      restoreUntil: goal.restoreUntil,
      purgeAt: goal.purgeAt,
    };
  },
  async updateChildGoalStatus(ownerUid, childGoalId, status) {
    ensureClientMutationSupport();

    validateStatusUpdate(status);

    const childGoal = assertOwnedChildGoal(await findChildGoalById(ownerUid, childGoalId), ownerUid);

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(status);

    await commitOrQueueMutation(
      "updateChildGoalStatus",
      { ownerUid, childGoalId, status } as ChildGoalStatusUpdateInput,
      async () => {
        await db.transact(
          db.tx.goals[childGoalId].update({
            status,
            percentComplete,
            updatedAt: now,
          }),
        );
      },
    );

    return {
      ...childGoal,
      status,
      percentComplete,
      updatedAt: now,
    };
  },
  async reorderChildGoals(ownerUid, goalId, orderedChildGoalIds) {
    ensureClientMutationSupport();

    const childGoals = await dataRepository.listChildGoals(ownerUid, goalId);
    validateReorderIds(childGoals, orderedChildGoalIds, "childGoal");

    const reordered = buildReorderedEntities({
      entities: childGoals,
      orderedIds: orderedChildGoalIds,
      updateMutation: (childGoalId, orderIndex, updatedAt) =>
        db.tx.goals[childGoalId].update({
          orderIndex,
          updatedAt,
        }),
    });

    await commitOrQueueMutation(
      "reorderChildGoals",
      { ownerUid, goalId, orderedChildGoalIds } as ChildGoalReorderInput,
      async () => {
        await db.transact(reordered.mutations);
      },
    );

    return reordered.entities;
  },
  async softDeleteChildGoal(ownerUid, childGoalId) {
    ensureClientMutationSupport();

    const childGoal = assertOwnedChildGoal(await findChildGoalById(ownerUid, childGoalId), ownerUid);

    if (childGoal.deletedAt) {
      return childGoal;
    }

    const now = new Date().toISOString();
    const lifecycle = buildSoftDeleteLifecycle(now);
    const tasks = await dataRepository.listTasks(ownerUid, childGoalId, { includeDeleted: true });

    const childGoalMutation = db.tx.goals[childGoalId].update({
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
      "softDeleteChildGoal",
      { ownerUid, childGoalId } as ChildGoalArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await archiveChildGoalViaApi(childGoalId);
          return;
        }

        await db.transact([childGoalMutation, ...taskMutations]);
      },
    );

    return {
      ...childGoal,
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
    };
  },
  async restoreChildGoal(ownerUid, childGoalId) {
    ensureClientMutationSupport();

    const childGoal = assertOwnedChildGoal(await findChildGoalById(ownerUid, childGoalId), ownerUid);

    if (!childGoal.deletedAt) {
      return childGoal;
    }

    assertRestoreWindowOpen(childGoal.restoreUntil, "ChildGoal");

    const now = new Date().toISOString();
    const cascadeDeletedAt = childGoal.deletedAt;
    const tasks = await dataRepository.listTasks(ownerUid, childGoalId, { includeDeleted: true });

    const childGoalMutation = db.tx.goals[childGoalId].update({
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
      "restoreChildGoal",
      { ownerUid, childGoalId } as ChildGoalArchiveInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await restoreChildGoalViaApi(childGoalId);
          return;
        }

        await db.transact([childGoalMutation, ...taskMutations]);
      },
    );

    return {
      ...childGoal,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    };
  },
  async permanentlyDeleteChildGoal(ownerUid, childGoalId) {
    ensureClientMutationSupport();

    const childGoal = assertOwnedChildGoal(await findChildGoalById(ownerUid, childGoalId), ownerUid);
    if (!childGoal.deletedAt) {
      throw new Error("ChildGoal must be archived before permanent deletion.");
    }

    const tasks = await dataRepository.listTasks(ownerUid, childGoalId, { includeDeleted: true });
    const mutations: TransactionMutation[] = [
      ...tasks.map((task) => db.tx.tasks[task.id].delete()),
      db.tx.goals[childGoalId].delete(),
    ];

    await commitOrQueueMutation(
      "permanentlyDeleteChildGoal",
      { ownerUid, childGoalId } as ChildGoalPermanentDeleteInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await permanentlyDeleteChildGoalViaApi(childGoalId);
          return;
        }

        await db.transact(mutations);
      },
    );
  },
  async listTasks(ownerUid, goalId, options) {
    if (canUseProtectedApiRoutes()) {
      const searchParams = new URLSearchParams({
        includeDeleted: String(Boolean(options?.includeDeleted)),
        goalId,
      });
      const response = await invokeProtectedRead<{ tasks?: Task[] }>(`/api/tasks?${searchParams.toString()}`);
      return filterDeleted((response.tasks ?? []).map(normalizeTaskDefaults), options).sort(compareTasks);
    }

    const data = await runClientQuery<{ tasks?: Task[] }>({
      tasks: {
        $: {
          where: {
            ownerUid,
            goalId,
          },
        },
      },
    });

    return filterDeleted((data.tasks ?? []).map(normalizeTaskDefaults), options).sort(compareTasks);
  },
  async saveTask(input) {
    ensureClientMutationSupport();
    const normalizedGoalId = input.goalId;

    const now = new Date().toISOString();
    const { trimmedTitle, trimmedNotes } = validateTaskWrite(input);
    const existingTaskGoalId = input.existingTask?.goalId;

    const nextOrderIndex = input.existingTask
      ? existingTaskGoalId === normalizedGoalId
        ? input.existingTask.orderIndex
        : await getNextTaskOrderIndex(input.ownerUid, normalizedGoalId)
      : await getNextTaskOrderIndex(input.ownerUid, normalizedGoalId);

    const taskId = input.existingTask?.id ?? input.taskId ?? id();
    const task: Task = {
      id: taskId,
      ownerUid: input.ownerUid,
      goalId: normalizedGoalId,
      title: trimmedTitle,
      notes: trimmedNotes,
      dueDate: input.dueDate,
      unplanned: input.unplanned ?? input.existingTask?.unplanned ?? false,
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
                goalId: task.goalId,
                title: task.title,
                notes: task.notes,
                dueDate: task.dueDate,
                unplanned: task.unplanned,
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
  async reorderTasks(ownerUid, goalId, orderedTaskIds) {
    ensureClientMutationSupport();

    const tasks = await dataRepository.listTasks(ownerUid, goalId);
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
      { ownerUid, goalId, orderedTaskIds } as TaskReorderInput,
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
  async permanentlyDeleteTask(ownerUid, taskId) {
    ensureClientMutationSupport();

    const task = assertOwnedTask(await findTaskById(ownerUid, taskId), ownerUid);
    if (!task.deletedAt) {
      throw new Error("Task must be archived before permanent deletion.");
    }

    await commitOrQueueMutation(
      "permanentlyDeleteTask",
      { ownerUid, taskId } as TaskPermanentDeleteInput,
      async () => {
        if (canUseProtectedApiRoutes()) {
          await permanentlyDeleteTaskViaApi(taskId);
          return;
        }

        await db.transact(db.tx.tasks[taskId].delete());
      },
    );
  },
  async purgeExpiredDeletedEntities(ownerUid) {
    ensureClientMutationSupport();

    const nowIso = new Date().toISOString();
    const [goals, childGoals, tasks] = await Promise.all([
      dataRepository.listGoals(ownerUid, "professional", { includeDeleted: true }).then(async (professionalGoals) => {
        const personalGoals = await dataRepository.listGoals(ownerUid, "personal", { includeDeleted: true });
        return [...professionalGoals, ...personalGoals];
      }),
      listAllChildGoalsForOwner(ownerUid),
      listAllTasksForOwner(ownerUid),
    ]);

    const expiredGoalIds = new Set(
      goals
        .filter((goal) => isExpiredSoftDeletedEntity(goal.deletedAt, goal.purgeAt, nowIso))
        .map((goal) => goal.id),
    );

    const expiredChildGoalIds = new Set(
      childGoals
        .filter(
          (childGoal) =>
            isExpiredSoftDeletedEntity(childGoal.deletedAt, childGoal.purgeAt, nowIso) || expiredGoalIds.has(childGoal.goalId),
        )
        .map((childGoal) => childGoal.id),
    );

    const expiredTaskIds = new Set(
      tasks
        .filter(
          (task) =>
            isExpiredSoftDeletedEntity(task.deletedAt, task.purgeAt, nowIso) ||
            expiredChildGoalIds.has(task.goalId),
        )
        .map((task) => task.id),
    );

    const mutations: TransactionMutation[] = [
      ...Array.from(expiredTaskIds, (taskId) => db.tx.tasks[taskId].delete()),
      ...Array.from(expiredChildGoalIds, (childGoalId) => db.tx.goals[childGoalId].delete()),
      ...Array.from(expiredGoalIds, (goalId) => db.tx.goals[goalId].delete()),
    ];

    if (mutations.length > 0) {
      await db.transact(mutations);
    }

    return {
      goals: expiredGoalIds.size,
      childGoals: expiredChildGoalIds.size,
      tasks: expiredTaskIds.size,
      purgedAt: nowIso,
    };
  },
  async listJournalEntries(ownerUid, options) {
    if (canUseProtectedApiRoutes()) {
      const params = new URLSearchParams({
        includeDeleted: String(Boolean(options?.includeDeleted)),
      });
      const response = await invokeProtectedRead<{ journalEntries?: JournalEntry[] }>(`/api/journal?${params.toString()}`);
      return (response.journalEntries ?? []).sort(compareJournalEntries);
    }

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

    if (canUseProtectedApiRoutes()) {
      const existingId = input.existingJournalEntry?.id ?? input.journalEntryId ?? null;
      const journalEntry = existingId
        ? await updateJournalEntryViaApi(existingId, input)
        : await createJournalEntryViaApi(input);
      return journalEntry;
    }

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

    if (canUseProtectedApiRoutes()) {
      return archiveJournalEntryViaApi(journalEntryId);
    }

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

    if (canUseProtectedApiRoutes()) {
      return restoreJournalEntryViaApi(journalEntryId);
    }

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
  async permanentlyDeleteJournalEntry(ownerUid, journalEntryId) {
    ensureClientMutationSupport();

    if (canUseProtectedApiRoutes()) {
      await permanentlyDeleteJournalEntryViaApi(journalEntryId);
      return;
    }

    const entry = assertOwnedJournalEntry(await findJournalEntryById(ownerUid, journalEntryId), ownerUid);
    if (!entry.deletedAt) {
      throw new Error("Journal entry must be archived before permanent deletion.");
    }

    await commitOrQueueMutation(
      "permanentlyDeleteJournalEntry",
      { ownerUid, journalEntryId } as JournalPermanentDeleteInput,
      async () => {
        await db.transact(db.tx.journalEntries[journalEntryId].delete());
      },
    );
  },
  async listHabits(ownerUid, options) {
    if (canUseProtectedApiRoutes()) {
      const searchParams = new URLSearchParams({
        includeDeleted: String(Boolean(options?.includeDeleted)),
      });
      const response = await invokeProtectedRead<{ habits?: Habit[] }>(`/api/habits?${searchParams.toString()}`);
      return filterDeleted(response.habits ?? [], options).sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt),
      );
    }

    const data = await runClientQuery<{ habits?: Habit[] }>({
      habits: {
        $: {
          where: {
            ownerUid,
          },
        },
      },
    });

    return filterDeleted(data.habits ?? [], options).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt),
    );
  },
  async saveHabit(input) {
    ensureClientMutationSupport();

    const now = new Date().toISOString();
    const habitId = input.existingHabit?.id ?? input.habitId ?? id();
    const title = input.title.trim();
    if (!title) {
      throw new Error("Habit title is required.");
    }

    if (!Number.isFinite(input.targetCount) || input.targetCount <= 0) {
      throw new Error("Habit target count must be greater than zero.");
    }

    const habit: Habit = {
      id: habitId,
      ownerUid: input.ownerUid,
      title,
      cadence: input.cadence,
      targetCount: Math.round(input.targetCount),
      status: input.status ?? input.existingHabit?.status ?? "active",
      createdAt: input.existingHabit?.createdAt ?? now,
      updatedAt: now,
      deletedAt: input.existingHabit?.deletedAt ?? null,
      deletedBy: input.existingHabit?.deletedBy ?? null,
      restoreUntil: input.existingHabit?.restoreUntil ?? null,
      purgeAt: input.existingHabit?.purgeAt ?? null,
    };

    let persistedHabit: Habit | null = null;

    await commitOrQueueMutation("saveHabit", input, async () => {
      persistedHabit = await saveHabitViaApi(habit, Boolean(input.existingHabit));
    });

    return persistedHabit ?? habit;
  },
  async softDeleteHabit(ownerUid, habitId) {
    ensureClientMutationSupport();

    const habit = await findHabitById(ownerUid, habitId);
    if (!habit) {
      throw new Error("Habit was not found for this user.");
    }

    if (habit.deletedAt) {
      return habit;
    }

    let archivedHabit: Habit | null = null;

    await commitOrQueueMutation("softDeleteHabit", { ownerUid, habitId } as HabitArchiveInput, async () => {
      archivedHabit = await archiveHabitViaApi(habitId);
    });

    if (archivedHabit) {
      return archivedHabit;
    }

    const now = new Date().toISOString();
    const lifecycle = buildSoftDeleteLifecycle(now);
    return {
      ...habit,
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
      status: "archived",
    };
  },
  async restoreHabit(ownerUid, habitId) {
    ensureClientMutationSupport();

    const habit = await findHabitById(ownerUid, habitId);
    if (!habit) {
      throw new Error("Habit was not found for this user.");
    }

    if (!habit.deletedAt) {
      return habit;
    }

    let restoredHabit: Habit | null = null;

    await commitOrQueueMutation("restoreHabit", { ownerUid, habitId } as HabitArchiveInput, async () => {
      restoredHabit = await restoreHabitViaApi(habitId);
    });

    if (restoredHabit) {
      return restoredHabit;
    }

    const now = new Date().toISOString();
    return {
      ...habit,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
      status: "active",
    };
  },
  async permanentlyDeleteHabit(ownerUid, habitId) {
    ensureClientMutationSupport();

    await commitOrQueueMutation(
      "permanentlyDeleteHabit",
      { ownerUid, habitId } as HabitPermanentDeleteInput,
      async () => {
        await permanentlyDeleteHabitViaApi(habitId);
      },
    );
  },
  async listHabitCheckins(ownerUid, habitId) {
    if (canUseProtectedApiRoutes()) {
      const response = await invokeProtectedRead<{ checkins?: HabitCheckin[] }>(`/api/habits/${habitId}/checkins`);
      return (response.checkins ?? []).sort(
        (left, right) => right.checkInDate.localeCompare(left.checkInDate) || right.createdAt.localeCompare(left.createdAt),
      );
    }

    const data = await runClientQuery<{ habitCheckins?: HabitCheckin[] }>({
      habitCheckins: {
        $: {
          where: {
            ownerUid,
            habitId,
          },
        },
      },
    });

    return (data.habitCheckins ?? []).sort(
      (left, right) => right.checkInDate.localeCompare(left.checkInDate) || right.createdAt.localeCompare(left.createdAt),
    );
  },
  async saveHabitCheckin(input) {
    ensureClientMutationSupport();

    const checkInDate = input.checkInDate.trim();
    if (!checkInDate) {
      throw new Error("Habit check-in date is required.");
    }

    const normalizedNotes = input.notes?.trim() ? input.notes.trim() : null;
    const now = new Date().toISOString();
    const checkinId = input.existingCheckin?.id ?? input.checkinId ?? id();

    const checkin: HabitCheckin = {
      id: checkinId,
      ownerUid: input.ownerUid,
      habitId: input.habitId,
      checkInDate,
      notes: normalizedNotes,
      createdAt: input.existingCheckin?.createdAt ?? now,
      updatedAt: now,
    };

    let persistedCheckin: HabitCheckin | null = null;

    await commitOrQueueMutation("saveHabitCheckin", input, async () => {
      persistedCheckin = await saveHabitCheckinViaApi(checkin, Boolean(input.existingCheckin));
    });

    return persistedCheckin ?? checkin;
  },
  async deleteHabitCheckin(ownerUid, habitId, checkinId) {
    ensureClientMutationSupport();

    await commitOrQueueMutation(
      "deleteHabitCheckin",
      { ownerUid, habitId, checkinId } as HabitCheckinDeleteInput,
      async () => {
        await deleteHabitCheckinViaApi(habitId, checkinId);
      },
    );
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

async function findChildGoalById(ownerUid: string, childGoalId: string) {
  const data = await runClientQuery<{ goals?: Goal[] }>({
    goals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const matched = (data.goals ?? []).find((goal) => goal.id === childGoalId && Boolean(goal.parentGoalId));

  if (!matched || !matched.parentGoalId) {
    return null;
  }

  return {
    id: matched.id,
    ownerUid: matched.ownerUid,
    goalId: matched.parentGoalId,
    title: matched.title,
    description: matched.description,
    timeframe: matched.timeframe,
    projectedStartDate: matched.projectedStartDate,
    projectedEndDate: matched.projectedEndDate,
    actualStartDate: matched.actualStartDate,
    actualEndDate: matched.actualEndDate,
    status: matched.status,
    percentComplete: matched.percentComplete,
    orderIndex: matched.orderIndex,
    createdAt: matched.createdAt,
    updatedAt: matched.updatedAt,
    deletedAt: matched.deletedAt,
    deletedBy: matched.deletedBy,
    restoreUntil: matched.restoreUntil,
    purgeAt: matched.purgeAt,
  };
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
  if (canUseProtectedApiRoutes()) {
    try {
      const response = await invokeProtectedRead<{ journalEntry?: JournalEntry }>(`/api/journal/${journalEntryId}`);
      return response.journalEntry ?? null;
    } catch (error) {
      if (isProtectedNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

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

async function findHabitById(ownerUid: string, habitId: string) {
  if (canUseProtectedApiRoutes()) {
    try {
      const response = await invokeProtectedRead<{ habit?: Habit }>(`/api/habits/${habitId}`);
      return response.habit ?? null;
    } catch (error) {
      if (isProtectedNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  const data = await runClientQuery<{ habits?: Habit[] }>({
    habits: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return (data.habits ?? []).find((habit) => habit.id === habitId) ?? null;
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

async function listAllChildGoalsForOwner(ownerUid: string) {
  const data = await runClientQuery<{ goals?: Goal[] }>({
    goals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return (data.goals ?? [])
    .filter((goal) => Boolean(goal.parentGoalId))
    .map((goal) => ({
      id: goal.id,
      ownerUid: goal.ownerUid,
      goalId: goal.parentGoalId ?? "",
      title: goal.title,
      description: goal.description,
      timeframe: goal.timeframe,
      projectedStartDate: goal.projectedStartDate,
      projectedEndDate: goal.projectedEndDate,
      actualStartDate: goal.actualStartDate,
      actualEndDate: goal.actualEndDate,
      status: goal.status,
      percentComplete: goal.percentComplete,
      orderIndex: goal.orderIndex,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      deletedAt: goal.deletedAt,
      deletedBy: goal.deletedBy,
      restoreUntil: goal.restoreUntil,
      purgeAt: goal.purgeAt,
    }));
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

async function getNextTaskOrderIndex(ownerUid: string, goalId: string) {
  const tasks = await dataRepository.listTasks(ownerUid, goalId, { includeDeleted: true });
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

function compareChildGoals(left: ChildGoal, right: ChildGoal) {
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
    parentGoalId: goal.parentGoalId,
    timeframeLevel: goal.timeframeLevel,
    title: goal.title,
    description: goal.description,
    projectedStartDate: goal.projectedStartDate,
    projectedEndDate: goal.projectedEndDate,
    timeframeLabel: goal.timeframe,
    isFocus: goal.isFocus,
  });
}

function normalizeGoalDefaults(goal: Goal): Goal {
  if (!goal.timeframeLevel) {
    throw new Error("Goal timeframe level is required.");
  }

  return {
    ...goal,
    parentGoalId: goal.parentGoalId ?? null,
    timeframeLevel: goal.timeframeLevel,
  };
}

function normalizeTaskDefaults(task: Task): Task {
  return {
    ...task,
    unplanned: task.unplanned ?? false,
  };
}

async function saveTaskViaApi(task: Task, isUpdate: boolean) {
  const path = isUpdate ? `/api/tasks/${task.id}` : "/api/tasks";
  const method = isUpdate ? "PATCH" : "POST";

  await invokeProtectedWrite(path, method, {
    goalId: task.goalId,
    title: task.title,
    notes: task.notes,
    dueDate: task.dueDate,
    unplanned: task.unplanned ?? false,
  });
}

async function createJournalEntryViaApi(input: SaveJournalEntryInput) {
  const response = await invokeProtectedWriteAndParse<{ journalEntry: JournalEntry }>("/api/journal", "POST", {
    title: input.title,
    content: input.content,
    mood: input.mood,
    tags: input.tags,
    relatedGoalId: input.relatedGoalId,
  });

  return response.journalEntry;
}

async function updateJournalEntryViaApi(journalEntryId: string, input: SaveJournalEntryInput) {
  const response = await invokeProtectedWriteAndParse<{ journalEntry: JournalEntry }>(
    `/api/journal/${journalEntryId}`,
    "PATCH",
    {
      title: input.title,
      content: input.content,
      mood: input.mood,
      tags: input.tags,
      relatedGoalId: input.relatedGoalId,
    },
  );

  return response.journalEntry;
}

async function archiveGoalViaApi(goalId: string) {
  await invokeProtectedWrite(`/api/goals/${goalId}/archive`, "PATCH", {});
}

async function restoreGoalViaApi(goalId: string) {
  await invokeProtectedWrite(`/api/goals/${goalId}/restore`, "PATCH", {});
}

async function permanentlyDeleteGoalViaApi(goalId: string) {
  await invokeProtectedWrite(`/api/goals/${goalId}`, "DELETE");
}

async function archiveChildGoalViaApi(childGoalId: string) {
  await invokeProtectedWrite(`/api/childGoals/${childGoalId}/archive`, "PATCH", {});
}

async function restoreChildGoalViaApi(childGoalId: string) {
  await invokeProtectedWrite(`/api/childGoals/${childGoalId}/restore`, "PATCH", {});
}

async function permanentlyDeleteChildGoalViaApi(childGoalId: string) {
  await invokeProtectedWrite(`/api/childGoals/${childGoalId}`, "DELETE");
}

async function archiveTaskViaApi(taskId: string) {
  await invokeProtectedWrite(`/api/tasks/${taskId}/archive`, "PATCH", {});
}

async function restoreTaskViaApi(taskId: string) {
  await invokeProtectedWrite(`/api/tasks/${taskId}/restore`, "PATCH", {});
}

async function permanentlyDeleteTaskViaApi(taskId: string) {
  await invokeProtectedWrite(`/api/tasks/${taskId}`, "DELETE");
}

async function archiveJournalEntryViaApi(journalEntryId: string) {
  const response = await invokeProtectedWriteAndParse<{ journalEntry: JournalEntry }>(
    `/api/journal/${journalEntryId}/archive`,
    "PATCH",
    {},
  );

  return response.journalEntry;
}

async function restoreJournalEntryViaApi(journalEntryId: string) {
  const response = await invokeProtectedWriteAndParse<{ journalEntry: JournalEntry }>(
    `/api/journal/${journalEntryId}/restore`,
    "PATCH",
    {},
  );

  return response.journalEntry;
}

async function permanentlyDeleteJournalEntryViaApi(journalEntryId: string) {
  await invokeProtectedWrite(`/api/journal/${journalEntryId}`, "DELETE");
}

async function saveHabitViaApi(habit: Habit, isUpdate: boolean) {
  const path = isUpdate ? `/api/habits/${habit.id}` : "/api/habits";
  const method = isUpdate ? "PATCH" : "POST";

  const response = await invokeProtectedWriteAndParse<{ habit: Habit }>(path, method, {
    title: habit.title,
    cadence: habit.cadence,
    targetCount: habit.targetCount,
    status: habit.status,
  });

  return response.habit;
}

async function archiveHabitViaApi(habitId: string) {
  const response = await invokeProtectedWriteAndParse<{ habit: Habit }>(`/api/habits/${habitId}/archive`, "PATCH", {});
  return response.habit;
}

async function restoreHabitViaApi(habitId: string) {
  const response = await invokeProtectedWriteAndParse<{ habit: Habit }>(`/api/habits/${habitId}/restore`, "PATCH", {});
  return response.habit;
}

async function permanentlyDeleteHabitViaApi(habitId: string) {
  await invokeProtectedWrite(`/api/habits/${habitId}`, "DELETE");
}

async function saveHabitCheckinViaApi(checkin: HabitCheckin, isUpdate: boolean) {
  const path = isUpdate
    ? `/api/habits/${checkin.habitId}/checkins/${checkin.id}`
    : `/api/habits/${checkin.habitId}/checkins`;
  const method = isUpdate ? "PATCH" : "POST";

  const response = await invokeProtectedWriteAndParse<{ checkin: HabitCheckin }>(path, method, {
    checkInDate: checkin.checkInDate,
    notes: checkin.notes,
  });

  return response.checkin;
}

async function deleteHabitCheckinViaApi(habitId: string, checkinId: string) {
  await invokeProtectedWrite(`/api/habits/${habitId}/checkins/${checkinId}`, "DELETE");
}

async function invokeProtectedWrite(path: string, method: "POST" | "PATCH" | "DELETE", payload?: unknown) {
  const hasBody = typeof payload !== "undefined";
  const response = await fetch(path, {
    method,
    headers: hasBody
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    credentials: "include",
    body: hasBody ? JSON.stringify(payload) : undefined,
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

async function invokeProtectedWriteAndParse<TResponse>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  payload?: unknown,
) {
  const hasBody = typeof payload !== "undefined";
  const response = await fetch(path, {
    method,
    headers: hasBody
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    credentials: "include",
    body: hasBody ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
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

  return (await response.json()) as TResponse;
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
      case "permanentlyDeleteGoal": {
        const payload = mutation.payload as GoalPermanentDeleteInput;
        await dataRepository.permanentlyDeleteGoal(payload.ownerUid, payload.goalId);
        return;
      }
      case "saveChildGoal":
        await dataRepository.saveChildGoal(mutation.payload as SaveChildGoalInput);
        return;
      case "updateChildGoalStatus": {
        const payload = mutation.payload as ChildGoalStatusUpdateInput;
        await dataRepository.updateChildGoalStatus(payload.ownerUid, payload.childGoalId, payload.status);
        return;
      }
      case "reorderChildGoals": {
        const payload = mutation.payload as ChildGoalReorderInput;
        await dataRepository.reorderChildGoals(payload.ownerUid, payload.goalId, payload.orderedChildGoalIds);
        return;
      }
      case "softDeleteChildGoal": {
        const payload = mutation.payload as ChildGoalArchiveInput;
        await dataRepository.softDeleteChildGoal(payload.ownerUid, payload.childGoalId);
        return;
      }
      case "restoreChildGoal": {
        const payload = mutation.payload as ChildGoalArchiveInput;
        await dataRepository.restoreChildGoal(payload.ownerUid, payload.childGoalId);
        return;
      }
      case "permanentlyDeleteChildGoal": {
        const payload = mutation.payload as ChildGoalPermanentDeleteInput;
        await dataRepository.permanentlyDeleteChildGoal(payload.ownerUid, payload.childGoalId);
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
        await dataRepository.reorderTasks(payload.ownerUid, payload.goalId, payload.orderedTaskIds);
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
      case "permanentlyDeleteTask": {
        const payload = mutation.payload as TaskPermanentDeleteInput;
        await dataRepository.permanentlyDeleteTask(payload.ownerUid, payload.taskId);
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
      case "permanentlyDeleteJournalEntry": {
        const payload = mutation.payload as JournalPermanentDeleteInput;
        await dataRepository.permanentlyDeleteJournalEntry(payload.ownerUid, payload.journalEntryId);
        return;
      }
      case "saveHabit":
        await dataRepository.saveHabit(mutation.payload as SaveHabitInput);
        return;
      case "softDeleteHabit": {
        const payload = mutation.payload as HabitArchiveInput;
        await dataRepository.softDeleteHabit(payload.ownerUid, payload.habitId);
        return;
      }
      case "restoreHabit": {
        const payload = mutation.payload as HabitArchiveInput;
        await dataRepository.restoreHabit(payload.ownerUid, payload.habitId);
        return;
      }
      case "permanentlyDeleteHabit": {
        const payload = mutation.payload as HabitPermanentDeleteInput;
        await dataRepository.permanentlyDeleteHabit(payload.ownerUid, payload.habitId);
        return;
      }
      case "saveHabitCheckin":
        await dataRepository.saveHabitCheckin(mutation.payload as SaveHabitCheckinInput);
        return;
      case "deleteHabitCheckin": {
        const payload = mutation.payload as HabitCheckinDeleteInput;
        await dataRepository.deleteHabitCheckin(payload.ownerUid, payload.habitId, payload.checkinId);
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

