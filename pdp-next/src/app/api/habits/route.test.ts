const {
  requireInstantUserMock,
  listOwnedHabitsMock,
  parseIncludeDeletedMock,
  parseHabitWritePayloadMock,
  createHabitMock,
  instantRouteErrorResponseMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  listOwnedHabitsMock: vi.fn(),
  parseIncludeDeletedMock: vi.fn(),
  parseHabitWritePayloadMock: vi.fn(),
  createHabitMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-read", () => ({
  listOwnedHabits: listOwnedHabitsMock,
  parseIncludeDeleted: parseIncludeDeletedMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseHabitWritePayload: parseHabitWritePayloadMock,
  createHabit: createHabitMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

import { GET, POST } from "@/app/api/habits/route";

describe("api/habits route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    listOwnedHabitsMock.mockReset();
    parseIncludeDeletedMock.mockReset();
    parseHabitWritePayloadMock.mockReset();
    createHabitMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
  });

  it("lists owned habits with parsed includeDeleted option", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseIncludeDeletedMock.mockReturnValue(true);
    listOwnedHabitsMock.mockResolvedValue([{ id: "habit-1", title: "Daily review" }]);

    const request = new Request("http://localhost:3000/api/habits?includeDeleted=true", { method: "GET" });
    const response = await GET(request);

    expect(parseIncludeDeletedMock).toHaveBeenCalledWith(new URL(request.url).searchParams);
    expect(listOwnedHabitsMock).toHaveBeenCalledWith("user-1", { includeDeleted: true });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      habits: [{ id: "habit-1", title: "Daily review" }],
    });
  });

  it("creates a habit for authenticated user", async () => {
    const payload = {
      title: "Daily review",
      cadence: "daily",
      targetCount: 1,
      status: "active",
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseHabitWritePayloadMock.mockResolvedValue(payload);
    createHabitMock.mockResolvedValue({ id: "habit-1", ...payload });

    const request = new Request("http://localhost:3000/api/habits", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(parseHabitWritePayloadMock).toHaveBeenCalledWith(request);
    expect(createHabitMock).toHaveBeenCalledWith("user-1", payload);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      habit: { id: "habit-1", ...payload },
    });
  });
});
