const {
  requireInstantUserMock,
  requireRouteParamMock,
  instantRouteErrorResponseMock,
  findOwnedHabitCheckinMock,
  parseHabitCheckinWritePayloadMock,
  updateHabitCheckinMock,
  deleteHabitCheckinMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  requireRouteParamMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
  findOwnedHabitCheckinMock: vi.fn(),
  parseHabitCheckinWritePayloadMock: vi.fn(),
  updateHabitCheckinMock: vi.fn(),
  deleteHabitCheckinMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  findOwnedHabitCheckin: findOwnedHabitCheckinMock,
  requireRouteParam: requireRouteParamMock,
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseHabitCheckinWritePayload: parseHabitCheckinWritePayloadMock,
  updateHabitCheckin: updateHabitCheckinMock,
  deleteHabitCheckin: deleteHabitCheckinMock,
}));

import { DELETE, GET, PATCH } from "@/app/api/habits/[habitId]/checkins/[checkinId]/route";

describe("api/habits/[habitId]/checkins/[checkinId] route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    requireRouteParamMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    findOwnedHabitCheckinMock.mockReset();
    parseHabitCheckinWritePayloadMock.mockReset();
    updateHabitCheckinMock.mockReset();
    deleteHabitCheckinMock.mockReset();
  });

  it("returns owned checkin on GET", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    findOwnedHabitCheckinMock.mockResolvedValue({ id: "checkin-1", habitId: "habit-1" });

    const request = new Request("http://localhost:3000/api/habits/habit-1/checkins/checkin-1", { method: "GET" });
    const context = { params: Promise.resolve({ habitId: "habit-1", checkinId: "checkin-1" }) };
    const response = await GET(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(requireRouteParamMock).toHaveBeenCalledWith("checkin-1", "Check-in id");
    expect(findOwnedHabitCheckinMock).toHaveBeenCalledWith("user-1", "habit-1", "checkin-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkin: { id: "checkin-1", habitId: "habit-1" },
    });
  });

  it("updates owned checkin on PATCH", async () => {
    const payload = {
      checkInDate: "2026-05-24",
      notes: "Completed review",
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseHabitCheckinWritePayloadMock.mockResolvedValue(payload);
    updateHabitCheckinMock.mockResolvedValue({ id: "checkin-1", habitId: "habit-1", ...payload });

    const request = new Request("http://localhost:3000/api/habits/habit-1/checkins/checkin-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const context = { params: Promise.resolve({ habitId: "habit-1", checkinId: "checkin-1" }) };
    const response = await PATCH(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(requireRouteParamMock).toHaveBeenCalledWith("checkin-1", "Check-in id");
    expect(parseHabitCheckinWritePayloadMock).toHaveBeenCalledWith(request);
    expect(updateHabitCheckinMock).toHaveBeenCalledWith("user-1", "habit-1", "checkin-1", payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkin: { id: "checkin-1", habitId: "habit-1", ...payload },
    });
  });

  it("deletes owned checkin on DELETE", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    deleteHabitCheckinMock.mockResolvedValue({ deletedCheckinId: "checkin-1" });

    const request = new Request("http://localhost:3000/api/habits/habit-1/checkins/checkin-1", { method: "DELETE" });
    const context = { params: Promise.resolve({ habitId: "habit-1", checkinId: "checkin-1" }) };
    const response = await DELETE(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(requireRouteParamMock).toHaveBeenCalledWith("checkin-1", "Check-in id");
    expect(deleteHabitCheckinMock).toHaveBeenCalledWith("user-1", "habit-1", "checkin-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: { deletedCheckinId: "checkin-1" },
    });
  });
});
