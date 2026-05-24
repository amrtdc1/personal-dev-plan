const {
  requireInstantUserMock,
  requireRouteParamMock,
  instantRouteErrorResponseMock,
  listOwnedHabitCheckinsMock,
  parseHabitCheckinWritePayloadMock,
  createHabitCheckinMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  requireRouteParamMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
  listOwnedHabitCheckinsMock: vi.fn(),
  parseHabitCheckinWritePayloadMock: vi.fn(),
  createHabitCheckinMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  requireRouteParam: requireRouteParamMock,
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

vi.mock("@/lib/server/instant-read", () => ({
  listOwnedHabitCheckins: listOwnedHabitCheckinsMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseHabitCheckinWritePayload: parseHabitCheckinWritePayloadMock,
  createHabitCheckin: createHabitCheckinMock,
}));

import { GET, POST } from "@/app/api/habits/[habitId]/checkins/route";

describe("api/habits/[habitId]/checkins route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    requireRouteParamMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    listOwnedHabitCheckinsMock.mockReset();
    parseHabitCheckinWritePayloadMock.mockReset();
    createHabitCheckinMock.mockReset();
  });

  it("lists habit checkins for owned habit", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    listOwnedHabitCheckinsMock.mockResolvedValue([{ id: "checkin-1", habitId: "habit-1" }]);

    const request = new Request("http://localhost:3000/api/habits/habit-1/checkins", { method: "GET" });
    const context = { params: Promise.resolve({ habitId: "habit-1" }) };
    const response = await GET(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(listOwnedHabitCheckinsMock).toHaveBeenCalledWith("user-1", { habitId: "habit-1" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkins: [{ id: "checkin-1", habitId: "habit-1" }],
    });
  });

  it("creates a habit checkin for owned habit", async () => {
    const payload = {
      checkInDate: "2026-05-24",
      notes: "Completed review",
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseHabitCheckinWritePayloadMock.mockResolvedValue(payload);
    createHabitCheckinMock.mockResolvedValue({ id: "checkin-1", habitId: "habit-1", ...payload });

    const request = new Request("http://localhost:3000/api/habits/habit-1/checkins", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const context = { params: Promise.resolve({ habitId: "habit-1" }) };
    const response = await POST(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(parseHabitCheckinWritePayloadMock).toHaveBeenCalledWith(request);
    expect(createHabitCheckinMock).toHaveBeenCalledWith("user-1", "habit-1", payload);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      checkin: { id: "checkin-1", habitId: "habit-1", ...payload },
    });
  });
});
