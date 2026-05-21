import type {
  Goal,
  ItemStatus,
  Subgoal,
  Task,
} from "@/lib/domain/types";
import type { SaveGoalInput, SaveSubgoalInput, SaveTaskInput } from "@/lib/data/repository";

const ITEM_STATUSES: ItemStatus[] = ["not_started", "in_progress", "done"];
const ALLOWED_COLLEGE_LOGO_HOSTS = new Set([
  "a.espncdn.com",
  "a1.espncdn.com",
  "site.api.espn.com",
  "site.web.api.espn.com",
]);

type UserProfileWriteInput = {
  uid: string;
  email: string;
  displayName: string | null;
  theme: "light" | "dark" | "cwm";
  palette: "ocean" | "sunset" | "forest" | "royal" | "candy" | "dusk" | "lava" | "mint";
  timezone: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
  firstName?: string | null;
  lastName?: string | null;
  collegeLogoUrl?: string | null;
};

export function validateGoalWrite(input: SaveGoalInput) {
  const trimmedTitle = input.title.trim();
  const trimmedDescription = input.description.trim();

  assertRequiredText(trimmedTitle, "Goal title");
  assertValidDateRange(input.projectedStartDate, input.projectedEndDate);

  return {
    trimmedTitle,
    trimmedDescription,
  };
}

export function validateSubgoalWrite(input: SaveSubgoalInput) {
  const trimmedTitle = input.title.trim();
  const trimmedDescription = input.description.trim();

  assertRequiredText(trimmedTitle, "Subgoal title");
  assertValidDateRange(input.projectedStartDate, input.projectedEndDate);

  return {
    trimmedTitle,
    trimmedDescription,
  };
}

export function validateTaskWrite(input: SaveTaskInput) {
  const trimmedTitle = input.title.trim();
  const trimmedNotes = input.notes.trim();

  assertRequiredText(trimmedTitle, "Task title");

  return {
    trimmedTitle,
    trimmedNotes,
  };
}

export function validateUserProfileWrite(input: UserProfileWriteInput) {
  const trimmedEmail = input.email.trim().toLowerCase();
  assertRequiredText(trimmedEmail, "Profile email");

  const sanitizedCollegeLogoUrl = sanitizeCollegeLogoUrlForPersist(input.collegeLogoUrl);

  return {
    ...input,
    email: trimmedEmail,
    collegeLogoUrl: sanitizedCollegeLogoUrl,
  };
}

export function validateStatusUpdate(status: ItemStatus) {
  if (!ITEM_STATUSES.includes(status)) {
    throw new Error("Status value is not supported.");
  }
}

export function validateReorderIds<TEntity extends { id: string }>(
  entities: TEntity[],
  orderedIds: string[],
  entityLabel: string,
) {
  if (entities.length !== orderedIds.length) {
    throw new Error(`Reorder request must include every active ${entityLabel}.`);
  }

  const entityIds = new Set(entities.map((entity) => entity.id));
  const orderedIdSet = new Set(orderedIds);

  if (entityIds.size !== orderedIdSet.size) {
    throw new Error(`Reorder request contains duplicate ${entityLabel} ids.`);
  }

  for (const orderedId of orderedIds) {
    if (!entityIds.has(orderedId)) {
      throw new Error(`Reorder request included an unknown ${entityLabel} id.`);
    }
  }
}

export function assertOwnedGoal(goal: Goal | null, ownerUid: string) {
  return assertOwnedEntity(goal, ownerUid, "Goal");
}

export function assertOwnedSubgoal(subgoal: Subgoal | null, ownerUid: string) {
  return assertOwnedEntity(subgoal, ownerUid, "Subgoal");
}

export function assertOwnedTask(task: Task | null, ownerUid: string) {
  return assertOwnedEntity(task, ownerUid, "Task");
}

function assertRequiredText(value: string, label: string) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
}

function sanitizeCollegeLogoUrlForPersist(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error("College logo URL must use https.");
    }

    if (!ALLOWED_COLLEGE_LOGO_HOSTS.has(parsed.hostname)) {
      throw new Error("College logo URL host is not allowlisted.");
    }

    return parsed.toString();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("College logo URL is invalid.");
  }
}

function assertValidDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return;
  }

  if (startDate > endDate) {
    throw new Error("Projected end date must be on or after the start date.");
  }
}

function assertOwnedEntity<TEntity extends { ownerUid: string }>(
  entity: TEntity | null,
  ownerUid: string,
  entityLabel: string,
) {
  if (!entity) {
    throw new Error(`${entityLabel} was not found for this user.`);
  }

  if (entity.ownerUid !== ownerUid) {
    throw new Error(`${entityLabel} does not belong to this user.`);
  }

  return entity;
}
