import { vi } from "vitest";
import type { Goal, Subgoal, Task } from "@/lib/domain/types";

const { queryOnceMock, transactMock } = vi.hoisted(() => ({
  queryOnceMock: vi.fn(),
  transactMock: vi.fn(),
}));

function createTxTable(table: string) {
  return new Proxy(
    {},
    {
      get(_, entityId) {
        return {
          update(payload: Record<string, unknown>) {
            return {
              table,
              entityId: String(entityId),
              payload,
            };
          },
        };
      },
    },
  );
}

vi.mock("@instantdb/react", () => ({
  id: () => "generated-id",
}));

vi.mock("@/lib/instantdb/client", () => ({
  db: {
    queryOnce: queryOnceMock,
    transact: transactMock,
    tx: {
      goals: createTxTable("goals"),
      subgoals: createTxTable("subgoals"),
      tasks: createTxTable("tasks"),
    },
  },
  isInstantConfigured: true,
}));

import { dataRepository } from "@/lib/data/repository";

const NOW_ISO = "2026-05-21T10:00:00.000Z";
const RESTORE_ISO = "2026-07-20T10:00:00.000Z";

function buildGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal-1",
    ownerUid: "user-1",
    type: "professional",
    title: "Goal",
    description: "Desc",
    timeframe: "Q2",
    projectedStartDate: null,
    projectedEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    status: "not_started",
    percentComplete: 0,
    isFocus: true,
    themeColor: "#2563eb",
    orderIndex: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}

