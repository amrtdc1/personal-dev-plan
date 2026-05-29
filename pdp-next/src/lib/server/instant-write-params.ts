import type {
  GoalTimeframeLevel,
  GoalType,
  HabitCadence,
  HabitState,
} from "@/lib/domain/types";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";

type GoalWritePayload = {
  type?: GoalType;
  parentGoalId?: string | null;
  timeframeLevel?: GoalTimeframeLevel;
  title?: string;
  description?: string;
  projectedStartDate?: string | null;
  projectedEndDate?: string | null;
  timeframeLabel?: string;
  isFocus?: boolean;
};

type TaskWritePayload = {
  parentGoalId?: string | null;
  commitmentId?: string | null;
  title?: string;
  notes?: string;
  dueDate?: string | null;
  unplanned?: boolean;
  originalDueDate?: string | null;
  snoozedDueDate?: string | null;
  snoozeCount?: number;
};

type JournalWritePayload = {
  title?: string;
  content?: string;
  mood?: string | null;
  tags?: string[];
  relatedGoalId?: string | null;
};

type HabitWritePayload = {
  title?: string;
  cadence?: HabitCadence;
  targetCount?: number;
  status?: HabitState;
};

type HabitCheckinWritePayload = {
  checkInDate?: string;
  notes?: string | null;
};

export type ParsedGoalWritePayload = {
  type: GoalType;
  parentGoalId: string | null;
  timeframeLevel: GoalTimeframeLevel;
  title: string;
  description: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  timeframeLabel: string | undefined;
  isFocus: boolean;
};

export type ParsedTaskWritePayload = {
  parentGoalId: string | null;
  commitmentId: string | null;
  title: string;
  notes: string;
  dueDate: string | null;
  unplanned: boolean;
  originalDueDate: string | null;
  snoozedDueDate: string | null;
  snoozeCount: number;
};

export type ParsedJournalWritePayload = {
  title: string;
  content: string;
  mood: string | null;
  tags: string[];
  relatedGoalId: string | null;
};

export type ParsedHabitWritePayload = {
  title: string;
  cadence: HabitCadence;
  targetCount: number;
  status: HabitState;
};

export type ParsedHabitCheckinWritePayload = {
  checkInDate: string;
  notes: string | null;
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

  if (payload.timeframeLevel === undefined || payload.timeframeLevel === null) {
    throw new InstantRouteBadRequestError("Goal timeframe level is required.");
  }

  if (typeof payload.timeframeLevel !== "string" || !isGoalTimeframeLevel(payload.timeframeLevel)) {
    throw new InstantRouteBadRequestError("Goal timeframe level is not supported.");
  }

  return {
    type: payload.type,
    parentGoalId: parseOptionalTrimmedString(payload.parentGoalId),
    timeframeLevel: payload.timeframeLevel,
    title: payload.title,
    description: payload.description,
    projectedStartDate: parseOptionalString(payload.projectedStartDate),
    projectedEndDate: parseOptionalString(payload.projectedEndDate),
    timeframeLabel: payload.timeframeLabel,
    isFocus: payload.isFocus,
  };
}

export async function parseTaskWritePayload(request: Request): Promise<ParsedTaskWritePayload> {
  const payload = await parseJsonPayload<TaskWritePayload>(request);

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Task title is required.");
  }

  if (typeof payload.notes !== "string") {
    throw new InstantRouteBadRequestError("Task notes are required.");
  }

  if (payload.unplanned !== undefined && typeof payload.unplanned !== "boolean") {
    throw new InstantRouteBadRequestError("Task unplanned flag must be a boolean when provided.");
  }

  if (payload.snoozeCount !== undefined && (typeof payload.snoozeCount !== "number" || !Number.isFinite(payload.snoozeCount))) {
    throw new InstantRouteBadRequestError("Task snooze count must be a finite number when provided.");
  }

  return {
    parentGoalId: parseOptionalTrimmedString(payload.parentGoalId),
    commitmentId: parseOptionalTrimmedString(payload.commitmentId),
    title: payload.title,
    notes: payload.notes,
    dueDate: parseOptionalString(payload.dueDate),
    unplanned: payload.unplanned ?? false,
    originalDueDate: parseOptionalString(payload.originalDueDate),
    snoozedDueDate: parseOptionalString(payload.snoozedDueDate),
    snoozeCount: payload.snoozeCount === undefined ? 0 : Math.max(0, Math.round(payload.snoozeCount)),
  };
}

export async function parseJournalWritePayload(request: Request): Promise<ParsedJournalWritePayload> {
  const payload = await parseJsonPayload<JournalWritePayload>(request);

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Journal title is required.");
  }

  if (typeof payload.content !== "string") {
    throw new InstantRouteBadRequestError("Journal content is required.");
  }

  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags) || payload.tags.some((tag) => typeof tag !== "string")) {
      throw new InstantRouteBadRequestError("Journal tags must be an array of strings.");
    }
  }

  return {
    title: payload.title,
    content: payload.content,
    mood: parseOptionalString(payload.mood),
    tags: payload.tags ?? [],
    relatedGoalId: parseOptionalString(payload.relatedGoalId),
  };
}

export async function parseHabitWritePayload(request: Request): Promise<ParsedHabitWritePayload> {
  const payload = await parseJsonPayload<HabitWritePayload>(request);

  if (typeof payload.title !== "string") {
    throw new InstantRouteBadRequestError("Habit title is required.");
  }

  if (!payload.cadence || !isHabitCadence(payload.cadence)) {
    throw new InstantRouteBadRequestError("Habit cadence is required.");
  }

  if (typeof payload.targetCount !== "number" || !Number.isFinite(payload.targetCount)) {
    throw new InstantRouteBadRequestError("Habit target count is required.");
  }

  if (payload.targetCount <= 0) {
    throw new InstantRouteBadRequestError("Habit target count must be greater than zero.");
  }

  if (payload.status !== undefined && !isHabitState(payload.status)) {
    throw new InstantRouteBadRequestError("Habit status is not supported.");
  }

  return {
    title: payload.title,
    cadence: payload.cadence,
    targetCount: Math.round(payload.targetCount),
    status: payload.status ?? "active",
  };
}

export async function parseHabitCheckinWritePayload(request: Request): Promise<ParsedHabitCheckinWritePayload> {
  const payload = await parseJsonPayload<HabitCheckinWritePayload>(request);

  if (typeof payload.checkInDate !== "string" || payload.checkInDate.trim().length === 0) {
    throw new InstantRouteBadRequestError("Habit check-in date is required.");
  }

  if (payload.notes !== undefined && payload.notes !== null && typeof payload.notes !== "string") {
    throw new InstantRouteBadRequestError("Habit check-in notes must be a string when provided.");
  }

  return {
    checkInDate: payload.checkInDate.trim(),
    notes: payload.notes?.trim() ? payload.notes.trim() : null,
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

function parseOptionalTrimmedString(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new InstantRouteBadRequestError("Optional string fields must be strings when provided.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isGoalType(value: string): value is GoalType {
  return value === "professional" || value === "personal";
}

function isGoalTimeframeLevel(value: string): value is GoalTimeframeLevel {
  return (
    value === "vision_5y" ||
    value === "annual" ||
    value === "quarterly" ||
    value === "monthly" ||
    value === "weekly"
  );
}


function isHabitCadence(value: string): value is HabitCadence {
  return value === "daily" || value === "weekly";
}

function isHabitState(value: string): value is HabitState {
  return value === "active" || value === "paused" || value === "archived";
}
