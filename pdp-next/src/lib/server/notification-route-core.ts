import { InstantRouteBadRequestError } from "./instant-errors";

export type DeliveryStatus = "sent" | "failed" | "skipped";

export type DeliveryRecord = {
  id: string;
  ownerUid: string;
  reminderType: string;
  status: DeliveryStatus;
  title?: string;
  message?: string;
  deliveredCount?: number;
  failedCount?: number;
  staleDeletedCount?: number;
  createdAt: string;
};

export type DeliveryQueryFilters = {
  limit: number;
  status: DeliveryStatus | null;
  type: string | null;
  before: string | null;
  after: string | null;
};

const ALLOWED_STATUSES: DeliveryStatus[] = ["sent", "failed", "skipped"];
const ALLOWED_TYPES = ["daily_agenda", "weekly_review", "due_tasks", "test"];

export function parseDeliveryQueryFilters(params: URLSearchParams, options?: { defaultLimit?: number; maxLimit?: number }) {
  const defaultLimit = options?.defaultLimit ?? 8;
  const maxLimit = options?.maxLimit ?? 20;

  const limit = parseLimit(params.get("limit"), defaultLimit, maxLimit);
  const status = parseStatus(params.get("status"));
  const type = parseReminderType(params.get("type"));
  const before = parseCursorIso(params.get("before"), "before");
  const after = parseCursorIso(params.get("after"), "after");

  return {
    limit,
    status,
    type,
    before,
    after,
  } satisfies DeliveryQueryFilters;
}

export function filterAndPaginateDeliveries(rows: DeliveryRecord[], filters: DeliveryQueryFilters) {
  const filtered = rows
    .filter((entry) => (filters.status ? entry.status === filters.status : true))
    .filter((entry) => (filters.type ? entry.reminderType === filters.type : true))
    .filter((entry) => (filters.before ? entry.createdAt < filters.before : true))
    .filter((entry) => (filters.after ? entry.createdAt > filters.after : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const deliveries = filtered.slice(0, filters.limit).map((entry) => ({
    id: entry.id,
    reminderType: entry.reminderType,
    status: entry.status,
    title: entry.title,
    message: entry.message,
    deliveredCount: entry.deliveredCount ?? 0,
    failedCount: entry.failedCount ?? 0,
    staleDeletedCount: entry.staleDeletedCount ?? 0,
    createdAt: entry.createdAt,
  }));

  const hasMore = filtered.length > deliveries.length;
  const nextCursor = hasMore && deliveries.length > 0 ? deliveries[deliveries.length - 1].createdAt : null;

  return {
    deliveries,
    hasMore,
    nextCursor,
  };
}

export function summarizeReminderDeliveries(
  rows: Array<{ reminderType: string; status: DeliveryStatus; createdAt: string }>,
  sinceIso: string,
) {
  const scopedRows = rows.filter((entry) => entry.createdAt >= sinceIso);

  const totals: Record<DeliveryStatus, number> = {
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const byType: Record<string, Record<DeliveryStatus, number>> = {};

  for (const row of scopedRows) {
    totals[row.status] += 1;

    if (!byType[row.reminderType]) {
      byType[row.reminderType] = {
        sent: 0,
        failed: 0,
        skipped: 0,
      };
    }

    byType[row.reminderType][row.status] += 1;
  }

  return {
    totals,
    byType,
    totalRows: scopedRows.length,
  };
}

export function parseHours(rawValue: string | null, options?: { defaultHours?: number; maxHours?: number }) {
  const defaultHours = options?.defaultHours ?? 24;
  const maxHours = options?.maxHours ?? 24 * 14;

  if (!rawValue) {
    return defaultHours;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    throw new InstantRouteBadRequestError("hours must be a number.");
  }

  const normalized = Math.floor(parsed);

  if (normalized <= 0) {
    throw new InstantRouteBadRequestError("hours must be greater than zero.");
  }

  return Math.min(normalized, maxHours);
}

function parseLimit(rawValue: string | null, defaultLimit: number, maxLimit: number) {
  if (!rawValue) {
    return defaultLimit;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    throw new InstantRouteBadRequestError("limit must be a number.");
  }

  const normalized = Math.floor(parsed);

  if (normalized <= 0) {
    throw new InstantRouteBadRequestError("limit must be greater than zero.");
  }

  return Math.min(normalized, maxLimit);
}

function parseStatus(rawValue: string | null): DeliveryStatus | null {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase() as DeliveryStatus;
  if (!ALLOWED_STATUSES.includes(normalized)) {
    throw new InstantRouteBadRequestError("status must be one of: sent, failed, skipped.");
  }

  return normalized;
}

function parseReminderType(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(normalized)) {
    throw new InstantRouteBadRequestError("type must be one of: daily_agenda, weekly_review, due_tasks, test.");
  }

  return normalized;
}

function parseCursorIso(rawValue: string | null, label: "before" | "after") {
  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.valueOf())) {
    throw new InstantRouteBadRequestError(`${label} must be a valid ISO date string.`);
  }

  return parsed.toISOString();
}
