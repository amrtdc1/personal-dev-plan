import { env } from "@/lib/config/env";
import type { Habit, Task } from "@/lib/domain/types";
import { getTaskParentGoalId } from "@/lib/domain/types";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import {
  findOwnedGoal,
  findOwnedHabit,
  findOwnedJournalEntry,
  findOwnedChildGoal,
  findOwnedTask,
} from "@/lib/server/instant-route";

type SoftDeleteLifecycle = {
  restoreUntil: string;
  purgeAt: string;
};

type PurgeSummary = {
  goals: number;
  childGoals: number;
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
  const childGoals = await listOwnedChildGoals(ownerUid, goalId);
  const taskGroups = await Promise.all(
    childGoals.map((childGoal) => listOwnedTasks(ownerUid, childGoal.id)),
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

  const childGoalMutations = childGoals
    .filter((childGoal) => !childGoal.deletedAt)
    .map((childGoal) =>
      instantAdmin.tx.goals[childGoal.id].update({
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

  await instantAdmin.transact([goalMutation, ...childGoalMutations, ...taskMutations]);

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
  const childGoals = await listOwnedChildGoals(ownerUid, goalId);
  const childGoalsToRestore = childGoals.filter((childGoal) =>
    shouldRestoreCascadeEntity(childGoal.deletedAt, cascadeDeletedAt),
  );
  const taskGroups = await Promise.all(
    childGoalsToRestore.map((childGoal) => listOwnedTasks(ownerUid, childGoal.id)),
  );
  const tasks = taskGroups.flat();

  const goalMutation = instantAdmin.tx.goals[goalId].update({
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
  });

  const childGoalMutations = childGoalsToRestore.map((childGoal) =>
    instantAdmin.tx.goals[childGoal.id].update({
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

  await instantAdmin.transact([goalMutation, ...childGoalMutations, ...taskMutations]);

  return {
    ...goal,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
  };
}

export async function archiveChildGoal(ownerUid: string, childGoalId: string) {
  const instantAdmin = getInstantAdmin();
  const childGoal = await findOwnedChildGoal(ownerUid, childGoalId);

  if (childGoal.deletedAt) {
    return childGoal;
  }

  const now = new Date().toISOString();
  const lifecycle = buildSoftDeleteLifecycle(now);
  const tasks = await listOwnedTasks(ownerUid, childGoalId);

  const childGoalMutation = instantAdmin.tx.goals[childGoalId].update({
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

  await instantAdmin.transact([childGoalMutation, ...taskMutations]);

  return {
    ...childGoal,
    deletedAt: now,
    deletedBy: ownerUid,
    restoreUntil: lifecycle.restoreUntil,
    purgeAt: lifecycle.purgeAt,
    updatedAt: now,
  };
}

export async function restoreChildGoal(ownerUid: string, childGoalId: string) {
  const instantAdmin = getInstantAdmin();
  const childGoal = await findOwnedChildGoal(ownerUid, childGoalId);

  if (!childGoal.deletedAt) {
    return childGoal;
  }

  assertRestoreWindowOpen(childGoal.restoreUntil, "ChildGoal");

  const now = new Date().toISOString();
  const cascadeDeletedAt = childGoal.deletedAt;
  const tasks = await listOwnedTasks(ownerUid, childGoalId);

  const childGoalMutation = instantAdmin.tx.goals[childGoalId].update({
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

  await instantAdmin.transact([childGoalMutation, ...taskMutations]);

  return {
    ...childGoal,
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

export async function archiveJournalEntry(ownerUid: string, journalEntryId: string) {
  const instantAdmin = getInstantAdmin();
  const journalEntry = await findOwnedJournalEntry(ownerUid, journalEntryId);

  if (journalEntry.deletedAt) {
    return journalEntry;
  }

  const now = new Date().toISOString();
  const lifecycle = buildSoftDeleteLifecycle(now);

  await instantAdmin.transact(
    instantAdmin.tx.journalEntries[journalEntryId].update({
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
    }),
  );

  return {
    ...journalEntry,
    deletedAt: now,
    deletedBy: ownerUid,
    restoreUntil: lifecycle.restoreUntil,
    purgeAt: lifecycle.purgeAt,
    updatedAt: now,
  };
}

export async function restoreJournalEntry(ownerUid: string, journalEntryId: string) {
  const instantAdmin = getInstantAdmin();
  const journalEntry = await findOwnedJournalEntry(ownerUid, journalEntryId);

  if (!journalEntry.deletedAt) {
    return journalEntry;
  }

  assertRestoreWindowOpen(journalEntry.restoreUntil, "Journal entry");

  const now = new Date().toISOString();

  await instantAdmin.transact(
    instantAdmin.tx.journalEntries[journalEntryId].update({
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
    }),
  );

  return {
    ...journalEntry,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
  };
}

export async function archiveHabit(ownerUid: string, habitId: string) {
  const instantAdmin = getInstantAdmin();
  const habit = await findOwnedHabit(ownerUid, habitId);

  if (habit.deletedAt) {
    return habit;
  }

  const now = new Date().toISOString();
  const lifecycle = buildSoftDeleteLifecycle(now);

  await instantAdmin.transact(
    instantAdmin.tx.habits[habitId].update({
      deletedAt: now,
      deletedBy: ownerUid,
      restoreUntil: lifecycle.restoreUntil,
      purgeAt: lifecycle.purgeAt,
      updatedAt: now,
      status: "archived",
    }),
  );

  return {
    ...habit,
    deletedAt: now,
    deletedBy: ownerUid,
    restoreUntil: lifecycle.restoreUntil,
    purgeAt: lifecycle.purgeAt,
    updatedAt: now,
    status: "archived" as Habit["status"],
  };
}

export async function restoreHabit(ownerUid: string, habitId: string) {
  const instantAdmin = getInstantAdmin();
  const habit = await findOwnedHabit(ownerUid, habitId);

  if (!habit.deletedAt) {
    return habit;
  }

  assertRestoreWindowOpen(habit.restoreUntil, "Habit");

  const now = new Date().toISOString();

  await instantAdmin.transact(
    instantAdmin.tx.habits[habitId].update({
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
      updatedAt: now,
      status: "active",
    }),
  );

  return {
    ...habit,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    updatedAt: now,
    status: "active" as Habit["status"],
  };
}

export async function permanentlyDeleteGoal(ownerUid: string, goalId: string) {
  const instantAdmin = getInstantAdmin();
  const goal = await findOwnedGoal(ownerUid, goalId);

  if (!goal.deletedAt) {
    throw new InstantRouteBadRequestError("Goal must be archived before permanent deletion.");
  }

  const childGoals = await listOwnedChildGoals(ownerUid, goalId);
  const taskGroups = await Promise.all(
    childGoals.map((childGoal) => listOwnedTasks(ownerUid, childGoal.id)),
  );
  const tasks = taskGroups.flat();

  const deleteMutations = [
    ...tasks.map((task) => instantAdmin.tx.tasks[task.id].delete()),
    ...childGoals.map((childGoal) => instantAdmin.tx.goals[childGoal.id].delete()),
    instantAdmin.tx.goals[goalId].delete(),
  ];

  if (deleteMutations.length > 0) {
    await instantAdmin.transact(deleteMutations);
  }

  return {
    deletedGoalId: goalId,
    deletedChildGoals: childGoals.length,
    deletedTasks: tasks.length,
  };
}

export async function permanentlyDeleteChildGoal(ownerUid: string, childGoalId: string) {
  const instantAdmin = getInstantAdmin();
  const childGoal = await findOwnedChildGoal(ownerUid, childGoalId);

  if (!childGoal.deletedAt) {
    throw new InstantRouteBadRequestError("ChildGoal must be archived before permanent deletion.");
  }

  const tasks = await listOwnedTasks(ownerUid, childGoalId);

  const deleteMutations = [
    ...tasks.map((task) => instantAdmin.tx.tasks[task.id].delete()),
    instantAdmin.tx.goals[childGoalId].delete(),
  ];

  if (deleteMutations.length > 0) {
    await instantAdmin.transact(deleteMutations);
  }

  return {
    deletedChildGoalId: childGoalId,
    deletedTasks: tasks.length,
  };
}

export async function permanentlyDeleteTask(ownerUid: string, taskId: string) {
  const instantAdmin = getInstantAdmin();
  const task = await findOwnedTask(ownerUid, taskId);

  if (!task.deletedAt) {
    throw new InstantRouteBadRequestError("Task must be archived before permanent deletion.");
  }

  await instantAdmin.transact(instantAdmin.tx.tasks[taskId].delete());

  return {
    deletedTaskId: taskId,
  };
}

export async function permanentlyDeleteJournalEntry(ownerUid: string, journalEntryId: string) {
  const instantAdmin = getInstantAdmin();
  const journalEntry = await findOwnedJournalEntry(ownerUid, journalEntryId);

  if (!journalEntry.deletedAt) {
    throw new InstantRouteBadRequestError("Journal entry must be archived before permanent deletion.");
  }

  await instantAdmin.transact(instantAdmin.tx.journalEntries[journalEntryId].delete());

  return {
    deletedJournalEntryId: journalEntryId,
  };
}

export async function permanentlyDeleteHabit(ownerUid: string, habitId: string) {
  const instantAdmin = getInstantAdmin();
  const habit = await findOwnedHabit(ownerUid, habitId);

  if (!habit.deletedAt) {
    throw new InstantRouteBadRequestError("Habit must be archived before permanent deletion.");
  }

  const { habitCheckins = [] } = await instantAdmin.query({
    habitCheckins: {
      $: {
        where: {
          ownerUid,
          habitId,
        },
      },
    },
  });

  const deleteMutations = [
    ...(habitCheckins as Array<{ id: string }>).map((checkin) => instantAdmin.tx.habitCheckins[checkin.id].delete()),
    instantAdmin.tx.habits[habitId].delete(),
  ];

  await instantAdmin.transact(deleteMutations);

  return {
    deletedHabitId: habitId,
    deletedCheckins: habitCheckins.length,
  };
}

export async function purgeExpiredOwnedData(ownerUid: string): Promise<PurgeSummary> {
  const instantAdmin = getInstantAdmin();
  const nowIso = new Date().toISOString();

  const [{ goals = [] }, { goals: childGoals = [] }, { tasks = [] }] = await Promise.all([
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
      goals: {
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

  const expiredChildGoalIds = new Set(
    (childGoals as Array<{ id: string; parentGoalId: string | null; deletedAt: string | null; purgeAt: string | null }>).
      filter(
        (childGoal) =>
          isExpiredSoftDeletedEntity(childGoal.deletedAt, childGoal.purgeAt, nowIso) ||
          (childGoal.parentGoalId ? expiredGoalIds.has(childGoal.parentGoalId) : false),
      )
      .map((childGoal) => childGoal.id),
  );

  const expiredTaskIds = new Set(
    (tasks as Task[])
      .filter((task) => {
        if (isExpiredSoftDeletedEntity(task.deletedAt, task.purgeAt, nowIso)) {
          return true;
        }

        const parentGoalId = getTaskParentGoalId(task);
        return parentGoalId ? expiredChildGoalIds.has(parentGoalId) : false;
      })
      .map((task) => task.id),
  );

  const deleteMutations = [
    ...Array.from(expiredTaskIds, (taskId) => instantAdmin.tx.tasks[taskId].delete()),
    ...Array.from(expiredChildGoalIds, (childGoalId) => instantAdmin.tx.goals[childGoalId].delete()),
    ...Array.from(expiredGoalIds, (goalId) => instantAdmin.tx.goals[goalId].delete()),
  ];

  if (deleteMutations.length > 0) {
    await instantAdmin.transact(deleteMutations);
  }

  return {
    goals: expiredGoalIds.size,
    childGoals: expiredChildGoalIds.size,
    tasks: expiredTaskIds.size,
    purgedAt: nowIso,
  };
}

async function listOwnedChildGoals(ownerUid: string, goalId: string) {
  const instantAdmin = getInstantAdmin();
  const { goals = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: {
          ownerUid,
          parentGoalId: goalId,
        },
      },
    },
  });

  return (goals as Array<{
    id: string;
    ownerUid: string;
    title: string;
    description: string;
    timeframe: string;
    projectedStartDate: string | null;
    projectedEndDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
    status: Task["status"];
    percentComplete: number;
    orderIndex: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    deletedBy: string | null;
    restoreUntil: string | null;
    purgeAt: string | null;
  }>).map((goal) => ({
    ...goal,
    goalId,
  }));
}

async function listOwnedTasks(ownerUid: string, parentGoalId: string) {
  const instantAdmin = getInstantAdmin();
  const { tasks = [] } = await instantAdmin.query({
    tasks: {
      $: {
        where: {
          ownerUid,
          parentGoalId,
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
