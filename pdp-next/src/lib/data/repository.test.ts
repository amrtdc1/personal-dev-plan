import type { Goal, Habit, HabitCheckin, JournalEntry, ChildGoal, Task } from "@/lib/domain/types";

// Keep mocks in vi.hoisted so they are initialized before hoisted vi.mock factories run.
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

vi.mock("@instantdb/react", () => ({
  id: () => "generated-id",
}));

vi.mock("@/lib/instantdb/client", () => ({
  db: {
    queryOnce: queryOnceMock,
    transact: transactMock,
    tx: {
      goals: createTxTable("goals"),
      childGoals: createTxTable("childGoals"),
      tasks: createTxTable("tasks"),
      journalEntries: createTxTable("journalEntries"),
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
    parentGoalId: null,
    timeframeLevel: "quarterly",
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

function buildChildGoal(overrides: Partial<ChildGoal> = {}): ChildGoal {
  return {
    id: "childGoal-1",
    ownerUid: "user-1",
    goalId: "goal-1",
    title: "ChildGoal",
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
  const normalizedGoalId = overrides.goalId ?? "childGoal-1";

  return {
    id: "task-1",
    ownerUid: "user-1",
    goalId: normalizedGoalId,
    title: "Task",
    notes: "Notes",
    dueDate: null,
    unplanned: false,
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

function buildJournalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "journal-1",
    ownerUid: "user-1",
    title: "Weekly reflection",
    content: "# Heading\n\nBody",
    mood: null,
    tags: [],
    relatedGoalId: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}

function buildHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    ownerUid: "user-1",
    title: "Daily review",
    cadence: "daily",
    targetCount: 1,
    status: "active",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}

function buildHabitCheckin(overrides: Partial<HabitCheckin> = {}): HabitCheckin {
  return {
    id: "checkin-1",
    ownerUid: "user-1",
    habitId: "habit-1",
    checkInDate: "2026-05-21",
    notes: "Completed",
    createdAt: "2026-05-21T00:00:00.000Z",
    updatedAt: "2026-05-21T00:00:00.000Z",
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
          goals: [
            buildGoal({ id: "childGoal-active", parentGoalId: "goal-1" }),
            buildGoal({ id: "childGoal-archived", parentGoalId: "goal-1", deletedAt: "2026-05-10T10:00:00.000Z" }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [
            buildTask({ id: "task-active-a", goalId: "childGoal-active" }),
            buildTask({
              id: "task-archived-a",
              goalId: "childGoal-active",
              deletedAt: "2026-05-11T10:00:00.000Z",
            }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [buildTask({ id: "task-active-b", goalId: "childGoal-archived" })],
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
        expect.objectContaining({ table: "goals", entityId: "childGoal-active" }),
        expect.objectContaining({ table: "tasks", entityId: "task-active-a" }),
        expect.objectContaining({ table: "tasks", entityId: "task-active-b" }),
      ]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "childGoal-archived" })]),
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
          goals: [
            buildGoal({ id: "childGoal-restore", parentGoalId: "goal-1", deletedAt: cascadeDeletedAt }),
            buildGoal({
              id: "childGoal-keep-archived",
              parentGoalId: "goal-1",
              deletedAt: "2026-05-18T09:00:00.000Z",
            }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [
            buildTask({ id: "task-restore", goalId: "childGoal-restore", deletedAt: cascadeDeletedAt }),
            buildTask({
              id: "task-keep-archived",
              goalId: "childGoal-restore",
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
        expect.objectContaining({ table: "goals", entityId: "childGoal-restore" }),
        expect.objectContaining({ table: "tasks", entityId: "task-restore" }),
      ]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "childGoal-keep-archived" })]),
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

  it("soft deletes a childGoal and cascades to its active tasks", async () => {
    queryOnceMock
      .mockResolvedValueOnce({ data: { goals: [buildGoal({ id: "childGoal-1", parentGoalId: "goal-1" })] } })
      .mockResolvedValueOnce({
        data: {
          tasks: [
            buildTask({ id: "task-a", goalId: "childGoal-1" }),
            buildTask({ id: "task-b", goalId: "childGoal-1", deletedAt: "2026-05-02T10:00:00.000Z" }),
          ],
        },
      });

    const result = await dataRepository.softDeleteChildGoal("user-1", "childGoal-1");

    expect(result.deletedAt).toBe(NOW_ISO);
    expect(result.restoreUntil).toBe(RESTORE_ISO);

    expect(transactMock).toHaveBeenCalledTimes(1);
    const [mutations] = transactMock.mock.calls[0] as [Array<{ table: string; entityId: string; payload: Record<string, unknown> }>];

    expect(mutations).toHaveLength(2);
    expect(mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "goals", entityId: "childGoal-1" }),
        expect.objectContaining({ table: "tasks", entityId: "task-a" }),
      ]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: "task-b" })]),
    );
  });

  it("rejects restoring a childGoal when the restore window has expired", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [
          buildGoal({
            id: "childGoal-expired",
            parentGoalId: "goal-1",
            deletedAt: "2026-05-01T09:00:00.000Z",
            restoreUntil: "2026-05-10T09:00:00.000Z",
          }),
        ],
      },
    });

    await expect(dataRepository.restoreChildGoal("user-1", "childGoal-expired")).rejects.toThrow(
      "ChildGoal can no longer be restored because the restore window has expired.",
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

  it("purges expired deleted records and cascades purge to descendants of expired goals", async () => {
    queryOnceMock.mockImplementation(async (query: Record<string, unknown>) => {
      if ("goals" in query) {
        const where = (query.goals as { $?: { where?: Record<string, unknown> } }).$?.where;

        if (where && "type" in where) {
          return {
            data: {
              goals: [
                buildGoal({
                  id: "goal-expired",
                  deletedAt: "2026-05-01T09:00:00.000Z",
                  purgeAt: "2026-05-20T09:00:00.000Z",
                }),
                buildGoal({
                  id: "goal-active",
                  deletedAt: null,
                  purgeAt: null,
                }),
                buildGoal({
                  id: "goal-not-expired",
                  deletedAt: "2026-05-20T09:00:00.000Z",
                  purgeAt: "2026-05-30T09:00:00.000Z",
                }),
              ],
            },
          };
        }

        return {
          data: {
            goals: [
              buildGoal({ id: "goal-expired", deletedAt: "2026-05-01T09:00:00.000Z", purgeAt: "2026-05-20T09:00:00.000Z" }),
              buildGoal({ id: "goal-active", deletedAt: null, purgeAt: null }),
              buildGoal({ id: "goal-not-expired", deletedAt: "2026-05-20T09:00:00.000Z", purgeAt: "2026-05-30T09:00:00.000Z" }),
              buildGoal({
                id: "childGoal-under-expired-goal",
                parentGoalId: "goal-expired",
                deletedAt: "2026-05-20T09:00:00.000Z",
                purgeAt: "2026-05-30T09:00:00.000Z",
              }),
              buildGoal({
                id: "childGoal-expired-direct",
                parentGoalId: "goal-active",
                deletedAt: "2026-05-15T09:00:00.000Z",
                purgeAt: "2026-05-20T09:00:00.000Z",
              }),
              buildGoal({
                id: "childGoal-not-expired",
                parentGoalId: "goal-not-expired",
                deletedAt: "2026-05-20T09:00:00.000Z",
                purgeAt: "2026-05-30T09:00:00.000Z",
              }),
            ],
          },
        };
      }

      return {
        data: {
          tasks: [
            buildTask({
              id: "task-under-purged-childGoal",
              goalId: "childGoal-under-expired-goal",
              deletedAt: "2026-05-20T09:00:00.000Z",
              purgeAt: "2026-05-30T09:00:00.000Z",
            }),
            buildTask({
              id: "task-expired-direct",
              goalId: "childGoal-not-expired",
              deletedAt: "2026-05-10T09:00:00.000Z",
              purgeAt: "2026-05-20T09:00:00.000Z",
            }),
            buildTask({
              id: "task-not-expired",
              goalId: "childGoal-not-expired",
              deletedAt: "2026-05-20T09:00:00.000Z",
              purgeAt: "2026-05-30T09:00:00.000Z",
            }),
          ],
        },
      };
    });

    const summary = await dataRepository.purgeExpiredDeletedEntities("user-1");

    expect(summary).toEqual({
      goals: 1,
      childGoals: 2,
      tasks: 2,
      purgedAt: NOW_ISO,
    });

    expect(transactMock).toHaveBeenCalledTimes(1);
    const [mutations] = transactMock.mock.calls[0] as [Array<{ op: string; table: string; entityId: string }>];
    expect(mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "delete", table: "goals", entityId: "goal-expired" }),
        expect.objectContaining({ op: "delete", table: "goals", entityId: "childGoal-under-expired-goal" }),
        expect.objectContaining({ op: "delete", table: "goals", entityId: "childGoal-expired-direct" }),
        expect.objectContaining({ op: "delete", table: "tasks", entityId: "task-under-purged-childGoal" }),
        expect.objectContaining({ op: "delete", table: "tasks", entityId: "task-expired-direct" }),
      ]),
    );
    expect(mutations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: "goal-not-expired" }),
        expect.objectContaining({ entityId: "childGoal-not-expired" }),
        expect.objectContaining({ entityId: "task-not-expired" }),
      ]),
    );
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

  it("falls back to protected API goal save when client perms reject writes", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [],
      },
    });

    transactMock.mockRejectedValueOnce(new Error("Permission denied: not perms-pass?"));

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ goal: { id: "goal-server" } }), { status: 201 }));

    const result = await dataRepository.saveGoal({
      ownerUid: "user-1",
      type: "professional",
      timeframeLevel: "quarterly",
      title: "Create via fallback",
      description: "desc",
      projectedStartDate: null,
      projectedEndDate: null,
      timeframeLabel: "Q3",
      isFocus: true,
    });

    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
    expect(transactMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/goals",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );

    fetchSpy.mockRestore();
  });

  it("loads goals via protected API route in browser runtime", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          goals: [
            buildGoal({ id: "goal-api", title: "From API" }),
          ],
        }),
        { status: 200 },
      ),
    );

    const goals = await dataRepository.listGoals("user-1", "professional");

    expect(goals).toHaveLength(1);
    expect(goals[0]?.id).toBe("goal-api");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/goals"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );

    fetchSpy.mockRestore();
  });

  it("rejects goals missing required timeframe level from protected API", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const legacyGoal = {
      id: "goal-legacy",
      ownerUid: "user-1",
      type: "professional",
      title: "Legacy goal",
      description: "Older goal without timeframe level",
      timeframe: "Q2",
      projectedStartDate: null,
      projectedEndDate: null,
      actualStartDate: null,
      actualEndDate: null,
      status: "not_started",
      percentComplete: 0,
      isFocus: false,
      themeColor: "#2563eb",
      orderIndex: 0,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          goals: [legacyGoal],
        }),
        { status: 200 },
      ),
    );

    await expect(dataRepository.listGoals("user-1", "professional")).rejects.toThrow(
      "Goal timeframe level is required.",
    );

    fetchSpy.mockRestore();
  });

  it("persists goal hierarchy fields through protected goal save route", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 200 }));

    await dataRepository.saveGoal({
      goalId: "goal-1",
      ownerUid: "user-1",
      type: "professional",
      timeframeLevel: "weekly",
      parentGoalId: "goal-parent-1",
      title: "Weekly execution",
      description: "Focus on near-term execution",
      projectedStartDate: null,
      projectedEndDate: null,
      timeframeLabel: "Week 22",
      isFocus: true,
      existingGoal: buildGoal({ id: "goal-1" }),
    });

    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(requestInit.body));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/goals/goal-1",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
      }),
    );
    expect(parsedBody).toEqual(
      expect.objectContaining({
        type: "professional",
        timeframeLevel: "weekly",
        parentGoalId: "goal-parent-1",
        title: "Weekly execution",
      }),
    );

    fetchSpy.mockRestore();
  });

  it("normalizes legacy tasks without unplanned to false from protected API", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tasks: [
            {
              id: "task-legacy",
              ownerUid: "user-1",
              goalId: "childGoal-1",
              title: "Legacy task",
              notes: "",
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
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const tasks = await dataRepository.listTasks("user-1", "childGoal-1");

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe("task-legacy");
    expect(tasks[0]?.unplanned).toBe(false);

    fetchSpy.mockRestore();
  });

  it("persists task unplanned flag through protected task update route", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 200 }));

    await dataRepository.saveTask({
      taskId: "task-1",
      ownerUid: "user-1",
      goalId: "childGoal-1",
      title: "Task",
      notes: "Notes",
      dueDate: null,
      unplanned: true,
      existingTask: buildTask({ id: "task-1", unplanned: false }),
    });

    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(requestInit.body));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/tasks/task-1",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
      }),
    );
    expect(parsedBody).toEqual(
      expect.objectContaining({
        goalId: "childGoal-1",
        title: "Task",
        notes: "Notes",
        dueDate: null,
        unplanned: true,
      }),
    );

    fetchSpy.mockRestore();
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

  it("updates childGoal status and percent complete", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [buildGoal({ id: "childGoal-status", parentGoalId: "goal-1", status: "not_started", percentComplete: 0 })],
      },
    });

    const result = await dataRepository.updateChildGoalStatus("user-1", "childGoal-status", "in_progress");

    expect(result.status).toBe("in_progress");
    expect(result.percentComplete).toBe(50);
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "goals",
        entityId: "childGoal-status",
        payload: expect.objectContaining({
          status: "in_progress",
          percentComplete: 50,
          updatedAt: NOW_ISO,
        }),
      }),
    );
  });

  it("reorders childGoals using the supplied id order", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [
          buildGoal({ id: "childGoal-a", parentGoalId: "goal-1", orderIndex: 0 }),
          buildGoal({ id: "childGoal-b", parentGoalId: "goal-1", orderIndex: 1 }),
        ],
      },
    });

    const result = await dataRepository.reorderChildGoals("user-1", "goal-1", ["childGoal-b", "childGoal-a"]);

    expect(result.map((childGoal) => [childGoal.id, childGoal.orderIndex])).toEqual([
      ["childGoal-b", 0],
      ["childGoal-a", 1],
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

    const result = await dataRepository.reorderTasks("user-1", "childGoal-1", ["task-b", "task-a"]);

    expect(result.map((task) => [task.id, task.orderIndex])).toEqual([
      ["task-b", 0],
      ["task-a", 1],
    ]);
  });

  it("lists active journal entries ordered by newest update", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        journalEntries: [
          buildJournalEntry({ id: "journal-old", updatedAt: "2026-05-10T00:00:00.000Z" }),
          buildJournalEntry({ id: "journal-new", updatedAt: "2026-05-20T00:00:00.000Z" }),
          buildJournalEntry({
            id: "journal-archived",
            updatedAt: "2026-05-21T00:00:00.000Z",
            deletedAt: "2026-05-21T00:00:00.000Z",
          }),
        ],
      },
    });

    const entries = await dataRepository.listJournalEntries("user-1");

    expect(entries.map((entry) => entry.id)).toEqual(["journal-new", "journal-old"]);
  });

  it("saves a journal entry", async () => {
    const result = await dataRepository.saveJournalEntry({
      ownerUid: "user-1",
      title: "  Weekly reflection  ",
      content: "  Progress this week  ",
      mood: "  good  ",
      tags: ["Focus", "focus", "Work"],
      relatedGoalId: "goal-1",
    });

    expect(typeof result.id).toBe("string");
    expect(result.title).toBe("Weekly reflection");
    expect(result.content).toBe("Progress this week");
    expect(result.mood).toBe("good");
    expect(result.tags).toEqual(["focus", "work"]);
    expect(result.updatedAt).toBe(NOW_ISO);

    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "journalEntries",
        entityId: result.id,
        payload: expect.objectContaining({
          title: "Weekly reflection",
          content: "Progress this week",
          mood: "good",
          tags: ["focus", "work"],
          relatedGoalId: "goal-1",
        }),
      }),
    );
  });

  it("soft deletes and restores a journal entry", async () => {
    queryOnceMock.mockResolvedValueOnce({
      data: {
        journalEntries: [buildJournalEntry({ id: "journal-1" })],
      },
    });

    const deleted = await dataRepository.softDeleteJournalEntry("user-1", "journal-1");
    expect(deleted.deletedAt).toBe(NOW_ISO);
    expect(deleted.restoreUntil).toBe(RESTORE_ISO);
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "journalEntries",
        entityId: "journal-1",
        payload: expect.objectContaining({
          deletedAt: NOW_ISO,
          deletedBy: "user-1",
        }),
      }),
    );

    transactMock.mockClear();

    queryOnceMock.mockResolvedValueOnce({
      data: {
        journalEntries: [buildJournalEntry({ id: "journal-1", deletedAt: NOW_ISO, restoreUntil: RESTORE_ISO })],
      },
    });

    const restored = await dataRepository.restoreJournalEntry("user-1", "journal-1");
    expect(restored.deletedAt).toBeNull();
    expect(restored.restoreUntil).toBeNull();
    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "journalEntries",
        entityId: "journal-1",
        payload: expect.objectContaining({
          deletedAt: null,
          deletedBy: null,
          restoreUntil: null,
          purgeAt: null,
        }),
      }),
    );
  });

  it("lists habits via protected API route", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          habits: [
            buildHabit({ id: "habit-old", updatedAt: "2026-05-20T00:00:00.000Z" }),
            buildHabit({ id: "habit-new", updatedAt: "2026-05-21T00:00:00.000Z" }),
          ],
        }),
        { status: 200 },
      ),
    );

    const habits = await dataRepository.listHabits("user-1");

    expect(habits.map((habit) => habit.id)).toEqual(["habit-new", "habit-old"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/habits"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );

    fetchSpy.mockRestore();
  });

  it("saves a habit via protected API route", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ habit: buildHabit({ id: "habit-api" }) }), { status: 201 }),
    );

    const result = await dataRepository.saveHabit({
      ownerUid: "user-1",
      title: "  Daily review  ",
      cadence: "daily",
      targetCount: 1,
    });

    expect(result.id).toBe("habit-api");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/habits",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );

    fetchSpy.mockRestore();
  });

  it("saves and deletes habit checkins via protected API routes", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { origin: "http://localhost:3000" },
      },
      configurable: true,
      writable: true,
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ checkin: buildHabitCheckin({ id: "checkin-new" }) }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: { deletedCheckinId: "checkin-new" } }), { status: 200 }));

    const checkin = await dataRepository.saveHabitCheckin({
      ownerUid: "user-1",
      habitId: "habit-1",
      checkInDate: "2026-05-21",
      notes: " Completed ",
    });

    await dataRepository.deleteHabitCheckin("user-1", "habit-1", "checkin-new");

    expect(checkin.id).toBe("checkin-new");
    expect(checkin.notes).toBe("Completed");
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "/api/habits/habit-1/checkins",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/habits/habit-1/checkins/checkin-new",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );

    fetchSpy.mockRestore();
  });
});

