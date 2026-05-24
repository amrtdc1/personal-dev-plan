const {
  requireInstantUserMock,
  findOwnedGoalMock,
  requireRouteParamMock,
  instantRouteErrorResponseMock,
  parseGoalWritePayloadMock,
  updateGoalMock,
  permanentlyDeleteGoalMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  findOwnedGoalMock: vi.fn(),
  requireRouteParamMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
  parseGoalWritePayloadMock: vi.fn(),
  updateGoalMock: vi.fn(),
  permanentlyDeleteGoalMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  findOwnedGoal: findOwnedGoalMock,
  requireRouteParam: requireRouteParamMock,
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseGoalWritePayload: parseGoalWritePayloadMock,
  updateGoal: updateGoalMock,
}));

vi.mock("@/lib/server/instant-lifecycle", () => ({
  permanentlyDeleteGoal: permanentlyDeleteGoalMock,
}));

import { DELETE, GET, PATCH } from "@/app/api/goals/[goalId]/route";

describe("api/goals/[goalId] route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    findOwnedGoalMock.mockReset();
    requireRouteParamMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    parseGoalWritePayloadMock.mockReset();
    updateGoalMock.mockReset();
    permanentlyDeleteGoalMock.mockReset();
  });

  it("updates owned goal and keeps horizon payload", async () => {
    const payload = {
      type: "professional",
      horizon: "long_term",
      title: "Career development",
      description: "Build capability over multiple quarters.",
      projectedStartDate: null,
      projectedEndDate: null,
      timeframeLabel: "2026",
      isFocus: false,
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseGoalWritePayloadMock.mockResolvedValue(payload);
    updateGoalMock.mockResolvedValue({ id: "goal-1", ...payload });

    const request = new Request("http://localhost:3000/api/goals/goal-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const context = { params: Promise.resolve({ goalId: "goal-1" }) };
    const response = await PATCH(request, context);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(requireRouteParamMock).toHaveBeenCalledWith("goal-1", "Goal id");
    expect(parseGoalWritePayloadMock).toHaveBeenCalledWith(request);
    expect(updateGoalMock).toHaveBeenCalledWith("user-1", "goal-1", payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goal: { id: "goal-1", ...payload },
    });
  });

  it("returns owned goal on GET", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    findOwnedGoalMock.mockResolvedValue({ id: "goal-1", title: "Goal" });

    const request = new Request("http://localhost:3000/api/goals/goal-1", { method: "GET" });
    const context = { params: Promise.resolve({ goalId: "goal-1" }) };
    const response = await GET(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("goal-1", "Goal id");
    expect(findOwnedGoalMock).toHaveBeenCalledWith("user-1", "goal-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goal: { id: "goal-1", title: "Goal" },
    });
  });

  it("delegates PATCH failures to shared error response", async () => {
    const failure = new Error("bad payload");
    const expected = Response.json({ error: "Invalid payload" }, { status: 400 });

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseGoalWritePayloadMock.mockRejectedValue(failure);
    instantRouteErrorResponseMock.mockReturnValue(expected);

    const request = new Request("http://localhost:3000/api/goals/goal-1", { method: "PATCH" });
    const context = { params: Promise.resolve({ goalId: "goal-1" }) };
    const response = await PATCH(request, context);

    expect(instantRouteErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response).toBe(expected);
  });

  it("deletes owned goal permanently", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    permanentlyDeleteGoalMock.mockResolvedValue({ deletedGoalId: "goal-1" });

    const request = new Request("http://localhost:3000/api/goals/goal-1", { method: "DELETE" });
    const context = { params: Promise.resolve({ goalId: "goal-1" }) };
    const response = await DELETE(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("goal-1", "Goal id");
    expect(permanentlyDeleteGoalMock).toHaveBeenCalledWith("user-1", "goal-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: { deletedGoalId: "goal-1" },
    });
  });
});
