const {
  requireInstantUserMock,
  findOwnedHabitMock,
  requireRouteParamMock,
  instantRouteErrorResponseMock,
  parseHabitWritePayloadMock,
  updateHabitMock,
  permanentlyDeleteHabitMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  findOwnedHabitMock: vi.fn(),
  requireRouteParamMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
  parseHabitWritePayloadMock: vi.fn(),
  updateHabitMock: vi.fn(),
  permanentlyDeleteHabitMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  findOwnedHabit: findOwnedHabitMock,
  requireRouteParam: requireRouteParamMock,
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseHabitWritePayload: parseHabitWritePayloadMock,
  updateHabit: updateHabitMock,
}));

vi.mock("@/lib/server/instant-lifecycle", () => ({
  permanentlyDeleteHabit: permanentlyDeleteHabitMock,
}));

import { DELETE, GET, PATCH } from "@/app/api/habits/[habitId]/route";

describe("api/habits/[habitId] route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    findOwnedHabitMock.mockReset();
    requireRouteParamMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    parseHabitWritePayloadMock.mockReset();
    updateHabitMock.mockReset();
    permanentlyDeleteHabitMock.mockReset();
  });

  it("returns owned habit on GET", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    findOwnedHabitMock.mockResolvedValue({ id: "habit-1", title: "Daily review" });

    const request = new Request("http://localhost:3000/api/habits/habit-1", { method: "GET" });
    const context = { params: Promise.resolve({ habitId: "habit-1" }) };
    const response = await GET(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(findOwnedHabitMock).toHaveBeenCalledWith("user-1", "habit-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      habit: { id: "habit-1", title: "Daily review" },
    });
  });

  it("updates owned habit on PATCH", async () => {
    const payload = {
      title: "Weekly review",
      cadence: "weekly",
      targetCount: 1,
      status: "paused",
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseHabitWritePayloadMock.mockResolvedValue(payload);
    updateHabitMock.mockResolvedValue({ id: "habit-1", ...payload });

    const request = new Request("http://localhost:3000/api/habits/habit-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const context = { params: Promise.resolve({ habitId: "habit-1" }) };
    const response = await PATCH(request, context);

    expect(parseHabitWritePayloadMock).toHaveBeenCalledWith(request);
    expect(updateHabitMock).toHaveBeenCalledWith("user-1", "habit-1", payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      habit: { id: "habit-1", ...payload },
    });
  });

  it("deletes archived habit on DELETE", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    permanentlyDeleteHabitMock.mockResolvedValue({ deletedHabitId: "habit-1", deletedCheckins: 2 });

    const request = new Request("http://localhost:3000/api/habits/habit-1", { method: "DELETE" });
    const context = { params: Promise.resolve({ habitId: "habit-1" }) };
    const response = await DELETE(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(permanentlyDeleteHabitMock).toHaveBeenCalledWith("user-1", "habit-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: { deletedHabitId: "habit-1", deletedCheckins: 2 },
    });
  });
}
);
