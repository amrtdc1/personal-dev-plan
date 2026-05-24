import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";

export function parseIncludeDeleted(searchParams: URLSearchParams) {
  const includeDeleted = searchParams.get("includeDeleted");
  if (!includeDeleted) {
    return false;
  }

  if (includeDeleted === "true") {
    return true;
  }

  if (includeDeleted === "false") {
    return false;
  }

  throw new InstantRouteBadRequestError("includeDeleted must be 'true' or 'false' when provided.");
}

export function parseGoalType(searchParams: URLSearchParams) {
  const type = searchParams.get("type");
  if (!type) {
    return null;
  }

  if (type !== "professional" && type !== "personal") {
    throw new InstantRouteBadRequestError("Goal type must be 'professional' or 'personal' when provided.");
  }

  return type;
}

export function parseRequiredGoalId(searchParams: URLSearchParams) {
  const goalId = searchParams.get("goalId");
  if (!goalId) {
    throw new InstantRouteBadRequestError("Goal id is required.");
  }

  return goalId;
}

export function parseRequiredSubgoalId(searchParams: URLSearchParams) {
  const subgoalId = searchParams.get("subgoalId");
  if (!subgoalId) {
    throw new InstantRouteBadRequestError("Subgoal id is required.");
  }

  return subgoalId;
}

export function parseRequiredHabitId(searchParams: URLSearchParams) {
  const habitId = searchParams.get("habitId");
  if (!habitId) {
    throw new InstantRouteBadRequestError("Habit id is required.");
  }

  return habitId;
}