function buildSubgoal(overrides: Partial<Subgoal> = {}): Subgoal {
  return {
    id: "subgoal-1",
    ownerUid: "user-1",
    goalId: "goal-1",
    title: "Subgoal",
    description: "Desc",
    timeframe: "Q2",
    projectedStartDate: null,
    projectedEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    status: "not_started",
    percentComplete: 0,
    orderIndex: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    ownerUid: "user-1",
    subgoalId: "subgoal-1",
    title: "Task",
    notes: "Notes",
    dueDate: null,
    status: "not_started",
    percentComplete: 0,
    orderIndex: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}

describe("dataRepository soft-delete cascade", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    queryOnceMock.mockReset();
    transactMock.mockReset();
    transactMock.mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "window", {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("soft deletes a goal and cascades to active descendants", async () => {
    queryOnceMock
      .mockResolvedValueOnce({ data: { goals: [buildGoal()] } })
      .mockResolvedValueOnce({
        data: {
          subgoals: [
            buildSubgoal({ id: "subgoal-active" }),
            buildSubgoal({ id: "subgoal-archived", deletedAt: "2026-05-10T10:00:00.000Z" }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [
            buildTask({ id: "task-active-a", subgoalId: "subgoal-active" }),
            buildTask({
              id: "task-archived-a",
              subgoalId: "subgoal-active",
              deletedAt: "2026-05-11T10:00:00.000Z",
            }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [buildTask({ id: "task-active-b", subgoalId: "subgoal-archived" })],
        },
      });

    const result = await dataRepository.softDeleteGoal("user-1", "goal-1");

    expect(result.deletedAt).toBe(NOW_ISO);
    expect(result.isFocus).toBe(false);
    expect(result.restoreUntil).toBe(RESTORE_ISO);
    expect(result.purgeAt).toBe(RESTORE_ISO);

    expect(transactMock).toHaveBeenCalledTimes(1);
    const [mutations] = transactMock.mock.calls[0] as [Array<{ table: string; entityId: string; payload: Record<string, unknown> }>];

    expect(mutations).toHaveLength(4);
    expect(mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "goals", entityId: "goal-1" }),
        expect.objectContaining({ table: "subgoals", entityId: "subgoal-active" }),
        expect.objectContaining({ table: "tasks", entityId: "task-active-a" }),
        expect.objectContaining({ table: "tasks", entityId: "task-active-b" }),
      ]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "subgoal-archived" })]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "task-archived-a" })]),
    );
  });

  it("restores a goal and only restores descendants from the same cascade timestamp", async () => {
    const cascadeDeletedAt = "2026-05-20T09:00:00.000Z";

    queryOnceMock
      .mockResolvedValueOnce({
        data: { goals: [buildGoal({ deletedAt: cascadeDeletedAt, restoreUntil: RESTORE_ISO, isFocus: false })] },
      })
      .mockResolvedValueOnce({
        data: {
          subgoals: [
            buildSubgoal({ id: "subgoal-restore", deletedAt: cascadeDeletedAt }),
            buildSubgoal({ id: "subgoal-keep-archived", deletedAt: "2026-05-18T09:00:00.000Z" }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [
            buildTask({ id: "task-restore", subgoalId: "subgoal-restore", deletedAt: cascadeDeletedAt }),
            buildTask({
              id: "task-keep-archived",
              subgoalId: "subgoal-restore",
              deletedAt: "2026-05-19T09:00:00.000Z",
            }),
          ],
        },
      });

    const result = await dataRepository.restoreGoal("user-1", "goal-1");

    expect(result.deletedAt).toBeNull();
    expect(result.restoreUntil).toBeNull();
    expect(result.purgeAt).toBeNull();

    expect(transactMock).toHaveBeenCalledTimes(1);
    const [mutations] = transactMock.mock.calls[0] as [Array<{ table: string; entityId: string; payload: Record<string, unknown> }>];

    expect(mutations).toHaveLength(3);
    expect(mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "goals", entityId: "goal-1" }),
        expect.objectContaining({ table: "subgoals", entityId: "subgoal-restore" }),
        expect.objectContaining({ table: "tasks", entityId: "task-restore" }),
      ]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "subgoal-keep-archived" })]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "task-keep-archived" })]),
    );
  });

  it("rejects restoring a goal when the restore window has expired", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [
          buildGoal({
            id: "goal-expired",
            deletedAt: "2026-05-01T09:00:00.000Z",
            restoreUntil: "2026-05-10T09:00:00.000Z",
            isFocus: false,
          }),
        ],
      },
    });

    await expect(dataRepository.restoreGoal("user-1", "goal-expired")).rejects.toThrow(
      "Goal can no longer be restored because the restore window has expired.",
    );
    expect(transactMock).not.toHaveBeenCalled();
  });

  it("soft deletes a subgoal and cascades to its active tasks", async () => {
    queryOnceMock
      .mockResolvedValueOnce({ data: { subgoals: [buildSubgoal({ id: "subgoal-1" })] } })
      .mockResolvedValueOnce({
        data: {
          tasks: [
            buildTask({ id: "task-a", subgoalId: "subgoal-1" }),
            buildTask({ id: "task-b", subgoalId: "subgoal-1", deletedAt: "2026-05-02T10:00:00.000Z" }),
          ],
        },
      });

    const result = await dataRepository.softDeleteSubgoal("user-1", "subgoal-1");

    expect(result.deletedAt).toBe(NOW_ISO);
    expect(result.restoreUntil).toBe(RESTORE_ISO);

    expect(transactMock).toHaveBeenCalledTimes(1);
    const [mutations] = transactMock.mock.calls[0] as [Array<{ table: string; entityId: string; payload: Record<string, unknown> }>];

    expect(mutations).toHaveLength(2);
    expect(mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "subgoals", entityId: "subgoal-1" }),
        expect.objectContaining({ table: "tasks", entityId: "task-a" }),
      ]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "task-b" })]),
    );
  });

  it("rejects restoring a subgoal when the restore window has expired", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        subgoals: [
          buildSubgoal({
            id: "subgoal-expired",
            deletedAt: "2026-05-01T09:00:00.000Z",
            restoreUntil: "2026-05-10T09:00:00.000Z",
          }),
        ],
      },
    });

    await expect(dataRepository.restoreSubgoal("user-1", "subgoal-expired")).rejects.toThrow(
      "Subgoal can no longer be restored because the restore window has expired.",
    );
    expect(transactMock).not.toHaveBeenCalled();
  });

  it("rejects restoring a task when the restore window has expired", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        tasks: [
          buildTask({
            id: "task-expired",
            deletedAt: "2026-05-01T09:00:00.000Z",
            restoreUntil: "2026-05-10T09:00:00.000Z",
          }),
        ],
      },
    });

    await expect(dataRepository.restoreTask("user-1", "task-expired")).rejects.toThrow(
      "Task can no longer be restored because the restore window has expired.",
    );
    expect(transactMock).not.toHaveBeenCalled();
  });

  it("updates goal status and percent complete", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [buildGoal({ id: "goal-status", status: "not_started", percentComplete: 0 })],
      },
    });

    const result = await dataRepository.updateGoalStatus("user-1", "goal-status", "done");

    expect(result.status).toBe("done");
    expect(result.percentComplete).toBe(100);
    expect(result.updatedAt).toBe(NOW_ISO);
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "goals",
        entityId: "goal-status",
        payload: expect.objectContaining({
          status: "done",
          percentComplete: 100,
          updatedAt: NOW_ISO,
        }),
      }),
    );
  });

  it("reorders goals using the supplied id order", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [
          buildGoal({ id: "goal-a", orderIndex: 0, updatedAt: "2026-05-10T00:00:00.000Z" }),
          buildGoal({ id: "goal-b", orderIndex: 1, updatedAt: "2026-05-11T00:00:00.000Z" }),
        ],
      },
    });

    const result = await dataRepository.reorderGoals("user-1", "professional", ["goal-b", "goal-a"]);

    expect(result.map((goal) => [goal.id, goal.orderIndex])).toEqual([
      ["goal-b", 0],
      ["goal-a", 1],
    ]);

    expect(transactMock).toHaveBeenCalledTimes(1);
    const [mutations] = transactMock.mock.calls[0] as [Array<{ table: string; entityId: string; payload: Record<string, unknown> }>];

    expect(mutations).toEqual([
      expect.objectContaining({
        table: "goals",
        entityId: "goal-b",
        payload: expect.objectContaining({ orderIndex: 0, updatedAt: NOW_ISO }),
      }),
      expect.objectContaining({
        table: "goals",
        entityId: "goal-a",
        payload: expect.objectContaining({ orderIndex: 1, updatedAt: NOW_ISO }),
      }),
    ]);
  });

  it("updates subgoal status and percent complete", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        subgoals: [buildSubgoal({ id: "subgoal-status", status: "not_started", percentComplete: 0 })],
      },
    });

    const result = await dataRepository.updateSubgoalStatus("user-1", "subgoal-status", "in_progress");

    expect(result.status).toBe("in_progress");
    expect(result.percentComplete).toBe(50);
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "subgoals",
        entityId: "subgoal-status",
        payload: expect.objectContaining({
          status: "in_progress",
          percentComplete: 50,
          updatedAt: NOW_ISO,
        }),
      }),
    );
  });

  it("reorders subgoals using the supplied id order", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        subgoals: [
          buildSubgoal({ id: "subgoal-a", orderIndex: 0 }),
          buildSubgoal({ id: "subgoal-b", orderIndex: 1 }),
        ],
      },
    });

    const result = await dataRepository.reorderSubgoals("user-1", "goal-1", ["subgoal-b", "subgoal-a"]);

    expect(result.map((subgoal) => [subgoal.id, subgoal.orderIndex])).toEqual([
      ["subgoal-b", 0],
      ["subgoal-a", 1],
    ]);
  });

  it("updates task status and percent complete", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        tasks: [buildTask({ id: "task-status", status: "not_started", percentComplete: 0 })],
      },
    });

    const result = await dataRepository.updateTaskStatus("user-1", "task-status", "done");

    expect(result.status).toBe("done");
    expect(result.percentComplete).toBe(100);
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "tasks",
        entityId: "task-status",
        payload: expect.objectContaining({
          status: "done",
          percentComplete: 100,
          updatedAt: NOW_ISO,
        }),
      }),
    );
  });

  it("reorders tasks using the supplied id order", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        tasks: [
          buildTask({ id: "task-a", orderIndex: 0 }),
          buildTask({ id: "task-b", orderIndex: 1 }),
        ],
      },
    });

    const result = await dataRepository.reorderTasks("user-1", "subgoal-1", ["task-b", "task-a"]);

    expect(result.map((task) => [task.id, task.orderIndex])).toEqual([
      ["task-b", 0],
      ["task-a", 1],
    ]);
  });
});
