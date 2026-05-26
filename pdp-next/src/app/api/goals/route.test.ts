const {
  requireInstantUserMock,
  listOwnedGoalsMock,
  parseGoalTypeMock,
  parseIncludeDeletedMock,
  parseGoalWritePayloadMock,
  createGoalMock,
  instantRouteErrorResponseMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  listOwnedGoalsMock: vi.fn(),
  parseGoalTypeMock: vi.fn(),
  parseIncludeDeletedMock: vi.fn(),
  parseGoalWritePayloadMock: vi.fn(),
  createGoalMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-read", () => ({
  listOwnedGoals: listOwnedGoalsMock,
  parseGoalType: parseGoalTypeMock,
  parseIncludeDeleted: parseIncludeDeletedMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseGoalWritePayload: parseGoalWritePayloadMock,
  createGoal: createGoalMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

import { GET, POST } from "@/app/api/goals/route";

describe("api/goals route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    listOwnedGoalsMock.mockReset();
    parseGoalTypeMock.mockReset();
    parseIncludeDeletedMock.mockReset();
    parseGoalWritePayloadMock.mockReset();
    createGoalMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
  });

  it("creates a goal with timeframe level for authenticated user", async () => {
    const payload = {
      type: "professional",
      timeframeLevel: "weekly",
      title: "Weekly delivery plan",
      description: "Keep scope and delivery focused.",
      projectedStartDate: null,
      projectedEndDate: null,
      timeframeLabel: "Week 22",
      isFocus: true,
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseGoalWritePayloadMock.mockResolvedValue(payload);
    createGoalMock.mockResolvedValue({ id: "goal-1", ...payload });

    const request = new Request("http://localhost:3000/api/goals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(parseGoalWritePayloadMock).toHaveBeenCalledWith(request);
    expect(createGoalMock).toHaveBeenCalledWith("user-1", payload);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      goal: { id: "goal-1", ...payload },
    });
  });

  it("lists owned goals using parsed query options", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseIncludeDeletedMock.mockReturnValue(true);
    parseGoalTypeMock.mockReturnValue("professional");
    listOwnedGoalsMock.mockResolvedValue([{ id: "goal-1" }]);

    const request = new Request("http://localhost:3000/api/goals?includeDeleted=true&type=professional", {
      method: "GET",
    });
    const response = await GET(request);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(parseIncludeDeletedMock).toHaveBeenCalledWith(new URL(request.url).searchParams);
    expect(parseGoalTypeMock).toHaveBeenCalledWith(new URL(request.url).searchParams);
    expect(listOwnedGoalsMock).toHaveBeenCalledWith("user-1", {
      includeDeleted: true,
      type: "professional",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goals: [{ id: "goal-1" }],
    });
  });
});
