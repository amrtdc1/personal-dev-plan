import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import type { UserProfile } from "@/lib/domain/types";
import { validateUserProfileWrite } from "@/lib/data/validation";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  InstantAuthError,
  InstantRouteBadRequestError,
  InstantRouteNotFoundError,
} from "@/lib/server/instant-errors";
import { logApiFailure } from "@/lib/observability/telemetry";

type ProfilePatchPayload = Partial<{
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  themeMode: "palette" | "cwm" | "college" | null;
  theme: "light" | "dark" | "cwm";
  palette: UserProfile["palette"];
  collegeTeamId: string | null;
  collegeTeamName: string | null;
  collegeLogoUrl: string | null;
  timezone: string;
  retentionDays: number;
  createdAt: string;
}>;

type ProfileWriteFields = {
  uid: string;
  email: string;
  displayName: string | null;
  theme: "light" | "dark" | "cwm";
  palette: UserProfile["palette"];
  timezone: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
  firstName?: string;
  lastName?: string;
  themeMode?: "palette" | "cwm" | "college";
  collegeTeamId?: string;
  collegeTeamName?: string;
  collegeLogoUrl?: string;
};

function ensureObjectPayload(payload: unknown): ProfilePatchPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InstantRouteBadRequestError("Request body must be a JSON object.");
  }

  return payload as ProfilePatchPayload;
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new InstantRouteBadRequestError("Profile field values must be strings when provided.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimezone(value: unknown, fallback: string) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new InstantRouteBadRequestError("Timezone must be a string.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeRetentionDays(value: unknown, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new InstantRouteBadRequestError("Retention days must be a number.");
  }

  const normalized = Math.floor(value);
  if (normalized <= 0) {
    throw new InstantRouteBadRequestError("Retention days must be greater than zero.");
  }

  return normalized;
}

