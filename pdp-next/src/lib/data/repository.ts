import { id, type InstaQLParams, type InstantUnknownSchemaDef } from "@instantdb/react";
import { db, isInstantConfigured } from "@/lib/instantdb/client";
import { statusToPercent } from "@/lib/domain/status";
import type { Goal, GoalType, JournalEntry, Subgoal, Task, UserProfile } from "@/lib/domain/types";

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

export type DataRepository = {
  listGoals: (ownerUid: string, type: GoalType) => Promise<Goal[]>;
  saveGoal: (input: SaveGoalInput) => Promise<Goal>;
  listSubgoals: (ownerUid: string, goalId: string) => Promise<Subgoal[]>;
  listTasks: (ownerUid: string, subgoalId: string) => Promise<Task[]>;
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
  async listGoals(ownerUid, type) {
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

    return [...(data.goals ?? [])].sort(compareGoals);
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
  async listSubgoals(ownerUid, goalId) {
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

    return [...(data.subgoals ?? [])].sort(compareSubgoals);
  },
  async listTasks(ownerUid, subgoalId) {
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

    return [...(data.tasks ?? [])].sort(compareTasks);
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

async function getNextGoalOrderIndex(ownerUid: string, type: GoalType) {
  const goals = await dataRepository.listGoals(ownerUid, type);
  return goals.length;
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
