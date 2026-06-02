import type {
  DailyFocusPlan,
  PlanningCommitment,
  PlanningCommitmentDomain,
  PlanningCommitmentLevel,
  PlanningCommitmentStatus,
  PlanningCycle,
  PlanningCycleStatus,
  PlanningCycleType,
} from "@/lib/domain/types";
import { getTaskParentGoalId, type Goal, type Task } from "@/lib/domain/types";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import {
  InstantRouteBadRequestError,
  InstantRouteNotFoundError,
} from "@/lib/server/instant-errors";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type PlanningCycleWritePayload = {
  cycleType?: PlanningCycleType;
  startDate?: string;
  endDate?: string;
  status?: PlanningCycleStatus;
  reviewSummary?: string | null;
};

type PlanningCommitmentWritePayload = {
  cycleId?: string;
  level?: PlanningCommitmentLevel;
  domain?: PlanningCommitmentDomain;
  title?: string;
  linkedGoalId?: string | null;
  rank?: number;
  status?: PlanningCommitmentStatus;
  carryoverFromCommitmentId?: string | null;
  confidenceScore?: number | null;
};

type DailyFocusWritePayload = {
  commitmentIds?: string[];
  taskIds?: string[];
  notes?: string | null;
};

export type ParsedPlanningCycleWritePayload = {
  cycleType: PlanningCycleType;
  startDate: string;
  endDate: string;
  status: PlanningCycleStatus;
  reviewSummary: string | null;
};

export type ParsedPlanningCommitmentWritePayload = {
  cycleId: string;
  level: PlanningCommitmentLevel;
  domain: PlanningCommitmentDomain;
  title: string;
  linkedGoalId: string | null;
  rank: 1 | 2 | 3;
  status: PlanningCommitmentStatus;
  carryoverFromCommitmentId: string | null;
  confidenceScore: number | null;
};

export type ParsedDailyFocusWritePayload = {
  commitmentIds: string[];
  taskIds: string[];
  notes: string | null;
};

export function parsePlanningCycleTypeFilter(searchParams: URLSearchParams) {
  const cycleType = searchParams.get("cycleType");
  if (!cycleType) {
    return null;
  }

  if (!isPlanningCycleType(cycleType)) {
    throw new InstantRouteBadRequestError("cycleType must be 'weekly' or 'quarterly' when provided.");
  }

  return cycleType;
}

export function parsePlanningCommitmentsFilter(searchParams: URLSearchParams) {
  const cycleId = parseOptionalTrimmedString(searchParams.get("cycleId"));
  const levelRaw = searchParams.get("level");
  const level = levelRaw ? parsePlanningCommitmentLevel(levelRaw) : null;

  return {
    cycleId,
    level,
  };
}

export function parseDailyFocusDate(searchParams: URLSearchParams) {
  const date = searchParams.get("date");
  if (!date) {
    throw new InstantRouteBadRequestError("date query parameter is required (YYYY-MM-DD).");
  }

  return parseRequiredIsoDate(date, "date");
}

export async function parsePlanningCycleWritePayload(request: Request): Promise<ParsedPlanningCycleWritePayload> {
  const payload = await parseJsonPayload<PlanningCycleWritePayload>(request);

  if (!payload.cycleType || !isPlanningCycleType(payload.cycleType)) {
    throw new InstantRouteBadRequestError("cycleType is required and must be 'weekly' or 'quarterly'.");
  }

  const startDate = parseRequiredIsoDate(payload.startDate, "startDate");
  const endDate = parseRequiredIsoDate(payload.endDate, "endDate");
  if (startDate > endDate) {
    throw new InstantRouteBadRequestError("startDate must be on or before endDate.");
  }

  const status = payload.status ? parsePlanningCycleStatus(payload.status) : "active";
  const reviewSummary = parseOptionalTrimmedString(payload.reviewSummary);

  return {
    cycleType: payload.cycleType,
    startDate,
    endDate,
    status,
    reviewSummary,
  };
}