function normalizeCreatedAt(value: unknown, fallback: string) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new InstantRouteBadRequestError("createdAt must be a string.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildProfileWriteFields(
  profile: ReturnType<typeof validateUserProfileWrite>,
  options?: { includeThemeMode?: boolean; includeCollegeFields?: boolean; includeCollegeLogoUrl?: boolean },
): ProfileWriteFields {
  const includeThemeMode = options?.includeThemeMode ?? true;
  const includeCollegeFields = options?.includeCollegeFields ?? true;
  const includeCollegeLogoUrl = options?.includeCollegeLogoUrl ?? true;

  const fields: ProfileWriteFields = {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName ?? profile.email,
    theme: profile.theme,
    palette: profile.palette,
    timezone: profile.timezone,
    retentionDays: profile.retentionDays,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  if (profile.firstName) {
    fields.firstName = profile.firstName;
  }

  if (profile.lastName) {
    fields.lastName = profile.lastName;
  }

  if (includeThemeMode && profile.themeMode) {
    fields.themeMode = profile.themeMode;
  }

  if (includeCollegeFields) {
    if (profile.collegeTeamId) {
      fields.collegeTeamId = profile.collegeTeamId;
    }

    if (profile.collegeTeamName) {
      fields.collegeTeamName = profile.collegeTeamName;
    }

    if (includeCollegeLogoUrl && profile.collegeLogoUrl) {
      fields.collegeLogoUrl = profile.collegeLogoUrl;
    }
  }

  return fields;
}

export async function PUT(request: Request) {
  try {
    const user = await requireInstantUser(request);

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      throw new InstantRouteBadRequestError("Request body must be valid JSON.");
    }

    const patch = ensureObjectPayload(parsed);
    const now = new Date().toISOString();
    const instantAdmin = getInstantAdmin();

    const { userProfiles = [] } = await instantAdmin.query({
      userProfiles: {
        $: {
          where: {
            uid: user.id,
          },
        },
      },
    });

    const existingProfile = (userProfiles[0] ?? null) as (UserProfile & { id?: string }) | null;
    const baseProfile = {
      uid: user.id,
      email: user.email ?? existingProfile?.email ?? `${user.id}@local.instant`,
      displayName: existingProfile?.displayName ?? user.email ?? null,
      firstName: existingProfile?.firstName ?? null,
      lastName: existingProfile?.lastName ?? null,
      themeMode: existingProfile?.themeMode ?? "palette",
      theme: existingProfile?.theme ?? "light",
      palette: existingProfile?.palette ?? "ocean",
      collegeTeamId: existingProfile?.collegeTeamId ?? null,
      collegeTeamName: existingProfile?.collegeTeamName ?? null,
      collegeLogoUrl: existingProfile?.collegeLogoUrl ?? null,
      timezone: existingProfile?.timezone ?? "UTC",
      retentionDays: existingProfile?.retentionDays ?? env.softDeleteRetentionDays,
      createdAt: existingProfile?.createdAt ?? patch.createdAt ?? now,
      updatedAt: now,
    };

    const mergedProfile = validateUserProfileWrite({
      ...baseProfile,
      displayName: patch.displayName === undefined ? baseProfile.displayName : normalizeOptionalString(patch.displayName),
      firstName: patch.firstName === undefined ? baseProfile.firstName : normalizeOptionalString(patch.firstName),
      lastName: patch.lastName === undefined ? baseProfile.lastName : normalizeOptionalString(patch.lastName),
      themeMode: patch.themeMode ?? baseProfile.themeMode,
      theme: patch.theme ?? baseProfile.theme,
      palette: patch.palette ?? baseProfile.palette,
      collegeTeamId:
        patch.collegeTeamId === undefined
          ? baseProfile.collegeTeamId
          : normalizeOptionalString(patch.collegeTeamId),
      collegeTeamName:
        patch.collegeTeamName === undefined
          ? baseProfile.collegeTeamName
          : normalizeOptionalString(patch.collegeTeamName),
      collegeLogoUrl:
        patch.collegeLogoUrl === undefined
          ? baseProfile.collegeLogoUrl
          : normalizeOptionalString(patch.collegeLogoUrl),
      timezone: normalizeTimezone(patch.timezone, baseProfile.timezone),
      retentionDays: normalizeRetentionDays(patch.retentionDays, baseProfile.retentionDays),
      createdAt: normalizeCreatedAt(patch.createdAt, baseProfile.createdAt),
      updatedAt: now,
    });

    const targetProfileId = existingProfile?.id ?? user.id;
    const primaryWriteFields = buildProfileWriteFields(mergedProfile, {
      includeThemeMode: true,
      includeCollegeFields: true,
    });

    try {
      await instantAdmin.transact(
        instantAdmin.tx.userProfiles[targetProfileId].update(primaryWriteFields),
      );
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : "";
      const shouldRetryLegacyPayload = message.includes("Attributes are missing in your schema");

      if (!shouldRetryLegacyPayload) {
        throw writeError;
      }

      const legacyWriteFields = buildProfileWriteFields(mergedProfile, {
        includeThemeMode: true,
        includeCollegeFields: true,
        includeCollegeLogoUrl: false,
      });

      await instantAdmin.transact(
        instantAdmin.tx.userProfiles[targetProfileId].update(legacyWriteFields),
      );
    }

    return NextResponse.json({ profile: { ...mergedProfile, id: targetProfileId } });
  } catch (error) {
    if (
      error instanceof InstantAuthError ||
      error instanceof InstantRouteBadRequestError ||
      error instanceof InstantRouteNotFoundError
    ) {
      return instantRouteErrorResponse(error, { route: "/api/profile", method: "PUT", phase: "validation" });
    }

    if (error instanceof Error) {
      logApiFailure({
        route: "/api/profile",
        method: "PUT",
        phase: "unexpected",
        status: 500,
        error,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return instantRouteErrorResponse(error, { route: "/api/profile", method: "PUT", phase: "unexpected" });
  }
}