describe("dataRepository offline queue expansion", () => {
  const storageState = new Map<string, string>();

  function installOfflineCapableWindow() {
    const localStorage = {
      getItem(key: string) {
        return storageState.has(key) ? storageState.get(key)! : null;
      },
      setItem(key: string, value: string) {
        storageState.set(key, value);
      },
      removeItem(key: string) {
        storageState.delete(key);
      },
    };

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage,
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    queryOnceMock.mockReset();
    transactMock.mockReset();
    transactMock.mockResolvedValue(undefined);
    storageState.clear();
    installOfflineCapableWindow();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues status updates while offline", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [buildGoal({ id: "goal-offline-status" })],
      },
    });

    const result = await dataRepository.updateGoalStatus("user-1", "goal-offline-status", "done");

    expect(result.status).toBe("done");
    expect(transactMock).not.toHaveBeenCalled();

    const rawQueue = storageState.get("pdp.offline.writeQueue") ?? "[]";
    const queue = JSON.parse(rawQueue) as Array<{ operation: string; payload: { goalId?: string; status?: string } }>;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual(
      expect.objectContaining({
        operation: "updateGoalStatus",
        payload: expect.objectContaining({ goalId: "goal-offline-status", status: "done" }),
      }),
    );
  });

  it("queues reorder mutations while offline", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [
          buildGoal({ id: "goal-a", orderIndex: 0 }),
          buildGoal({ id: "goal-b", orderIndex: 1 }),
        ],
      },
    });

    const reordered = await dataRepository.reorderGoals("user-1", "professional", ["goal-b", "goal-a"]);

    expect(reordered.map((goal) => goal.id)).toEqual(["goal-b", "goal-a"]);
    expect(transactMock).not.toHaveBeenCalled();

    const rawQueue = storageState.get("pdp.offline.writeQueue") ?? "[]";
    const queue = JSON.parse(rawQueue) as Array<{ operation: string; payload: { orderedGoalIds?: string[] } }>;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual(
      expect.objectContaining({
        operation: "reorderGoals",
        payload: expect.objectContaining({ orderedGoalIds: ["goal-b", "goal-a"] }),
      }),
    );
  });

  it("queues archive mutations while offline and replays them when online", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        tasks: [buildTask({ id: "task-archive" })],
      },
    });

    const archived = await dataRepository.softDeleteTask("user-1", "task-archive");
    expect(archived.deletedAt).toBe(NOW_ISO);
    expect(transactMock).not.toHaveBeenCalled();

    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        tasks: [buildTask({ id: "task-archive" })],
      },
    });

    const flushSummary = await dataRepository.flushOfflineMutations();

    expect(flushSummary).toEqual(
      expect.objectContaining({
        processed: 1,
        failed: 0,
        remaining: 0,
        failedOperation: null,
        failedError: null,
      }),
    );

    expect(transactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "tasks",
        entityId: "task-archive",
        payload: expect.objectContaining({
          deletedAt: NOW_ISO,
          deletedBy: "user-1",
        }),
      }),
    );
  });

  it("returns conflict guidance when replay targets an item changed on another device", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        tasks: [buildTask({ id: "task-conflict" })],
      },
    });

    await dataRepository.updateTaskStatus("user-1", "task-conflict", "done");

    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        tasks: [],
      },
    });

    const flushSummary = await dataRepository.flushOfflineMutations();

    expect(flushSummary).toEqual(
      expect.objectContaining({
        processed: 0,
        failed: 1,
        remaining: 1,
        failedOperation: "updateTaskStatus",
      }),
    );
    expect(flushSummary.failedError).toContain("Offline conflict:");
    expect(flushSummary.failedError).toContain("Task was not found for this user.");
    expect(transactMock).not.toHaveBeenCalled();
  });

  it("keeps queued mutations while offline and flushes them after reconnect", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [buildGoal({ id: "goal-transition" })],
      },
    });

    await dataRepository.updateGoalStatus("user-1", "goal-transition", "done");

    const offlineFlushSummary = await dataRepository.flushOfflineMutations();
    expect(offlineFlushSummary).toEqual(
      expect.objectContaining({
        processed: 0,
        failed: 0,
        remaining: 1,
        failedOperation: null,
        failedError: null,
      }),
    );
    expect(transactMock).not.toHaveBeenCalled();

    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    queryOnceMock.mockResolvedValueOnce({
      data: {
        goals: [buildGoal({ id: "goal-transition" })],
      },
    });

    const onlineFlushSummary = await dataRepository.flushOfflineMutations();

    expect(onlineFlushSummary).toEqual(
      expect.objectContaining({
        processed: 1,
        failed: 0,
        remaining: 0,
        failedOperation: null,
        failedError: null,
      }),
    );
    expect(transactMock).toHaveBeenCalledTimes(1);
  });

  it("replays multiple queued mutations in order after reconnect", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    queryOnceMock
      .mockResolvedValueOnce({
        data: {
          tasks: [buildTask({ id: "task-ordered-1" })],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [buildTask({ id: "task-ordered-2" })],
        },
      });

    await dataRepository.updateTaskStatus("user-1", "task-ordered-1", "in_progress");
    await dataRepository.updateTaskStatus("user-1", "task-ordered-2", "done");

    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    queryOnceMock
      .mockResolvedValueOnce({
        data: {
          tasks: [buildTask({ id: "task-ordered-1" })],
        },
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [buildTask({ id: "task-ordered-2" })],
        },
      });

    const flushSummary = await dataRepository.flushOfflineMutations();

    expect(flushSummary).toEqual(
      expect.objectContaining({
        processed: 2,
        failed: 0,
        remaining: 0,
        failedOperation: null,
        failedError: null,
      }),
    );
    expect(transactMock).toHaveBeenCalledTimes(2);

    const firstMutation = transactMock.mock.calls[0]?.[0] as { entityId?: string; payload?: { status?: string } };
    const secondMutation = transactMock.mock.calls[1]?.[0] as { entityId?: string; payload?: { status?: string } };

    expect(firstMutation.entityId).toBe("task-ordered-1");
    expect(firstMutation.payload?.status).toBe("in_progress");
    expect(secondMutation.entityId).toBe("task-ordered-2");
    expect(secondMutation.payload?.status).toBe("done");
  });
});
