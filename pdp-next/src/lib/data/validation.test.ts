import type { Goal, Subgoal, Task } from "@/lib/domain/types";
import {
  assertOwnedGoal,
  assertOwnedSubgoal,
  assertOwnedTask,
  validateGoalWrite,
  validateReorderIds,
  validateStatusUpdate,
  validateSubgoalWrite,
  validateTaskWrite,
  validateUserProfileWrite,
} from "@/lib/data/validation";

describe("data validation helpers", () => {
  it("trims and validates goal writes", () => {
    const result = validateGoalWrite({
      ownerUid: "user-1",
      type: "professional",
      title: "  Goal title  ",
      description: "  Goal description  ",
      projectedStartDate: "2026-05-01",
      projectedEndDate: "2026-05-31",
      isFocus: false,
    });

    expect(result).toEqual({
      trimmedTitle: "Goal title",
      trimmedDescription: "Goal description",
    });
  });

  it("rejects invalid projected date ranges", () => {
    expect(() =>
      validateSubgoalWrite({
        ownerUid: "user-1",
        goalId: "goal-1",
        title: "Subgoal",
        description: "Desc",
        projectedStartDate: "2026-06-10",
        projectedEndDate: "2026-06-01",
      }),
    ).toThrow("Projected end date must be on or after the start date.");
  });

  it("trims task writes and requires a title", () => {
    expect(() =>
      validateTaskWrite({
        ownerUid: "user-1",
        subgoalId: "subgoal-1",
        title: "   ",
        notes: "Notes",
        dueDate: null,
      }),
    ).toThrow("Task title is required.");

    const result = validateTaskWrite({
      ownerUid: "user-1",
      subgoalId: "subgoal-1",
      title: "  Task title  ",
      notes: "  Task notes  ",
      dueDate: null,
    });

    expect(result).toEqual({
      trimmedTitle: "Task title",
      trimmedNotes: "Task notes",
    });
  });

  it("rejects unsupported status values", () => {
    expect(() => validateStatusUpdate("blocked" as never)).toThrow("Status value is not supported.");
  });

  it("rejects reorder requests with unknown ids", () => {
    expect(() =>
      validateReorderIds(
        [{ id: "goal-1" }, { id: "goal-2" }],
        ["goal-1", "goal-3"],
        "goal",
      ),
    ).toThrow("Reorder request included an unknown goal id.");
  });

  it("enforces owner access for supported entities", () => {
    const goal = { ownerUid: "user-1" } as Goal;
    const subgoal = { ownerUid: "user-1" } as Subgoal;
    const task = { ownerUid: "user-1" } as Task;

    expect(assertOwnedGoal(goal, "user-1")).toBe(goal);
    expect(assertOwnedSubgoal(subgoal, "user-1")).toBe(subgoal);
    expect(assertOwnedTask(task, "user-1")).toBe(task);

    expect(() => assertOwnedGoal(goal, "user-2")).toThrow("Goal does not belong to this user.");
    expect(() => assertOwnedSubgoal(null, "user-1")).toThrow("Subgoal was not found for this user.");
    expect(() => assertOwnedTask(task, "user-2")).toThrow("Task does not belong to this user.");
  });

  it("normalizes and validates user profile writes", () => {
    const result = validateUserProfileWrite({
      uid: "user-1",
      email: "  USER@EXAMPLE.COM ",
      firstName: null,
      lastName: null,
      displayName: "User",
      theme: "light",
      palette: "ocean",
      timezone: "UTC",
      retentionDays: 60,
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:00:00.000Z",
      collegeLogoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/9.png",
    });

    expect(result.email).toBe("user@example.com");
    expect(result.collegeLogoUrl).toBe("https://a.espncdn.com/i/teamlogos/ncaa/500/9.png");
  });

  it("rejects profile writes with non-https college logo URLs", () => {
    expect(() =>
      validateUserProfileWrite({
        uid: "user-1",
        email: "user@example.com",
        displayName: "User",
        theme: "light",
        palette: "ocean",
        timezone: "UTC",
        retentionDays: 60,
        createdAt: "2026-05-21T00:00:00.000Z",
        updatedAt: "2026-05-21T00:00:00.000Z",
        collegeLogoUrl: "http://a.espncdn.com/i/teamlogos/ncaa/500/9.png",
      }),
    ).toThrow("College logo URL must use https.");
  });

  it("rejects profile writes with non-allowlisted college logo hosts", () => {
    expect(() =>
      validateUserProfileWrite({
        uid: "user-1",
        email: "user@example.com",
        displayName: "User",
        theme: "light",
        palette: "ocean",
        timezone: "UTC",
        retentionDays: 60,
        createdAt: "2026-05-21T00:00:00.000Z",
        updatedAt: "2026-05-21T00:00:00.000Z",
        collegeLogoUrl: "https://evil.example.com/logo.png",
      }),
    ).toThrow("College logo URL host is not allowlisted.");
  });
});
