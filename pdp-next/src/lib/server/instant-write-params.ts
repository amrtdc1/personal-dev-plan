import type { GoalType } from "@/lib/domain/types";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";

type GoalWritePayload = {
  type?: GoalType;
  title?: string;
  description?: string;
  projectedStartDate?: string | null;
  projectedEndDate?: string | null;
  timeframeLabel?: string;
  isFocus?: boolean;
};

type SubgoalWritePayload = {
  goalId?: string;
  title?: string;
  description?: string;
  projectedStartDate?: string | null;
  projectedEndDate?: string | null;
  timeframeLabel?: string;
};

type TaskWritePayload = {
  subgoalId?: string;
  title?: string;
  notes?: string;
  dueDate?: string | null;
};

export type ParsedGoalWritePayload = {
  type: GoalType;
  title: string;
  description: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  timeframeLabel: string | undefined;
  isFocus: boolean;
};

export type ParsedSubgoalWritePayload = {
  goalId: string;
  title: string;
  description: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  timeframeLabel: string | undefined;
};

export type ParsedTaskWritePayload = {
  subgoalId: string;
  title: string;
  notes: string;
  dueDate: string | null;
};

export async function parseGoalWritePayload(request: Request): Promise<ParsedGoalWritePayload> {
  const payload = await parseJsonPayload<GoalWritePayload>(request);

  if (!payload.type || !isGoalType(payload.type)) {
    throw new InstantRouteBadRequestError("Goal type is required.");
  }

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Goal title is required.");
  }

  if (typeof payload.description !== "string") {
    throw new InstantRouteBadRequestError("Goal description is required.");
  }

  if (typeof payload.isFocus !== "boolean") {
    throw new InstantRouteBadRequestError("Goal focus flag is required.");
  }

  return {
    type: payload.type,
    title: payload.title,
    description: payload.description,
    projectedStartDate: parseOptionalString(payload.projectedStartDate),
    projectedEndDate: parseOptionalString(payload.projectedEndDate),
    timeframeLabel: payload.timeframeLabel,
    isFocus: payload.isFocus,
  };
}

export async function parseSubgoalWritePayload(request: Request): Promise<ParsedSubgoalWritePayload> {
  const payload = await parseJsonPayload<SubgoalWritePayload>(request);

  if (!payload.goalId) {
    throw new InstantRouteBadRequestError("Goal id is required.");
  }

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Subgoal title is required.");
  }

  if (typeof payload.description !== "string") {
    throw new InstantRouteBadRequestError("Subgoal description is required.");
  }

  return {
    goalId: payload.goalId,
    title: payload.title,
    description: payload.description,
    projectedStartDate: parseOptionalString(payload.projectedStartDate),
    projectedEndDate: parseOptionalString(payload.projectedEndDate),
    timeframeLabel: payload.timeframeLabel,
  };
}

export async function parseTaskWritePayload(request: Request): Promise<ParsedTaskWritePayload> {
  const payload = await parseJsonPayload<TaskWritePayload>(request);

  if (!payload.subgoalId) {
    throw new InstantRouteBadRequestError("Subgoal id is required.");
  }

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Task title is required.");
  }

  if (typeof payload.notes !== "string") {
    throw new InstantRouteBadRequestError("Task notes are required.");
  }

  return {
    subgoalId: payload.subgoalId,
    title: payload.title,
    notes: payload.notes,
    dueDate: parseOptionalString(payload.dueDate),
  };
}

async function parseJsonPayload<TPayload>(request: Request) {
  try {
    return (await request.json()) as TPayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }
}

function parseOptionalString(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new InstantRouteBadRequestError("Optional date fields must be strings when provided.");
  }

  return value;
}

function isGoalType(value: string): value is GoalType {
  return value === "professional" || value === "personal";
}
