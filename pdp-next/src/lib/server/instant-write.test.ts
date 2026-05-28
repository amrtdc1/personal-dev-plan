const {
  queryMock,
  transactMock,
  findOwnedGoalMock,
  findOwnedTaskMock,
  findOwnedHabitMock,
  findOwnedHabitCheckinMock,
  findOwnedJournalEntryMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactMock: vi.fn(),
  findOwnedGoalMock: vi.fn(),
  findOwnedTaskMock: vi.fn(),
  findOwnedHabitMock: vi.fn(),
  findOwnedHabitCheckinMock: vi.fn(),
  findOwnedJournalEntryMock: vi.fn(),
}));

function createTxTable(table: string) {
  return new Proxy(
    {},
    {
      get(_, entityId) {
        return {
          update(payload: Record<string, unknown>) {
            return {
              op: "update",
              table,
              entityId: String(entityId),
              payload,
            };
          },
          delete() {
            return {
              op: "delete",
              table,
              entityId: String(entityId),
            };
          },
        };
      },
    },
  );
}

vi.mock("@/lib/instantdb/admin", () => ({
  getInstantAdmin: () => ({
    query: queryMock,
    transact: transactMock,
    tx: {
      goals: createTxTable("goals"),
      tasks: createTxTable("tasks"),
      journalEntries: createTxTable("journalEntries"),
      habits: createTxTable("habits"),
      habitCheckins: createTxTable("habitCheckins"),
    },
  }),
}));

vi.mock("@/lib/server/instant-route", () => ({
  findOwnedGoal: findOwnedGoalMock,
  findOwnedTask: findOwnedTaskMock,
  findOwnedHabit: findOwnedHabitMock,
  findOwnedHabitCheckin: findOwnedHabitCheckinMock,
  findOwnedJournalEntry: findOwnedJournalEntryMock,
}));

import { createTask, updateTask } from "@/lib/server/instant-write";
import {
  parseHabitCheckinWritePayload,
  parseGoalWritePayload,
  parseHabitWritePayload,
  parseTaskWritePayload,
} from "@/lib/server/instant-write-params";

