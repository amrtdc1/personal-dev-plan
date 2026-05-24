const {
  requireInstantUserMock,
  requireRouteParamMock,
  instantRouteErrorResponseMock,
  archiveHabitMock,
  restoreHabitMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  requireRouteParamMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
  archiveHabitMock: vi.fn(),
  restoreHabitMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  requireRouteParam: requireRouteParamMock,
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

vi.mock("@/lib/server/instant-lifecycle", () => ({
  archiveHabit: archiveHabitMock,
  restoreHabit: restoreHabitMock,
}));

import { PATCH as ARCHIVE_PATCH } from "@/app/api/habits/[habitId]/archive/route";
import { PATCH as RESTORE_PATCH } from "@/app/api/habits/[habitId]/restore/route";

describe("api/habits/[habitId] lifecycle routes", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    requireRouteParamMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    archiveHabitMock.mockReset();
    restoreHabitMock.mockReset();
  });

  it("archives habit on archive PATCH", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    archiveHabitMock.mockResolvedValue({ id: "habit-1", deletedAt: "2026-05-24T10:00:00.000Z" });

    const request = new Request("http://localhost:3000/api/habits/habit-1/archive", { method: "PATCH" });
    const context = { params: Promise.resolve({ habitId: "habit-1" }) };
    const response = await ARCHIVE_PATCH(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(archiveHabitMock).toHaveBeenCalledWith("user-1", "habit-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      habit: { id: "habit-1", deletedAt: "2026-05-24T10:00:00.000Z" },
    });
  });

  it("restores habit on restore PATCH", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    restoreHabitMock.mockResolvedValue({ id: "habit-1", deletedAt: null, status: "active" });

    const request = new Request("http://localhost:3000/api/habits/habit-1/restore", { method: "PATCH" });
    const context = { params: Promise.resolve({ habitId: "habit-1" }) };
    const response = await RESTORE_PATCH(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("habit-1", "Habit id");
    expect(restoreHabitMock).toHaveBeenCalledWith("user-1", "habit-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      habit: { id: "habit-1", deletedAt: null, status: "active" },
    });
  });
});
