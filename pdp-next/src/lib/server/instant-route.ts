import { NextResponse } from "next/server";
import type { Goal, Habit, HabitCheckin, ItemStatus, JournalEntry, Task } from "@/lib/domain/types";
import { validateStatusUpdate } from "@/lib/data/validation";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { resolveInstantRouteError } from "@/lib/server/instant-error-response";
import {
  InstantRouteBadRequestError,
  InstantRouteNotFoundError,
} from "@/lib/server/instant-errors";
import { logApiFailure } from "@/lib/observability/telemetry";

type StatusUpdatePayload = {
  status?: ItemStatus;
};

export function requireRouteParam(value: string, label: string) {
  if (!value) {
    throw new InstantRouteBadRequestError(`${label} is required.`);
  }
}

export async function parseStatusUpdatePayload(request: Request) {
  let payload: StatusUpdatePayload;

  try {
    payload = (await request.json()) as StatusUpdatePayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }

  if (!payload.status) {
    throw new InstantRouteBadRequestError("Status is required.");
  }

  validateStatusUpdate(payload.status);
  return payload.status;
}

export async function findOwnedGoal(ownerUid: string, goalId: string) {
  const instantAdmin = getInstantAdmin();
  const { goals = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const scopedGoal = (goals as Goal[]).find((entry) => entry.id === goalId);
  if (scopedGoal && scopedGoal.ownerUid === ownerUid) {
    return scopedGoal;
  }

  // Fallback lookup by id handles edge cases where scoped query misses the target row.
  const { goals: goalById = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: {
          id: goalId,
        },
      },
    },
  });

  const goal = goalById[0] as Goal | undefined;
  if (!goal || goal.ownerUid !== ownerUid) {
    throw new InstantRouteNotFoundError("Goal was not found for this user.");
  }

  return goal;
}

export async function findOwnedChildGoal(ownerUid: string, childGoalId: string) {
  const instantAdmin = getInstantAdmin();
  const { goals = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const scopedChildGoalGoal = (goals as Goal[]).find((entry) => entry.id === childGoalId && Boolean(entry.parentGoalId));
  const scopedChildGoal = scopedChildGoalGoal
    ? {
        id: scopedChildGoalGoal.id,
        ownerUid: scopedChildGoalGoal.ownerUid,
        goalId: scopedChildGoalGoal.parentGoalId ?? "",
        title: scopedChildGoalGoal.title,
        description: scopedChildGoalGoal.description,
        timeframe: scopedChildGoalGoal.timeframe,
        projectedStartDate: scopedChildGoalGoal.projectedStartDate,
        projectedEndDate: scopedChildGoalGoal.projectedEndDate,
        actualStartDate: scopedChildGoalGoal.actualStartDate,
        actualEndDate: scopedChildGoalGoal.actualEndDate,
        status: scopedChildGoalGoal.status,
        percentComplete: scopedChildGoalGoal.percentComplete,
        orderIndex: scopedChildGoalGoal.orderIndex,
        createdAt: scopedChildGoalGoal.createdAt,
        updatedAt: scopedChildGoalGoal.updatedAt,
        deletedAt: scopedChildGoalGoal.deletedAt,
        deletedBy: scopedChildGoalGoal.deletedBy,
        restoreUntil: scopedChildGoalGoal.restoreUntil,
        purgeAt: scopedChildGoalGoal.purgeAt,
      }
    : null;
  if (scopedChildGoal && scopedChildGoal.ownerUid === ownerUid) {
    return scopedChildGoal;
  }

  const { goals: childGoalById = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: {
          id: childGoalId,
        },
      },
    },
  });

  const childGoalGoal = childGoalById[0] as Goal | undefined;
  if (!childGoalGoal || childGoalGoal.ownerUid !== ownerUid || !childGoalGoal.parentGoalId) {
    throw new InstantRouteNotFoundError("ChildGoal was not found for this user.");
  }

  return {
    id: childGoalGoal.id,
    ownerUid: childGoalGoal.ownerUid,
    goalId: childGoalGoal.parentGoalId,
    title: childGoalGoal.title,
    description: childGoalGoal.description,
    timeframe: childGoalGoal.timeframe,
    projectedStartDate: childGoalGoal.projectedStartDate,
    projectedEndDate: childGoalGoal.projectedEndDate,
    actualStartDate: childGoalGoal.actualStartDate,
    actualEndDate: childGoalGoal.actualEndDate,
    status: childGoalGoal.status,
    percentComplete: childGoalGoal.percentComplete,
    orderIndex: childGoalGoal.orderIndex,
    createdAt: childGoalGoal.createdAt,
    updatedAt: childGoalGoal.updatedAt,
    deletedAt: childGoalGoal.deletedAt,
    deletedBy: childGoalGoal.deletedBy,
    restoreUntil: childGoalGoal.restoreUntil,
    purgeAt: childGoalGoal.purgeAt,
  };
}

