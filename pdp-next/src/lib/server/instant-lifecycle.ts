import { env } from "@/lib/config/env";
import type { Subgoal, Task } from "@/lib/domain/types";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import {
  findOwnedGoal,
  findOwnedSubgoal,
  findOwnedTask,
} from "@/lib/server/instant-route";

type SoftDeleteLifecycle = {
  restoreUntil: string;
  purgeAt: string;
};

type PurgeSummary = {
  goals: number;
  subgoals: number;
  tasks: number;
  purgedAt: string;
};

export async function archiveGoal(ownerUid: string, goalId: string) {
  const instantAdmin = getInstantAdmin();
  const goal = await findOwnedGoal(ownerUid, goalId);

  if (goal.deletedAt) {
    return goal;
  }

  const now = new Date().toISOString();
  const lifecycle = buildSoftDeleteLifecycle(now);
  const subgoals = await listOwnedSubgoals(ownerUid, goalId);
  const taskGroups = await Promise.all(
    subgoals.map((subgoal) => listOwnedTasks(ownerUid, subgoal.id)),
  );
  const tasks = taskGroups.flat();

  const goalMutation = instantAdmin.tx.goals[goalId].update({
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
      instantAdmin.tx.subgoals[subgoal.id].update({
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
      instantAdmin.tx.tasks[task.id].update({
        deletedAt: now,
        deletedBy: ownerUid,
        restoreUntil: lifecycle.restoreUntil,
        purgeAt: lifecycle.purgeAt,
        updatedAt: now,
      }),
    );

  await instantAdmin.transact([goalMutation, ...subgoalMutations, ...taskMutations]);

  return {
    ...goal,
    deletedAt: now,
    deletedBy: ownerUid,
    restoreUntil: lifecycle.restoreUntil,
    purgeAt: lifecycle.purgeAt,
    updatedAt: now,
    isFocus: false,
  };
}

export async function restoreGoal(ownerUid: string, goalId: string) {
  const instantAdmin = getInstantAdmin();
  const goal = await findOwnedGoal(ownerUid, goalId);

  if (!goal.deletedAt) {
    return goal;
  }

  assertRestoreWindowOpen(goal.restoreUntil, "Goal");

  const now = new Date().toISOString();
  const cascadeDeletedAt = goal.deletedAt;
  const subgoals = await listOwnedSubgoals(ownerUid, goalId);
  const subgoalsToRestore = subgoals.filter((subgoal) =>
    shouldRestoreCascadeEntity(subgoal.deletedAt, cascadeDeletedAt),
  );
  const taskGroups = await Promise.all(
    subgoalsToRestore.map((subgoal) => listOwnedTasks(ownerUid, subgoal.id)),
  );
  const tasks = taskGroups.flat();

  const goalMutation = instantAdmin.tx.goals[goalId].update({
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
  });

  const subgoalMutations = subgoalsToRestore.map((subgoal) =>
    instantAdmin.tx.subgoals[subgoal.id].update({
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
      instantAdmin.tx.tasks[task.id].update({
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
        updatedAt: now,
      }),
    );

  await instantAdmin.transact([goalMutation, ...subgoalMutations, ...taskMutations]);

  return {
    ...goal,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
  };
}

export async function archiveSubgoal(ownerUid: string, subgoalId: string) {
  const instantAdmin = getInstantAdmin();
  const subgoal = await findOwnedSubgoal(ownerUid, subgoalId);

  if (subgoal.deletedAt) {
    return subgoal;
  }

  const now = new Date().toISOString();
  const lifecycle = buildSoftDeleteLifecycle(now);
  const tasks = await listOwnedTasks(ownerUid, subgoalId);

  const subgoalMutation = instantAdmin.tx.subgoals[subgoalId].update({
    deletedAt: now,
    deletedBy: ownerUid,
    restoreUntil: lifecycle.restoreUntil,
    purgeAt: lifecycle.purgeAt,
    updatedAt: now,
  });

  const taskMutations = tasks
    .filter((task) => !task.deletedAt)
    .map((task) =>
      instantAdmin.tx.tasks[task.id].update({
        deletedAt: now,
        deletedBy: ownerUid,
        restoreUntil: lifecycle.restoreUntil,
        purgeAt: lifecycle.purgeAt,
        updatedAt: now,
      }),
    );

  await instantAdmin.transact([subgoalMutation, ...taskMutations]);

  return {
    ...subgoal,
    deletedAt: now,
    deletedBy: ownerUid,
    restoreUntil: lifecycle.restoreUntil,
    purgeAt: lifecycle.purgeAt,
    updatedAt: now,
  };
}

export async function restoreSubgoal(ownerUid: string, subgoalId: string) {
  const instantAdmin = getInstantAdmin();
  const subgoal = await findOwnedSubgoal(ownerUid, subgoalId);

  if (!subgoal.deletedAt) {
    return subgoal;
  }

  assertRestoreWindowOpen(subgoal.restoreUntil, "Subgoal");

  const now = new Date().toISOString();
  const cascadeDeletedAt = subgoal.deletedAt;
  const tasks = await listOwnedTasks(ownerUid, subgoalId);

  const subgoalMutation = instantAdmin.tx.subgoals[subgoalId].update({
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
  });

  const taskMutations = tasks
    .filter((task) => shouldRestoreCascadeEntity(task.deletedAt, cascadeDeletedAt))
    .map((task) =>
      instantAdmin.tx.tasks[task.id].update({
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
        updatedAt: now,
      }),
    );

  await instantAdmin.transact([subgoalMutation, ...taskMutations]);

  return {
    ...subgoal,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
  };
}

export async function archiveTask(ownerUid: string, taskId: string) {
  const instantAdmin = getInstantAdmin();
  const task = await findOwnedTask(ownerUid, taskId);

  if (task.deletedAt) {
    return task;
  }

  const now = new Date().toISOString();
  const lifecycle = buildSoftDeleteLifecycle(now);

  await instantAdmin.transact(
    instantAdmin.tx.tasks[taskId].update({
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
}

export async function restoreTask(ownerUid: string, taskId: string) {
  const instantAdmin = getInstantAdmin();
  const task = await findOwnedTask(ownerUid, taskId);

  if (!task.deletedAt) {
    return task;
  }

  assertRestoreWindowOpen(task.restoreUntil, "Task");

  const now = new Date().toISOString();

  await instantAdmin.transact(
    instantAdmin.tx.tasks[taskId].update({
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
}

export async function purgeExpiredOwnedData(ownerUid: string): Promise<PurgeSummary> {
  const instantAdmin = getInstantAdmin();
  const nowIso = new Date().toISOString();

  const [{ goals = [] }, { subgoals = [] }, { tasks = [] }] = await Promise.all([
    instantAdmin.query({
      goals: {
        $: {
          where: {
            ownerUid,
          },
        },
      },
    }),
    instantAdmin.query({
      subgoals: {
        $: {
          where: {
            ownerUid,
          },
        },
      },
    }),
    instantAdmin.query({
      tasks: {
        $: {
          where: {
            ownerUid,
          },
        },
      },
    }),
  ]);

  const expiredGoalIds = new Set(
    (goals as Array<{ id: string; deletedAt: string | null; purgeAt: string | null }>).
      filter((goal) => isExpiredSoftDeletedEntity(goal.deletedAt, goal.purgeAt, nowIso))
      .map((goal) => goal.id),
  );

  const expiredSubgoalIds = new Set(
    (subgoals as Array<{ id: string; goalId: string; deletedAt: string | null; purgeAt: string | null }>).
      filter(
        (subgoal) =>
          isExpiredSoftDeletedEntity(subgoal.deletedAt, subgoal.purgeAt, nowIso) || expiredGoalIds.has(subgoal.goalId),
      )
      .map((subgoal) => subgoal.id),
  );

  const expiredTaskIds = new Set(
    (tasks as Array<{ id: string; subgoalId: string; deletedAt: string | null; purgeAt: string | null }>).
      filter(
        (task) => isExpiredSoftDeletedEntity(task.deletedAt, task.purgeAt, nowIso) || expiredSubgoalIds.has(task.subgoalId),
      )
      .map((task) => task.id),
  );

  const deleteMutations = [
    ...Array.from(expiredTaskIds, (taskId) => instantAdmin.tx.tasks[taskId].delete()),
    ...Array.from(expiredSubgoalIds, (subgoalId) => instantAdmin.tx.subgoals[subgoalId].delete()),
    ...Array.from(expiredGoalIds, (goalId) => instantAdmin.tx.goals[goalId].delete()),
  ];

  if (deleteMutations.length > 0) {
    await instantAdmin.transact(deleteMutations);
  }

  return {
    goals: expiredGoalIds.size,
    subgoals: expiredSubgoalIds.size,
    tasks: expiredTaskIds.size,
    purgedAt: nowIso,
  };
}

async function listOwnedSubgoals(ownerUid: string, goalId: string) {
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

  return subgoals as Subgoal[];
}

async function listOwnedTasks(ownerUid: string, subgoalId: string) {
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

  return tasks as Task[];
}

function buildSoftDeleteLifecycle(nowIso: string): SoftDeleteLifecycle {
  const restoreUntil = new Date(nowIso);
  restoreUntil.setDate(restoreUntil.getDate() + env.softDeleteRetentionDays);

  return {
    restoreUntil: restoreUntil.toISOString(),
    purgeAt: restoreUntil.toISOString(),
  };
}

function shouldRestoreCascadeEntity(entityDeletedAt: string | null, parentDeletedAt: string) {
  return entityDeletedAt === parentDeletedAt;
}

function assertRestoreWindowOpen(restoreUntil: string | null, entityLabel: string) {
  const expiry = restoreUntil ? Date.parse(restoreUntil) : Number.NaN;

  if (Number.isNaN(expiry) || expiry < Date.now()) {
    throw new InstantRouteBadRequestError(
      `${entityLabel} can no longer be restored because the restore window has expired.`,
    );
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