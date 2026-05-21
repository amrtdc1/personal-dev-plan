import { id, type InstaQLParams, type InstantUnknownSchemaDef } from "@instantdb/react";
import { db, isInstantConfigured } from "@/lib/instantdb/client";
import { env } from "@/lib/config/env";
import { statusToPercent } from "@/lib/domain/status";
import type { Goal, GoalType, JournalEntry, Subgoal, Task, UserProfile } from "@/lib/domain/types";

type ListOptions = {
  includeDeleted?: boolean;
};

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

export type DataRepository = {
  listGoals: (ownerUid: string, type: GoalType, options?: ListOptions) => Promise<Goal[]>;
  saveGoal: (input: SaveGoalInput) => Promise<Goal>;
  softDeleteGoal: (ownerUid: string, goalId: string) => Promise<Goal>;
  restoreGoal: (ownerUid: string, goalId: string) => Promise<Goal>;
  listSubgoals: (ownerUid: string, goalId: string, options?: ListOptions) => Promise<Subgoal[]>;
  saveSubgoal: (input: SaveSubgoalInput) => Promise<Subgoal>;
  softDeleteSubgoal: (ownerUid: string, subgoalId: string) => Promise<Subgoal>;
  restoreSubgoal: (ownerUid: string, subgoalId: string) => Promise<Subgoal>;
  listTasks: (ownerUid: string, subgoalId: string, options?: ListOptions) => Promise<Task[]>;
  saveTask: (input: SaveTaskInput) => Promise<Task>;
  softDeleteTask: (ownerUid: string, taskId: string) => Promise<Task>;
  restoreTask: (ownerUid: string, taskId: string) => Promise<Task>;
  listJournalEntries: (ownerUid: string) => Promise<JournalEntry[]>;
  getUserProfile: (ownerUid: string) => Promise<UserProfile | null>;
};

export class UnsupportedRepositoryError extends Error {
  constructor(message = "Data repository has not been wired yet.") {
    super(message);
    this.name = "UnsupportedRepositoryError";
  }
}

export const dataRepository: DataRepository = {
  async listGoals(ownerUid, type, options) {
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
    const trimmedTitle = input.title.trim();
    const trimmedDescription = input.description.trim();

    if (!trimmedTitle) {
      throw new Error("Goal title is required.");
    }

    if (input.projectedStartDate && input.projectedEndDate) {
      if (input.projectedStartDate > input.projectedEndDate) {
        throw new Error("Projected end date must be on or after the start date.");
      }
    }

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

    return goal;
  },
  async softDeleteGoal(ownerUid, goalId) {
    ensureClientMutationSupport();

    const goal = await findGoalById(ownerUid, goalId);
    if (!goal) {
      throw new Error("Goal was not found for this user.");
    }

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

    await db.transact([goalMutation, ...subgoalMutations, ...taskMutations]);

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

    const goal = await findGoalById(ownerUid, goalId);
    if (!goal) {
      throw new Error("Goal was not found for this user.");
    }

    if (!goal.deletedAt) {
      return goal;
    }

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

    await db.transact([goalMutation, ...subgoalMutations, ...taskMutations]);

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
    const trimmedTitle = input.title.trim();
    const trimmedDescription = input.description.trim();

    if (!trimmedTitle) {
      throw new Error("Subgoal title is required.");
    }

    if (input.projectedStartDate && input.projectedEndDate) {
      if (input.projectedStartDate > input.projectedEndDate) {
        throw new Error("Projected end date must be on or after the start date.");
      }
    }

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

    return subgoal;
  },
  async softDeleteSubgoal(ownerUid, subgoalId) {
    ensureClientMutationSupport();

    const subgoal = await findSubgoalById(ownerUid, subgoalId);
    if (!subgoal) {
      throw new Error("Subgoal was not found for this user.");
    }

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

    await db.transact([subgoalMutation, ...taskMutations]);

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

    const subgoal = await findSubgoalById(ownerUid, subgoalId);
    if (!subgoal) {
      throw new Error("Subgoal was not found for this user.");
    }

    if (!subgoal.deletedAt) {
      return subgoal;
    }

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

    await db.transact([subgoalMutation, ...taskMutations]);

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
    const trimmedTitle = input.title.trim();
    const trimmedNotes = input.notes.trim();

    if (!trimmedTitle) {
      throw new Error("Task title is required.");
    }

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

    return task;
  },
  async softDeleteTask(ownerUid, taskId) {
    ensureClientMutationSupport();

    const task = await findTaskById(ownerUid, taskId);
    if (!task) {
      throw new Error("Task was not found for this user.");
    }

    if (task.deletedAt) {
      return task;
    }

    const now = new Date().toISOString();
    const lifecycle = buildSoftDeleteLifecycle(now);

    await db.transact(
      db.tx.tasks[taskId].update({
        deletedAt: now,
        deletedBy: ownerUid,
        restoreUntil: lifecycle.restoreUntil,
        purgeAt: lifecycle.purgeAt,
        updatedAt: now,
      }),
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

    const task = await findTaskById(ownerUid, taskId);
    if (!task) {
      throw new Error("Task was not found for this user.");
    }

    if (!task.deletedAt) {
      return task;
    }

    const now = new Date().toISOString();

    await db.transact(
      db.tx.tasks[taskId].update({
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
        updatedAt: now,
      }),
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
  async listJournalEntries() {
    throw new UnsupportedRepositoryError();
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

async function runClientQuery<
  TData,
  TQuery extends InstaQLParams<InstantUnknownSchemaDef> = InstaQLParams<InstantUnknownSchemaDef>,
>(query: TQuery) {
  if (!isInstantConfigured) {
    throw new UnsupportedRepositoryError("InstantDB is not configured.");
  }

  if (typeof window === "undefined") {
    throw new UnsupportedRepositoryError(
      "InstantDB repository reads must run in a client component. Use the admin API for server-side reads.",
    );
  }

  const result = await db.queryOnce(query);
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
