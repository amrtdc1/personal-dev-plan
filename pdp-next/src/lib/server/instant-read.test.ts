import { vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/instantdb/admin", () => ({
  getInstantAdmin: () => ({
    query: queryMock,
  }),
}));

import { listOwnedGoals } from "@/lib/server/instant-read";

describe("instant-read owner-scoped reads", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("queries goals scoped by owner and type", async () => {
    queryMock.mockResolvedValue({ goals: [] });

    await listOwnedGoals("user-1", { includeDeleted: false, type: "professional" });

    expect(queryMock).toHaveBeenCalledWith({
      goals: {
        $: {
          where: {
            ownerUid: "user-1",
            type: "professional",
          },
        },
      },
    });
  });

  it("filters out deleted goals unless includeDeleted is true", async () => {
    queryMock.mockResolvedValue({
      goals: [
        { id: "goal-active", deletedAt: null, orderIndex: 1, updatedAt: "2026-05-20T00:00:00.000Z" },
        {
          id: "goal-deleted",
          deletedAt: "2026-05-10T00:00:00.000Z",
          orderIndex: 0,
          updatedAt: "2026-05-10T00:00:00.000Z",
        },
      ],
    });

    const activeOnly = await listOwnedGoals("user-1", { includeDeleted: false, type: null });
    const includingDeleted = await listOwnedGoals("user-1", { includeDeleted: true, type: null });

    expect(activeOnly.map((goal) => goal.id)).toEqual(["goal-active"]);
    expect(includingDeleted.map((goal) => goal.id)).toEqual(["goal-deleted", "goal-active"]);
  });
});