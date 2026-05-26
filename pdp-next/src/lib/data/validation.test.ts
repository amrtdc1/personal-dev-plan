import type { Goal, JournalEntry, ChildGoal, Task } from "@/lib/domain/types";
import {
  assertOwnedGoal,
  assertOwnedJournalEntry,
  assertOwnedChildGoal,
  assertOwnedTask,
  validateGoalWrite,
  validateJournalEntryWrite,
  validateReorderIds,
  validateStatusUpdate,
  validateChildGoalWrite,
  validateTaskWrite,
  validateUserProfileWrite,
} from "@/lib/data/validation";

describe("data validation helpers", () => {
  it("trims and validates goal writes", () => {
    const result = validateGoalWrite({
      ownerUid: "user-1",
      type: "professional",
      timeframeLevel: "weekly",
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

  it("requires goal timeframe levels", () => {
    expect(() =>
      validateGoalWrite({
        ownerUid: "user-1",
        type: "professional",
        title: "Goal title",
        description: "Goal description",
        projectedStartDate: null,
        projectedEndDate: null,
        isFocus: false,
      }),
    ).toThrow("Goal timeframe level is required.");
  });

  it("rejects unsupported goal timeframe levels", () => {
    expect(() =>
      validateGoalWrite({
        ownerUid: "user-1",
        type: "professional",
        timeframeLevel: "biweekly" as never,
        title: "Goal title",
        description: "Goal description",
        projectedStartDate: null,
        projectedEndDate: null,
        isFocus: false,
      }),
    ).toThrow("Goal timeframe level is not supported.");
  });

  it("rejects goal self-parent links", () => {
    expect(() =>
      validateGoalWrite({
        goalId: "goal-1",
        ownerUid: "user-1",
        type: "professional",
        parentGoalId: "goal-1",
        timeframeLevel: "weekly",
        title: "Goal title",
        description: "Goal description",
        projectedStartDate: null,
        projectedEndDate: null,
        isFocus: false,
      }),
    ).toThrow("Goal cannot be its own parent.");
  });

  it("rejects invalid projected date ranges", () => {
    expect(() =>
      validateChildGoalWrite({
        ownerUid: "user-1",
        goalId: "goal-1",
        title: "ChildGoal",
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
        goalId: "childGoal-1",
        title: "   ",
        notes: "Notes",
        dueDate: null,
      }),
    ).toThrow("Task title is required.");

    const result = validateTaskWrite({
      ownerUid: "user-1",
      goalId: "childGoal-1",
      title: "  Task title  ",
      notes: "  Task notes  ",
      dueDate: null,
    });

    expect(result).toEqual({
      trimmedTitle: "Task title",
      trimmedNotes: "Task notes",
    });
  });

  it("normalizes journal writes", () => {
    const result = validateJournalEntryWrite({
      ownerUid: "user-1",
      title: "  Week 20 reflection  ",
      content: "  I made solid progress.  ",
      mood: "  Good  ",
      tags: [" Focus ", "Focus", "Work", " "],
      relatedGoalId: "  goal-1  ",
    });

    expect(result).toEqual({
      trimmedTitle: "Week 20 reflection",
      trimmedContent: "I made solid progress.",
      normalizedMood: "Good",
      normalizedTags: ["focus", "work"],
      normalizedRelatedGoalId: "goal-1",
    });
  });

  it("requires a journal title", () => {
    expect(() =>
      validateJournalEntryWrite({
        ownerUid: "user-1",
        title: "   ",
        content: "Body",
        mood: null,
        tags: [],
        relatedGoalId: null,
      }),
    ).toThrow("Journal title is required.");
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
    const childGoal = { ownerUid: "user-1" } as ChildGoal;
    const task = { ownerUid: "user-1" } as Task;
    const entry = { ownerUid: "user-1" } as JournalEntry;

    expect(assertOwnedGoal(goal, "user-1")).toBe(goal);
    expect(assertOwnedChildGoal(childGoal, "user-1")).toBe(childGoal);
    expect(assertOwnedTask(task, "user-1")).toBe(task);
    expect(assertOwnedJournalEntry(entry, "user-1")).toBe(entry);

    expect(() => assertOwnedGoal(goal, "user-2")).toThrow("Goal does not belong to this user.");
    expect(() => assertOwnedChildGoal(null, "user-1")).toThrow("ChildGoal was not found for this user.");
    expect(() => assertOwnedTask(task, "user-2")).toThrow("Task does not belong to this user.");
    expect(() => assertOwnedJournalEntry(null, "user-1")).toThrow("Journal entry was not found for this user.");
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