export async function parsePlanningCommitmentWritePayload(
  request: Request,
): Promise<ParsedPlanningCommitmentWritePayload> {
  const payload = await parseJsonPayload<PlanningCommitmentWritePayload>(request);

  const cycleId = parseRequiredTrimmedString(payload.cycleId, "cycleId");
  const level = parsePlanningCommitmentLevel(payload.level);
  const domain = parsePlanningCommitmentDomain(payload.domain);
  const title = parseRequiredTrimmedString(payload.title, "title");
  const linkedGoalId = parseOptionalTrimmedString(payload.linkedGoalId);
  const carryoverFromCommitmentId = parseOptionalTrimmedString(payload.carryoverFromCommitmentId);
  const rank = parseCommitmentRank(payload.rank);
  const status = payload.status ? parsePlanningCommitmentStatus(payload.status) : "not_started";
  const confidenceScore = parseConfidenceScore(payload.confidenceScore);

  return {
    cycleId,
    level,
    domain,
    title,
    linkedGoalId,
    rank,
    status,
    carryoverFromCommitmentId,
    confidenceScore,
  };
}

export async function parseDailyFocusWritePayload(request: Request): Promise<ParsedDailyFocusWritePayload> {
  const payload = await parseJsonPayload<DailyFocusWritePayload>(request);

  if (!Array.isArray(payload.commitmentIds) || payload.commitmentIds.some((id) => typeof id !== "string")) {
    throw new InstantRouteBadRequestError("commitmentIds must be an array of strings.");
  }

  if (!Array.isArray(payload.taskIds) || payload.taskIds.some((id) => typeof id !== "string")) {
    throw new InstantRouteBadRequestError("taskIds must be an array of strings.");
  }

  if (payload.commitmentIds.length > 3) {
    throw new InstantRouteBadRequestError("Daily focus commitmentIds cannot exceed 3 items.");
  }

  if (payload.taskIds.length > 3) {
    throw new InstantRouteBadRequestError("Daily focus taskIds cannot exceed 3 items.");
  }

  if (payload.notes !== undefined && payload.notes !== null && typeof payload.notes !== "string") {
    throw new InstantRouteBadRequestError("notes must be a string when provided.");
  }

  const commitmentIds = dedupeStringArray(payload.commitmentIds.map((id) => id.trim()).filter((id) => id.length > 0));
  const taskIds = dedupeStringArray(payload.taskIds.map((id) => id.trim()).filter((id) => id.length > 0));

  if (commitmentIds.length > 3) {
    throw new InstantRouteBadRequestError("Daily focus commitmentIds cannot exceed 3 unique items.");
  }

  if (taskIds.length > 3) {
    throw new InstantRouteBadRequestError("Daily focus taskIds cannot exceed 3 unique items.");
  }

  return {
    commitmentIds,
    taskIds,
    notes: parseOptionalTrimmedString(payload.notes),
  };
}

export async function listOwnedPlanningCycles(ownerUid: string, input: { cycleType: PlanningCycleType | null }) {
  const instantAdmin = getInstantAdmin();
  const { planningCycles = [] } = await instantAdmin.query({
    planningCycles: {
      $: {
        where: input.cycleType
          ? {
              ownerUid,
              cycleType: input.cycleType,
            }
          : {
              ownerUid,
            },
      },
    },
  });

  return (planningCycles as PlanningCycle[]).sort((left, right) =>
    right.startDate.localeCompare(left.startDate) || right.createdAt.localeCompare(left.createdAt),
  );
}

