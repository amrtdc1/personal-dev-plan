import { NextResponse } from "next/server";
import type { Goal, ItemStatus, Subgoal, Task } from "@/lib/domain/types";
import { validateStatusUpdate } from "@/lib/data/validation";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { resolveInstantRouteError } from "@/lib/server/instant-error-response";
import {
  InstantRouteBadRequestError,
  InstantRouteNotFoundError,
} from "@/lib/server/instant-errors";

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
  const response = resolveInstantRouteError(error);
  return NextResponse.json(response.payload, { status: response.status });
}