export async function findOwnedTask(ownerUid: string, taskId: string) {
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

  const scopedTask = (tasks as Task[]).map(normalizeTaskDefaults).find((entry) => entry.id === taskId);
  if (scopedTask && scopedTask.ownerUid === ownerUid) {
    return scopedTask;
  }

  const { tasks: taskById = [] } = await instantAdmin.query({
    tasks: {
      $: {
        where: {
          id: taskId,
        },
      },
    },
  });

  const task = (taskById[0] as Task | undefined);
  if (!task || task.ownerUid !== ownerUid) {
    throw new InstantRouteNotFoundError("Task was not found for this user.");
  }

  return normalizeTaskDefaults(task);
}

export async function findOwnedJournalEntry(ownerUid: string, journalEntryId: string) {
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

  const scopedEntry = (journalEntries as JournalEntry[]).find((entry) => entry.id === journalEntryId);
  if (scopedEntry && scopedEntry.ownerUid === ownerUid) {
    return scopedEntry;
  }

  const { journalEntries: entryById = [] } = await instantAdmin.query({
    journalEntries: {
      $: {
        where: {
          id: journalEntryId,
        },
      },
    },
  });

  const entry = entryById[0] as JournalEntry | undefined;
  if (!entry || entry.ownerUid !== ownerUid) {
    throw new InstantRouteNotFoundError("Journal entry was not found for this user.");
  }

  return entry;
}

export async function findOwnedHabit(ownerUid: string, habitId: string) {
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

  const scopedHabit = (habits as Habit[]).find((entry) => entry.id === habitId);
  if (scopedHabit && scopedHabit.ownerUid === ownerUid) {
    return scopedHabit;
  }

  const { habits: habitById = [] } = await instantAdmin.query({
    habits: {
      $: {
        where: {
          id: habitId,
        },
      },
    },
  });

  const habit = habitById[0] as Habit | undefined;
  if (!habit || habit.ownerUid !== ownerUid) {
    throw new InstantRouteNotFoundError("Habit was not found for this user.");
  }

  return habit;
}

export async function findOwnedHabitCheckin(ownerUid: string, habitId: string, checkinId: string) {
  const instantAdmin = getInstantAdmin();
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

  const scopedCheckin = (habitCheckins as HabitCheckin[]).find((entry) => entry.id === checkinId);
  if (scopedCheckin && scopedCheckin.ownerUid === ownerUid && scopedCheckin.habitId === habitId) {
    return scopedCheckin;
  }

  const { habitCheckins: checkinById = [] } = await instantAdmin.query({
    habitCheckins: {
      $: {
        where: {
          id: checkinId,
        },
      },
    },
  });

  const checkin = checkinById[0] as HabitCheckin | undefined;
  if (!checkin || checkin.ownerUid !== ownerUid || checkin.habitId !== habitId) {
    throw new InstantRouteNotFoundError("Habit check-in was not found for this user.");
  }

  return checkin;
}

export function instantRouteErrorResponse(
  error: unknown,
  context?: { route?: string; method?: string; phase?: string },
) {
  const response = resolveInstantRouteError(error);

  logApiFailure({
    route: context?.route,
    method: context?.method,
    phase: context?.phase,
    status: response.status,
    error,
  });

  return NextResponse.json(response.payload, { status: response.status });
}

function normalizeTaskDefaults(task: Task): Task {
  return {
    ...task,
    unplanned: task.unplanned ?? false,
  };
}