export async function listOwnedPlanningCommitments(
  ownerUid: string,
  input: { cycleId: string | null; level: PlanningCommitmentLevel | null },
) {
  const instantAdmin = getInstantAdmin();
  const { planningCommitments = [] } = await instantAdmin.query({
    planningCommitments: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  return (planningCommitments as PlanningCommitment[])
    .filter((commitment) => (input.cycleId ? commitment.cycleId === input.cycleId : true))
    .filter((commitment) => (input.level ? commitment.level === input.level : true))
    .sort((left, right) => left.rank - right.rank || right.updatedAt.localeCompare(left.updatedAt));
}

export async function getOwnedDailyFocusPlan(ownerUid: string, planDate: string) {
  const instantAdmin = getInstantAdmin();
  const { dailyFocusPlans = [] } = await instantAdmin.query({
    dailyFocusPlans: {
      $: {
        where: {
          ownerUid,
          planDate,
        },
      },
    },
  });

  return (dailyFocusPlans[0] as DailyFocusPlan | undefined) ?? null;
}

export async function createPlanningCycle(ownerUid: string, payload: ParsedPlanningCycleWritePayload) {
  const instantAdmin = getInstantAdmin();
  const now = new Date().toISOString();
  const cycleId = crypto.randomUUID();

  const cycle: PlanningCycle = {
    id: cycleId,
    ownerUid,
    cycleType: payload.cycleType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: payload.status,
    reviewSummary: payload.reviewSummary,
    createdAt: now,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.planningCycles[cycleId].update({
      ownerUid: cycle.ownerUid,
      cycleType: cycle.cycleType,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: cycle.status,
      reviewSummary: cycle.reviewSummary,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    }),
  );

  return cycle;
}

export async function updatePlanningCycle(
  ownerUid: string,
  cycleId: string,
  payload: ParsedPlanningCycleWritePayload,
) {
  const instantAdmin = getInstantAdmin();
  const existing = await findOwnedPlanningCycle(ownerUid, cycleId);
  const now = new Date().toISOString();

  const next: PlanningCycle = {
    ...existing,
    cycleType: payload.cycleType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: payload.status,
    reviewSummary: payload.reviewSummary,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.planningCycles[cycleId].update({
      cycleType: next.cycleType,
      startDate: next.startDate,
      endDate: next.endDate,
      status: next.status,
      reviewSummary: next.reviewSummary,
      updatedAt: next.updatedAt,
    }),
  );

  return next;
}

export async function completePlanningCycle(ownerUid: string, cycleId: string) {
  const instantAdmin = getInstantAdmin();
  const existing = await findOwnedPlanningCycle(ownerUid, cycleId);
  const now = new Date().toISOString();

  const next: PlanningCycle = {
    ...existing,
    status: "completed",
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.planningCycles[cycleId].update({
      status: next.status,
      updatedAt: next.updatedAt,
    }),
  );

  return next;
}

export async function createPlanningCommitment(ownerUid: string, payload: ParsedPlanningCommitmentWritePayload) {
  const instantAdmin = getInstantAdmin();
  await findOwnedPlanningCycle(ownerUid, payload.cycleId);

  if (payload.linkedGoalId) {
    await findOwnedActiveGoal(ownerUid, payload.linkedGoalId);
  }

  if (payload.carryoverFromCommitmentId) {
    await findOwnedPlanningCommitment(ownerUid, payload.carryoverFromCommitmentId);
  }

  await enforceWeeklyCommitmentCap(ownerUid, payload.cycleId, payload.level, null);

  const now = new Date().toISOString();
  const commitmentId = crypto.randomUUID();
  const commitment: PlanningCommitment = {
    id: commitmentId,
    ownerUid,
    cycleId: payload.cycleId,
    level: payload.level,
    domain: payload.domain,
    title: payload.title,
    linkedGoalId: payload.linkedGoalId,
    rank: payload.rank,
    status: payload.status,
    carryoverFromCommitmentId: payload.carryoverFromCommitmentId,
    confidenceScore: payload.confidenceScore,
    createdAt: now,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.planningCommitments[commitmentId].update({
      ownerUid: commitment.ownerUid,
      cycleId: commitment.cycleId,
      level: commitment.level,
      domain: commitment.domain,
      title: commitment.title,
      linkedGoalId: commitment.linkedGoalId,
      rank: commitment.rank,
      status: commitment.status,
      carryoverFromCommitmentId: commitment.carryoverFromCommitmentId,
      confidenceScore: commitment.confidenceScore,
      createdAt: commitment.createdAt,
      updatedAt: commitment.updatedAt,
    }),
  );

  return commitment;
}

export async function updatePlanningCommitment(
  ownerUid: string,
  commitmentId: string,
  payload: ParsedPlanningCommitmentWritePayload,
) {
  const instantAdmin = getInstantAdmin();
  const existing = await findOwnedPlanningCommitment(ownerUid, commitmentId);

  await findOwnedPlanningCycle(ownerUid, payload.cycleId);

  if (payload.linkedGoalId) {
    await findOwnedActiveGoal(ownerUid, payload.linkedGoalId);
  }

  if (payload.carryoverFromCommitmentId) {
    await findOwnedPlanningCommitment(ownerUid, payload.carryoverFromCommitmentId);
  }

  await enforceWeeklyCommitmentCap(ownerUid, payload.cycleId, payload.level, commitmentId);

  const now = new Date().toISOString();
  const next: PlanningCommitment = {
    ...existing,
    cycleId: payload.cycleId,
    level: payload.level,
    domain: payload.domain,
    title: payload.title,
    linkedGoalId: payload.linkedGoalId,
    rank: payload.rank,
    status: payload.status,
    carryoverFromCommitmentId: payload.carryoverFromCommitmentId,
    confidenceScore: payload.confidenceScore,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.planningCommitments[commitmentId].update({
      cycleId: next.cycleId,
      level: next.level,
      domain: next.domain,
      title: next.title,
      linkedGoalId: next.linkedGoalId,
      rank: next.rank,
      status: next.status,
      carryoverFromCommitmentId: next.carryoverFromCommitmentId,
      confidenceScore: next.confidenceScore,
      updatedAt: next.updatedAt,
    }),
  );

  return next;
}

export async function deletePlanningCommitment(ownerUid: string, commitmentId: string) {
  const instantAdmin = getInstantAdmin();
  await findOwnedPlanningCommitment(ownerUid, commitmentId);
  await instantAdmin.transact(instantAdmin.tx.planningCommitments[commitmentId].delete());
}

export async function carryoverPlanningCommitment(ownerUid: string, commitmentId: string) {
  const source = await findOwnedPlanningCommitment(ownerUid, commitmentId);
  const targetCycle = await findActiveCarryoverTargetCycle(ownerUid, source);

  const next: ParsedPlanningCommitmentWritePayload = {
    cycleId: targetCycle.id,
    level: source.level,
    domain: source.domain,
    title: source.title,
    linkedGoalId: source.linkedGoalId,
    rank: source.rank,
    status: "not_started",
    carryoverFromCommitmentId: source.id,
    confidenceScore: source.confidenceScore,
  };

  return createPlanningCommitment(ownerUid, next);
}

async function findActiveCarryoverTargetCycle(ownerUid: string, source: PlanningCommitment) {
  const targetCycleType: PlanningCycleType = source.level === "weekly" ? "weekly" : "quarterly";
  const cycles = await listOwnedPlanningCycles(ownerUid, { cycleType: targetCycleType });
  const activeTarget = cycles.find((cycle) => cycle.status === "active" && cycle.id !== source.cycleId) ?? null;

  if (!activeTarget) {
    throw new InstantRouteBadRequestError(
      `No active ${source.level} cycle is available to carry this commitment forward. Start a new active ${source.level} cycle first.`,
    );
  }

  return activeTarget;
}

export async function upsertDailyFocusPlan(
  ownerUid: string,
  planDate: string,
  payload: ParsedDailyFocusWritePayload,
) {
  for (const commitmentId of payload.commitmentIds) {
    await findOwnedPlanningCommitment(ownerUid, commitmentId);
  }

  for (const taskId of payload.taskIds) {
    await findOwnedTaskForDailyFocus(ownerUid, taskId);
  }

  const instantAdmin = getInstantAdmin();
  const existing = await getOwnedDailyFocusPlan(ownerUid, planDate);
  const now = new Date().toISOString();
  const id = existing?.id ?? crypto.randomUUID();

  const plan: DailyFocusPlan = {
    id,
    ownerUid,
    planDate,
    commitmentIds: payload.commitmentIds,
    taskIds: payload.taskIds,
    notes: payload.notes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await instantAdmin.transact(
    instantAdmin.tx.dailyFocusPlans[id].update({
      ownerUid: plan.ownerUid,
      planDate: plan.planDate,
      commitmentIds: plan.commitmentIds,
      taskIds: plan.taskIds,
      notes: plan.notes,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }),
  );

  return plan;
}

async function findOwnedPlanningCycle(ownerUid: string, cycleId: string) {
  const instantAdmin = getInstantAdmin();
  const { planningCycles = [] } = await instantAdmin.query({
    planningCycles: {
      $: {
        where: {
          ownerUid,
          id: cycleId,
        },
      },
    },
  });

  const cycle = planningCycles[0] as PlanningCycle | undefined;
  if (!cycle) {
    throw new InstantRouteNotFoundError("Planning cycle was not found for this user.");
  }

  return cycle;
}

async function findOwnedPlanningCommitment(ownerUid: string, commitmentId: string) {
  const instantAdmin = getInstantAdmin();
  const { planningCommitments = [] } = await instantAdmin.query({
    planningCommitments: {
      $: {
        where: {
          ownerUid,
          id: commitmentId,
        },
      },
    },
  });

  const commitment = planningCommitments[0] as PlanningCommitment | undefined;
  if (!commitment) {
    throw new InstantRouteNotFoundError("Planning commitment was not found for this user.");
  }

  return commitment;
}

async function findOwnedActiveGoal(ownerUid: string, goalId: string) {
  const instantAdmin = getInstantAdmin();
  const { goals = [] } = await instantAdmin.query({
    goals: {
      $: {
        where: {
          ownerUid,
          id: goalId,
        },
      },
    },
  });

  const goal = goals[0] as Goal | undefined;
  if (!goal || goal.deletedAt !== null) {
    throw new InstantRouteBadRequestError("linkedGoalId must reference an active owned goal.");
  }
}

async function findOwnedTaskForDailyFocus(ownerUid: string, taskId: string) {
  const instantAdmin = getInstantAdmin();
  const { tasks = [] } = await instantAdmin.query({
    tasks: {
      $: {
        where: {
          ownerUid,
          id: taskId,
        },
      },
    },
  });

  const task = tasks[0] as Task | undefined;
  if (!task || task.deletedAt !== null) {
    throw new InstantRouteBadRequestError("taskIds must reference active owned tasks.");
  }

  // Forces normalization path parity with existing task ownership patterns.
  getTaskParentGoalId(task);
}

async function enforceWeeklyCommitmentCap(
  ownerUid: string,
  cycleId: string,
  level: PlanningCommitmentLevel,
  excludeCommitmentId: string | null,
) {
  if (level !== "weekly") {
    return;
  }

  const instantAdmin = getInstantAdmin();
  const { planningCommitments = [] } = await instantAdmin.query({
    planningCommitments: {
      $: {
        where: {
          ownerUid,
          cycleId,
          level: "weekly",
        },
      },
    },
  });

  const weeklyCommitments = (planningCommitments as PlanningCommitment[]).filter((commitment) =>
    excludeCommitmentId ? commitment.id !== excludeCommitmentId : true,
  );

  if (weeklyCommitments.length >= 3) {
    throw new InstantRouteBadRequestError("Weekly commitments per cycle cannot exceed 3.");
  }
}

async function parseJsonPayload<TPayload>(request: Request) {
  try {
    return (await request.json()) as TPayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }
}

function parseRequiredIsoDate(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InstantRouteBadRequestError(`${label} is required.`);
  }

  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) {
    throw new InstantRouteBadRequestError(`${label} must be in YYYY-MM-DD format.`);
  }

  return trimmed;
}

function parseRequiredTrimmedString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InstantRouteBadRequestError(`${label} is required.`);
  }

  return value.trim();
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