function buildRequest(body: unknown) {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("instant write payload parsing", () => {
  beforeEach(() => {
    queryMock.mockReset();
    transactMock.mockReset();
    findOwnedGoalMock.mockReset();
    findOwnedTaskMock.mockReset();
    findOwnedHabitMock.mockReset();
    findOwnedHabitCheckinMock.mockReset();
    findOwnedJournalEntryMock.mockReset();
  });

  it("parses goal payload and normalizes empty optional date fields to null", async () => {
    const payload = await parseGoalWritePayload(
      buildRequest({
        type: "professional",
        timeframeLevel: "weekly",
        title: "Ship checkpoint",
        description: "Complete protected route coverage",
        projectedStartDate: "",
        projectedEndDate: null,
        timeframeLabel: "Sprint 8",
        isFocus: true,
      }),
    );

    expect(payload).toEqual({
      type: "professional",
      parentGoalId: null,
      timeframeLevel: "weekly",
      title: "Ship checkpoint",
      description: "Complete protected route coverage",
      projectedStartDate: null,
      projectedEndDate: null,
      timeframeLabel: "Sprint 8",
      isFocus: true,
    });
  });

  it("rejects goal payload when focus flag is missing", async () => {
    await expect(
      parseGoalWritePayload(
        buildRequest({
          type: "professional",
          timeframeLevel: "weekly",
          title: "Ship checkpoint",
          description: "Complete protected route coverage",
        }),
      ),
    ).rejects.toThrow("Goal focus flag is required.");
  });

  it("requires goal timeframe level when omitted", async () => {
    await expect(
      parseGoalWritePayload(
        buildRequest({
          type: "professional",
          title: "Ship checkpoint",
          description: "Complete protected route coverage",
          isFocus: true,
        }),
      ),
    ).rejects.toThrow("Goal timeframe level is required.");
  });

  it("parses optional goal parent id and timeframe level", async () => {
    const payload = await parseGoalWritePayload(
      buildRequest({
        type: "professional",
        parentGoalId: " goal-1 ",
        timeframeLevel: "annual",
        title: "Grow strategic scope",
        description: "Extend planning horizon",
        isFocus: false,
      }),
    );

    expect(payload.parentGoalId).toBe("goal-1");
    expect(payload.timeframeLevel).toBe("annual");
  });

  it("rejects unsupported goal timeframe level values", async () => {
    await expect(
      parseGoalWritePayload(
        buildRequest({
          type: "professional",
          timeframeLevel: "biweekly",
          title: "Ship checkpoint",
          description: "Complete protected route coverage",
          isFocus: true,
        }),
      ),
    ).rejects.toThrow("Goal timeframe level is not supported.");
  });

  it("parses valid task payload", async () => {
    const payload = await parseTaskWritePayload(
      buildRequest({
        parentGoalId: "goal-1",
        title: "Record smoke results",
        notes: "Paste URL and status",
        dueDate: "2026-05-30",
        unplanned: true,
      }),
    );

    expect(payload).toEqual({
      parentGoalId: "goal-1",
      title: "Record smoke results",
      notes: "Paste URL and status",
      dueDate: "2026-05-30",
      unplanned: true,
      originalDueDate: null,
      snoozedDueDate: null,
      snoozeCount: 0,
    });
  });

  it("defaults task unplanned flag to false when omitted", async () => {
    const payload = await parseTaskWritePayload(
      buildRequest({
        goalId: "goal-1",
        title: "Record smoke results",
        notes: "Paste URL and status",
      }),
    );

    expect(payload.unplanned).toBe(false);
    expect(payload.originalDueDate).toBeNull();
    expect(payload.snoozedDueDate).toBeNull();
    expect(payload.snoozeCount).toBe(0);
  });

  it("rejects task payload when unplanned is not a boolean", async () => {
    await expect(
      parseTaskWritePayload(
        buildRequest({
          goalId: "goal-1",
          title: "Record smoke results",
          notes: "Paste URL and status",
          unplanned: "yes",
        }),
      ),
    ).rejects.toThrow("Task unplanned flag must be a boolean when provided.");
  });

  it("rejects task payload when notes are missing", async () => {
    await expect(
      parseTaskWritePayload(
        buildRequest({
          goalId: "goal-1",
          title: "Record smoke results",
        }),
      ),
    ).rejects.toThrow("Task notes are required.");
  });

  it("rejects invalid JSON bodies", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      body: "{ not-valid-json",
    });

    await expect(parseTaskWritePayload(request)).rejects.toThrow("Request body must be valid JSON.");
  });

  it("creates unplanned tasks even when existing unplanned rows have invalid orderIndex values", async () => {
    queryMock.mockResolvedValueOnce({
      tasks: [
        {
          id: "task-legacy-unplanned",
          ownerUid: "user-1",
          goalId: "unplanned",
          title: "Legacy unplanned task",
          notes: "",
          dueDate: null,
          unplanned: true,
          status: "not_started",
          percentComplete: 0,
          orderIndex: Number.NaN,
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
          deletedAt: null,
          deletedBy: null,
          restoreUntil: null,
          purgeAt: null,
        },
      ],
    });

    const task = await createTask("user-1", {
      parentGoalId: null,
      title: "Inbox triage",
      notes: "",
      dueDate: null,
      unplanned: true,
      originalDueDate: null,
      snoozedDueDate: null,
      snoozeCount: 0,
    });

    expect(findOwnedGoalMock).not.toHaveBeenCalled();
    expect(task.orderIndex).toBe(0);
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "tasks",
        payload: expect.objectContaining({
          orderIndex: 0,
          parentGoalId: null,
          unplanned: true,
        }),
      }),
    );
  });

  it("updates task when unchanged legacy parentGoalId cannot be resolved as a goal", async () => {
    findOwnedTaskMock.mockResolvedValueOnce({
      id: "task-1",
      ownerUid: "user-1",
      parentGoalId: "legacy-child-goal-1",
      title: "Existing task",
      notes: "",
      dueDate: "2026-05-24",
      unplanned: false,
      originalDueDate: null,
      snoozedDueDate: null,
      snoozeCount: 0,
      status: "not_started",
      percentComplete: 0,
      orderIndex: 3,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z",
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    });

    const updatedTask = await updateTask("user-1", "task-1", {
      parentGoalId: "legacy-child-goal-1",
      title: "Existing task",
      notes: "",
      dueDate: "2026-05-27",
      unplanned: false,
      originalDueDate: "2026-05-24",
      snoozedDueDate: "2026-05-27",
      snoozeCount: 1,
    });

    expect(findOwnedGoalMock).not.toHaveBeenCalled();
    expect(updatedTask.parentGoalId).toBe("legacy-child-goal-1");
    expect(updatedTask.dueDate).toBe("2026-05-27");
    expect(updatedTask.snoozedDueDate).toBe("2026-05-27");
    expect(updatedTask.snoozeCount).toBe(1);
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "tasks",
        entityId: "task-1",
        payload: expect.objectContaining({
          parentGoalId: "legacy-child-goal-1",
          dueDate: "2026-05-27",
          snoozedDueDate: "2026-05-27",
          snoozeCount: 1,
        }),
      }),
    );
  });

  it("parses valid habit payload and defaults status", async () => {
    const payload = await parseHabitWritePayload(
      buildRequest({
        title: "Write daily summary",
        cadence: "daily",
        targetCount: 1,
      }),
    );

    expect(payload).toEqual({
      title: "Write daily summary",
      cadence: "daily",
      targetCount: 1,
      status: "active",
    });
  });

  it("rejects habit payload when target count is invalid", async () => {
    await expect(
      parseHabitWritePayload(
        buildRequest({
          title: "Write daily summary",
          cadence: "daily",
          targetCount: 0,
        }),
      ),
    ).rejects.toThrow("Habit target count must be greater than zero.");
  });

  it("parses habit checkin payload", async () => {
    const payload = await parseHabitCheckinWritePayload(
      buildRequest({
        checkInDate: "2026-05-24",
        notes: " Completed review ",
      }),
    );

    expect(payload).toEqual({
      checkInDate: "2026-05-24",
      notes: "Completed review",
    });
  });

  it("rejects habit checkin payload when date is missing", async () => {
    await expect(
      parseHabitCheckinWritePayload(
        buildRequest({
          notes: "Completed review",
        }),
      ),
    ).rejects.toThrow("Habit check-in date is required.");
  });
});
