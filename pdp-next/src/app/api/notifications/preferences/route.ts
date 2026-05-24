import { id } from "@instantdb/admin";
import { NextResponse } from "next/server";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

type NotificationPreferencesRecord = {
  id: string;
  ownerUid: string;
  dailyAgendaEnabled?: boolean;
  weeklyReviewEnabled?: boolean;
  dueTasksEnabled?: boolean;
  preferredHourLocal?: number;
  timezone?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt?: string;
  updatedAt?: string;
};

type NotificationPreferencesPayload = {
  dailyAgendaEnabled?: boolean;
  weeklyReviewEnabled?: boolean;
  dueTasksEnabled?: boolean;
  preferredHourLocal?: number | null;
  timezone?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

const DEFAULT_PREFERENCES = {
  dailyAgendaEnabled: true,
  weeklyReviewEnabled: true,
  dueTasksEnabled: true,
  preferredHourLocal: null as number | null,
  timezone: null as string | null,
  quietHoursStart: null as string | null,
  quietHoursEnd: null as string | null,
};

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const instantAdmin = getInstantAdmin();

    const { notificationPreferences = [] } = await instantAdmin.query({
      notificationPreferences: {
        $: {
          where: {
            ownerUid: user.id,
          },
        },
      },
    });

    const existing = (notificationPreferences as NotificationPreferencesRecord[])[0];

    return NextResponse.json({
      preferences: mergePreferences(existing),
    });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/preferences",
      method: "GET",
      phase: "read-preferences",
    });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parsePayload(request);
    const instantAdmin = getInstantAdmin();

    const { notificationPreferences = [] } = await instantAdmin.query({
      notificationPreferences: {
        $: {
          where: {
            ownerUid: user.id,
          },
        },
      },
    });

    const existing = (notificationPreferences as NotificationPreferencesRecord[])[0];
    const nowIso = new Date().toISOString();
    const merged = mergePreferences(existing, payload);

    const updateFields = {
      ownerUid: user.id,
      dailyAgendaEnabled: merged.dailyAgendaEnabled,
      weeklyReviewEnabled: merged.weeklyReviewEnabled,
      dueTasksEnabled: merged.dueTasksEnabled,
      preferredHourLocal: merged.preferredHourLocal ?? undefined,
      timezone: merged.timezone ?? undefined,
      quietHoursStart: merged.quietHoursStart ?? undefined,
      quietHoursEnd: merged.quietHoursEnd ?? undefined,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (existing) {
      await instantAdmin.transact([
        instantAdmin.tx.notificationPreferences[existing.id].update(updateFields),
      ]);
    } else {
      await instantAdmin.transact([
        instantAdmin.tx.notificationPreferences[id()].update(updateFields),
      ]);
    }

    return NextResponse.json({ preferences: merged });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/preferences",
      method: "PUT",
      phase: "write-preferences",
    });
  }
}

async function parsePayload(request: Request): Promise<NotificationPreferencesPayload> {
  let payload: NotificationPreferencesPayload;

  try {
    payload = (await request.json()) as NotificationPreferencesPayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InstantRouteBadRequestError("Request body must be a JSON object.");
  }

  if (payload.dailyAgendaEnabled !== undefined && typeof payload.dailyAgendaEnabled !== "boolean") {
    throw new InstantRouteBadRequestError("dailyAgendaEnabled must be a boolean when provided.");
  }

  if (payload.weeklyReviewEnabled !== undefined && typeof payload.weeklyReviewEnabled !== "boolean") {
    throw new InstantRouteBadRequestError("weeklyReviewEnabled must be a boolean when provided.");
  }

  if (payload.dueTasksEnabled !== undefined && typeof payload.dueTasksEnabled !== "boolean") {
    throw new InstantRouteBadRequestError("dueTasksEnabled must be a boolean when provided.");
  }

  if (
    payload.preferredHourLocal !== undefined &&
    payload.preferredHourLocal !== null &&
    (typeof payload.preferredHourLocal !== "number" || payload.preferredHourLocal < 0 || payload.preferredHourLocal > 23)
  ) {
    throw new InstantRouteBadRequestError("preferredHourLocal must be null or a number from 0 to 23.");
  }

  if (payload.timezone !== undefined && payload.timezone !== null) {
    const timezone = payload.timezone.trim();
    if (timezone.length > 0) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
      } catch {
        throw new InstantRouteBadRequestError("timezone must be a valid IANA time zone identifier.");
      }
    }
  }

  if (payload.quietHoursStart !== undefined && payload.quietHoursStart !== null) {
    validateQuietHourValue(payload.quietHoursStart, "quietHoursStart");
  }

  if (payload.quietHoursEnd !== undefined && payload.quietHoursEnd !== null) {
    validateQuietHourValue(payload.quietHoursEnd, "quietHoursEnd");
  }

  const hasQuietStart = payload.quietHoursStart !== undefined;
  const hasQuietEnd = payload.quietHoursEnd !== undefined;

  if (hasQuietStart !== hasQuietEnd) {
    throw new InstantRouteBadRequestError("quietHoursStart and quietHoursEnd must be provided together.");
  }

  return payload;
}

function mergePreferences(
  existing?: NotificationPreferencesRecord,
  patch?: NotificationPreferencesPayload,
) {
  return {
    dailyAgendaEnabled: patch?.dailyAgendaEnabled ?? existing?.dailyAgendaEnabled ?? DEFAULT_PREFERENCES.dailyAgendaEnabled,
    weeklyReviewEnabled:
      patch?.weeklyReviewEnabled ?? existing?.weeklyReviewEnabled ?? DEFAULT_PREFERENCES.weeklyReviewEnabled,
    dueTasksEnabled: patch?.dueTasksEnabled ?? existing?.dueTasksEnabled ?? DEFAULT_PREFERENCES.dueTasksEnabled,
    preferredHourLocal:
      patch?.preferredHourLocal === undefined
        ? existing?.preferredHourLocal ?? DEFAULT_PREFERENCES.preferredHourLocal
        : patch.preferredHourLocal,
    timezone:
      patch?.timezone === undefined
        ? existing?.timezone ?? DEFAULT_PREFERENCES.timezone
        : normalizeNullableString(patch.timezone),
    quietHoursStart:
      patch?.quietHoursStart === undefined
        ? existing?.quietHoursStart ?? DEFAULT_PREFERENCES.quietHoursStart
        : normalizeNullableString(patch.quietHoursStart),
    quietHoursEnd:
      patch?.quietHoursEnd === undefined
        ? existing?.quietHoursEnd ?? DEFAULT_PREFERENCES.quietHoursEnd
        : normalizeNullableString(patch.quietHoursEnd),
  };
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateQuietHourValue(value: string, fieldName: "quietHoursStart" | "quietHoursEnd") {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return;
  }

  const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized);
  if (!isValid) {
    throw new InstantRouteBadRequestError(`${fieldName} must use HH:MM 24-hour format.`);
  }
}