function parsePlanningCycleStatus(value: string): PlanningCycleStatus {
  if (value === "active" || value === "completed" || value === "archived") {
    return value;
  }

  throw new InstantRouteBadRequestError("status must be 'active', 'completed', or 'archived'.");
}

function parsePlanningCommitmentLevel(value: unknown): PlanningCommitmentLevel {
  if (value === "weekly" || value === "quarterly") {
    return value;
  }

  throw new InstantRouteBadRequestError("level is required and must be 'weekly' or 'quarterly'.");
}

function parsePlanningCommitmentDomain(value: unknown): PlanningCommitmentDomain {
  if (value === "professional" || value === "personal" || value === "mixed") {
    return value;
  }

  throw new InstantRouteBadRequestError("domain is required and must be 'professional', 'personal', or 'mixed'.");
}

function parsePlanningCommitmentStatus(value: string): PlanningCommitmentStatus {
  if (value === "not_started" || value === "in_progress" || value === "done" || value === "dropped") {
    return value;
  }

  throw new InstantRouteBadRequestError("status is not supported for commitments.");
}

function parseCommitmentRank(value: unknown): 1 | 2 | 3 {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InstantRouteBadRequestError("rank is required and must be a number from 1 to 3.");
  }

  const rounded = Math.round(value);
  if (rounded !== 1 && rounded !== 2 && rounded !== 3) {
    throw new InstantRouteBadRequestError("rank must be 1, 2, or 3.");
  }

  return rounded;
}

function parseConfidenceScore(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InstantRouteBadRequestError("confidenceScore must be a finite number when provided.");
  }

  if (value < 0 || value > 1) {
    throw new InstantRouteBadRequestError("confidenceScore must be between 0 and 1.");
  }

  return value;
}

function dedupeStringArray(values: string[]) {
  return Array.from(new Set(values));
}

function isPlanningCycleType(value: string): value is PlanningCycleType {
  return value === "weekly" || value === "quarterly";
}
