import { NextResponse } from "next/server";
import type { Goal, ItemStatus, JournalEntry, Subgoal, Task } from "@/lib/domain/types";
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

export async function findOwnedSubgoal(ownerUid: string, subgoalId: string) {
  const instantAdmin = getInstantAdmin();
  const { subgoals = [] } = await instantAdmin.query({
    subgoals: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const scopedSubgoal = (subgoals as Subgoal[]).find((entry) => entry.id === subgoalId);
  if (scopedSubgoal && scopedSubgoal.ownerUid === ownerUid) {
    return scopedSubgoal;
  }

  const { subgoals: subgoalById = [] } = await instantAdmin.query({
    subgoals: {
      $: {
        where: {
          id: subgoalId,
        },
      },
    },
  });

  const subgoal = subgoalById[0] as Subgoal | undefined;
  if (!subgoal || subgoal.ownerUid !== ownerUid) {
    throw new InstantRouteNotFoundError("Subgoal was not found for this user.");
  }

  return subgoal;
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

  const scopedTask = (tasks as Task[]).find((entry) => entry.id === taskId);
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

  const task = taskById[0] as Task | undefined;
  if (!task || task.ownerUid !== ownerUid) {
    throw new InstantRouteNotFoundError("Task was not found for this user.");
  }

  return task;
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