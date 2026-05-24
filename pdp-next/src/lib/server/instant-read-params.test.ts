import {
  parseGoalType,
  parseIncludeDeleted,
  parseRequiredGoalId,
  parseRequiredHabitId,
  parseRequiredSubgoalId,
} from "@/lib/server/instant-read-params";

describe("instant-read query parsing", () => {
  it("parses includeDeleted with strict true/false semantics", () => {
    expect(parseIncludeDeleted(new URLSearchParams())).toBe(false);
    expect(parseIncludeDeleted(new URLSearchParams("includeDeleted=true"))).toBe(true);
    expect(parseIncludeDeleted(new URLSearchParams("includeDeleted=false"))).toBe(false);
    expect(() => parseIncludeDeleted(new URLSearchParams("includeDeleted=maybe"))).toThrow(
      "includeDeleted must be 'true' or 'false' when provided.",
    );
  });

  it("parses goal type with strict enum semantics", () => {
    expect(parseGoalType(new URLSearchParams())).toBeNull();
    expect(parseGoalType(new URLSearchParams("type=professional"))).toBe("professional");
    expect(parseGoalType(new URLSearchParams("type=personal"))).toBe("personal");
    expect(() => parseGoalType(new URLSearchParams("type=invalid"))).toThrow(
      "Goal type must be 'professional' or 'personal' when provided.",
    );
  });

  it("requires nested parent ids", () => {
    expect(parseRequiredGoalId(new URLSearchParams("goalId=goal-1"))).toBe("goal-1");
    expect(parseRequiredSubgoalId(new URLSearchParams("subgoalId=subgoal-1"))).toBe("subgoal-1");
    expect(parseRequiredHabitId(new URLSearchParams("habitId=habit-1"))).toBe("habit-1");
    expect(() => parseRequiredGoalId(new URLSearchParams())).toThrow("Goal id is required.");
    expect(() => parseRequiredSubgoalId(new URLSearchParams())).toThrow("Subgoal id is required.");
    expect(() => parseRequiredHabitId(new URLSearchParams())).toThrow("Habit id is required.");
  });
});