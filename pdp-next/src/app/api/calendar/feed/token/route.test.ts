const {
  requireInstantUserMock,
  getInstantAdminMock,
  createCalendarFeedTokenMock,
  instantRouteErrorResponseMock,
  instantAdmin,
  profileUpdateMock,
  transactMock,
} = vi.hoisted(() => {
  const profileUpdate = vi.fn();
  const transact = vi.fn();
  const admin = {
    query: vi.fn(),
    transact,
    tx: {
      userProfiles: {
        "profile-1": {
          update: profileUpdate,
        },
      },
    },
  };

  return {
    requireInstantUserMock: vi.fn(),
    getInstantAdminMock: vi.fn(() => admin),
    createCalendarFeedTokenMock: vi.fn(),
    instantRouteErrorResponseMock: vi.fn(),
    instantAdmin: admin,
    profileUpdateMock: profileUpdate,
    transactMock: transact,
  };
});

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/instantdb/admin", () => ({
  getInstantAdmin: getInstantAdminMock,
}));

vi.mock("@/lib/server/calendar-feed-token", () => ({
  createCalendarFeedToken: createCalendarFeedTokenMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

import { GET, POST } from "@/app/api/calendar/feed/token/route";

describe("api/calendar/feed/token route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    getInstantAdminMock.mockClear();
    instantAdmin.query.mockReset();
    createCalendarFeedTokenMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    profileUpdateMock.mockReset();
    transactMock.mockReset();
  });

  it("issues token on GET for the current profile revision", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    instantAdmin.query.mockResolvedValue({
      userProfiles: [{ id: "profile-1", updatedAt: "2026-05-24T12:00:00.000Z" }],
    });
    createCalendarFeedTokenMock.mockReturnValue({
      token: "token-abc",
      expiresAt: "2027-05-24T12:00:00.000Z",
    });

    const request = new Request("http://localhost:3000/api/calendar/feed/token", { method: "GET" });
    const response = await GET(request);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(createCalendarFeedTokenMock).toHaveBeenCalledWith("user-1", "2026-05-24T12:00:00.000Z");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      token: "token-abc",
      revision: "2026-05-24T12:00:00.000Z",
      expiresAt: "2027-05-24T12:00:00.000Z",
      feedUrl: "http://localhost:3000/api/calendar/feed/token-abc",
    });
  });

  it("rotates revision on POST and returns a new token", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    instantAdmin.query.mockResolvedValue({ userProfiles: [{ id: "profile-1" }] });
    profileUpdateMock.mockReturnValue({ op: "profile-update-op" });
    transactMock.mockResolvedValue(undefined);
    createCalendarFeedTokenMock.mockReturnValue({
      token: "token-rotated",
      expiresAt: "2027-05-24T13:00:00.000Z",
    });

    const request = new Request("http://localhost:3000/api/calendar/feed/token", { method: "POST" });
    const response = await POST(request);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(profileUpdateMock).toHaveBeenCalledWith({ updatedAt: expect.any(String) });
    expect(transactMock).toHaveBeenCalledWith({ op: "profile-update-op" });
    expect(createCalendarFeedTokenMock).toHaveBeenCalledWith("user-1", expect.any(String));
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      revision: string;
      feedUrl: string;
      token: string;
    };

    expect(payload.token).toBe("token-rotated");
    expect(payload.revision).toEqual(expect.any(String));
    expect(payload.feedUrl).toBe("http://localhost:3000/api/calendar/feed/token-rotated");
  });

  it("delegates GET failures to the shared route error response", async () => {
    const failure = new Error("not authorized");
    const expected = Response.json({ error: "Authentication required." }, { status: 401 });

    requireInstantUserMock.mockRejectedValue(failure);
    instantRouteErrorResponseMock.mockReturnValue(expected);

    const request = new Request("http://localhost:3000/api/calendar/feed/token", { method: "GET" });
    const response = await GET(request);

    expect(instantRouteErrorResponseMock).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        route: "/api/calendar/feed/token",
        method: "GET",
      }),
    );
    expect(response).toBe(expected);
  });

  it("delegates POST failures to the shared route error response", async () => {
    const failure = new Error("not authorized");
    const expected = Response.json({ error: "Authentication required." }, { status: 401 });

    requireInstantUserMock.mockRejectedValue(failure);
    instantRouteErrorResponseMock.mockReturnValue(expected);

    const request = new Request("http://localhost:3000/api/calendar/feed/token", { method: "POST" });
    const response = await POST(request);

    expect(instantRouteErrorResponseMock).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        route: "/api/calendar/feed/token",
        method: "POST",
      }),
    );
    expect(response).toBe(expected);
  });
});