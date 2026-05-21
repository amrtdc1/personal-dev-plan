import { NextResponse } from "next/server";
import type { Goal, ItemStatus, Subgoal, Task } from "@/lib/domain/types";
import { validateStatusUpdate } from "@/lib/data/validation";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantAuthError } from "@/lib/server/instant-auth";

type StatusUpdatePayload = {
  status?: ItemStatus;
};

export class InstantRouteBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstantRouteBadRequestError";
  }
}

export class InstantRouteNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstantRouteNotFoundError";
  }
}

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

  const goal = goals.find((entry) => entry.id === goalId) as Goal | undefined;
  if (!goal) {
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

  const subgoal = subgoals.find((entry) => entry.id === subgoalId) as Subgoal | undefined;
  if (!subgoal) {
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

  const task = tasks.find((entry) => entry.id === taskId) as Task | undefined;
  if (!task) {
    throw new InstantRouteNotFoundError("Task was not found for this user.");
  }

  return task;
}

export function instantRouteErrorResponse(error: unknown) {
  if (error instanceof InstantAuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof InstantRouteNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof InstantRouteBadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}