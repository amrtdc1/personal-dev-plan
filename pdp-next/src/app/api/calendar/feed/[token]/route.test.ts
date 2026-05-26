const {
  verifyCalendarFeedTokenMock,
  getInstantAdminMock,
  buildCalendarIcsMock,
  instantAdmin,
} = vi.hoisted(() => {
  const admin = {
    query: vi.fn(),
  };

  return {
    verifyCalendarFeedTokenMock: vi.fn(),
    getInstantAdminMock: vi.fn(() => admin),
    buildCalendarIcsMock: vi.fn(),
    instantAdmin: admin,
  };
});

vi.mock("@/lib/server/calendar-feed-token", () => ({
  verifyCalendarFeedToken: verifyCalendarFeedTokenMock,
}));

vi.mock("@/lib/instantdb/admin", () => ({
  getInstantAdmin: getInstantAdminMock,
}));

vi.mock("@/lib/server/calendar-ics", () => ({
  buildCalendarIcs: buildCalendarIcsMock,
}));

import { GET } from "@/app/api/calendar/feed/[token]/route";
import { InstantAuthError } from "@/lib/server/instant-errors";

describe("api/calendar/feed/[token] route", () => {
  beforeEach(() => {
    verifyCalendarFeedTokenMock.mockReset();
    getInstantAdminMock.mockClear();
    instantAdmin.query.mockReset();
    buildCalendarIcsMock.mockReset();
  });

  it("returns ICS for a valid current token revision", async () => {
    verifyCalendarFeedTokenMock.mockReturnValue({
      uid: "user-1",
      rev: "2026-05-24T12:00:00.000Z",
      exp: 9999999999,
    });
    instantAdmin.query
      .mockResolvedValueOnce({ userProfiles: [{ updatedAt: "2026-05-24T12:00:00.000Z" }] })
      .mockResolvedValueOnce({ goals: [{ id: "goal-1", ownerUid: "user-1", title: "Goal", status: "in_progress" }] })
      .mockResolvedValueOnce({ tasks: [] });
    buildCalendarIcsMock.mockReturnValue("BEGIN:VCALENDAR\nEND:VCALENDAR\n");

    const response = await GET(new Request("http://localhost:3000/api/calendar/feed/token"), {
      params: Promise.resolve({ token: "token-valid" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/calendar");
    await expect(response.text()).resolves.toContain("BEGIN:VCALENDAR");
    expect(buildCalendarIcsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        goals: expect.any(Array),
        tasks: expect.any(Array),
      }),
    );
  });

  it("returns 401 when token revision is stale", async () => {
    verifyCalendarFeedTokenMock.mockReturnValue({
      uid: "user-1",
      rev: "2026-05-20T12:00:00.000Z",
      exp: 9999999999,
    });
    instantAdmin.query.mockResolvedValueOnce({ userProfiles: [{ updatedAt: "2026-05-24T12:00:00.000Z" }] });

    const response = await GET(new Request("http://localhost:3000/api/calendar/feed/token"), {
      params: Promise.resolve({ token: "token-stale" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Calendar feed token has been rotated.",
    });
    expect(buildCalendarIcsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when profile is missing and token revision is non-zero", async () => {
    verifyCalendarFeedTokenMock.mockReturnValue({
      uid: "user-1",
      rev: "2026-05-24T12:00:00.000Z",
      exp: 9999999999,
    });
    instantAdmin.query.mockResolvedValueOnce({ userProfiles: [] });

    const response = await GET(new Request("http://localhost:3000/api/calendar/feed/token"), {
      params: Promise.resolve({ token: "token-with-revision" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Calendar feed token has been rotated.",
    });
    expect(buildCalendarIcsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification fails", async () => {
    verifyCalendarFeedTokenMock.mockImplementation(() => {
      throw new InstantAuthError("Invalid calendar feed token.");
    });

    const response = await GET(new Request("http://localhost:3000/api/calendar/feed/token"), {
      params: Promise.resolve({ token: "token-invalid" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid calendar feed token." });
  });
});