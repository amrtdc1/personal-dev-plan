import { vi } from "vitest";

const { requireInstantUserMock, purgeExpiredOwnedDataMock, instantRouteErrorResponseMock } = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  purgeExpiredOwnedDataMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-lifecycle", () => ({
  purgeExpiredOwnedData: purgeExpiredOwnedDataMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

import { POST } from "@/app/api/purge/route";

describe("api/purge route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    purgeExpiredOwnedDataMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
  });

  it("returns purge summary for authenticated user", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    purgeExpiredOwnedDataMock.mockResolvedValue({
      goals: 1,
      subgoals: 2,
      tasks: 3,
      purgedAt: "2026-05-23T12:00:00.000Z",
    });

    const request = new Request("http://localhost/api/purge", { method: "POST" });
    const response = await POST(request);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(purgeExpiredOwnedDataMock).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: {
        goals: 1,
        subgoals: 2,
        tasks: 3,
        purgedAt: "2026-05-23T12:00:00.000Z",
      },
    });
  });

  it("delegates error responses to shared route error handler", async () => {
    const expected = Response.json({ error: "Unauthorized" }, { status: 401 });
    const failure = new Error("auth failed");

    requireInstantUserMock.mockRejectedValue(failure);
    instantRouteErrorResponseMock.mockReturnValue(expected);

    const request = new Request("http://localhost/api/purge", { method: "POST" });
    const response = await POST(request);

    expect(instantRouteErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response).toBe(expected);
  });
});
