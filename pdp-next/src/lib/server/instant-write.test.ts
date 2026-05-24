import {
  parseHabitCheckinWritePayload,
  parseGoalWritePayload,
  parseHabitWritePayload,
  parseSubgoalWritePayload,
  parseTaskWritePayload,
} from "@/lib/server/instant-write-params";

function buildRequest(body: unknown) {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("instant write payload parsing", () => {
  it("parses goal payload and normalizes empty optional date fields to null", async () => {
    const payload = await parseGoalWritePayload(
      buildRequest({
        type: "professional",
        horizon: "short_term",
        title: "Ship checkpoint",
        description: "Complete protected route coverage",
        projectedStartDate: "",
        projectedEndDate: null,
        timeframeLabel: "Sprint 8",
        isFocus: true,
      }),
    );

    expect(payload).toEqual({
      type: "professional",
      horizon: "short_term",
      title: "Ship checkpoint",
      description: "Complete protected route coverage",
      projectedStartDate: null,
      projectedEndDate: null,
      timeframeLabel: "Sprint 8",
      isFocus: true,
    });
  });

  it("rejects goal payload when focus flag is missing", async () => {
    await expect(
      parseGoalWritePayload(
        buildRequest({
          type: "professional",
          title: "Ship checkpoint",
          description: "Complete protected route coverage",
        }),
      ),
    ).rejects.toThrow("Goal focus flag is required.");
  });

  it("defaults goal horizon when omitted", async () => {
    const payload = await parseGoalWritePayload(
      buildRequest({
        type: "professional",
        title: "Ship checkpoint",
        description: "Complete protected route coverage",
        isFocus: true,
      }),
    );

    expect(payload.horizon).toBe("medium_term");
  });

  it("rejects unsupported goal horizon values", async () => {
    await expect(
      parseGoalWritePayload(
        buildRequest({
          type: "professional",
          horizon: "month_to_month",
          title: "Ship checkpoint",
          description: "Complete protected route coverage",
          isFocus: true,
        }),
      ),
    ).rejects.toThrow("Goal horizon is not supported.");
  });

  it("rejects subgoal payload when goal id is missing", async () => {
    await expect(
      parseSubgoalWritePayload(
        buildRequest({
          title: "Write docs",
          description: "Add README section",
        }),
      ),
    ).rejects.toThrow("Goal id is required.");
  });

  it("rejects subgoal payload when optional date field is not a string", async () => {
    await expect(
      parseSubgoalWritePayload(
        buildRequest({
          goalId: "goal-1",
          title: "Write docs",
          description: "Add README section",
          projectedStartDate: 123,
        }),
      ),
    ).rejects.toThrow("Optional date fields must be strings when provided.");
  });

  it("parses valid task payload", async () => {
    const payload = await parseTaskWritePayload(
      buildRequest({
        subgoalId: "subgoal-1",
        title: "Record smoke results",
        notes: "Paste URL and status",
        dueDate: "2026-05-30",
      }),
    );

    expect(payload).toEqual({
      subgoalId: "subgoal-1",
      title: "Record smoke results",
      notes: "Paste URL and status",
      dueDate: "2026-05-30",
    });
  });

  it("rejects task payload when notes are missing", async () => {
    await expect(
      parseTaskWritePayload(
        buildRequest({
          subgoalId: "subgoal-1",
          title: "Record smoke results",
        }),
      ),
    ).rejects.toThrow("Task notes are required.");
  });

  it("rejects invalid JSON bodies", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      body: "{ not-valid-json",
    });

    await expect(parseTaskWritePayload(request)).rejects.toThrow("Request body must be valid JSON.");
  });

  it("parses valid habit payload and defaults status", async () => {
    const payload = await parseHabitWritePayload(
      buildRequest({
        title: "Write daily summary",
        cadence: "daily",
        targetCount: 1,
      }),
    );

    expect(payload).toEqual({
      title: "Write daily summary",
      cadence: "daily",
      targetCount: 1,
      status: "active",
    });
  });

  it("rejects habit payload when target count is invalid", async () => {
    await expect(
      parseHabitWritePayload(
        buildRequest({
          title: "Write daily summary",
          cadence: "daily",
          targetCount: 0,
        }),
      ),
    ).rejects.toThrow("Habit target count must be greater than zero.");
  });

  it("parses habit checkin payload", async () => {
    const payload = await parseHabitCheckinWritePayload(
      buildRequest({
        checkInDate: "2026-05-24",
        notes: " Completed review ",
      }),
    );

    expect(payload).toEqual({
      checkInDate: "2026-05-24",
      notes: "Completed review",
    });
  });

  it("rejects habit checkin payload when date is missing", async () => {
    await expect(
      parseHabitCheckinWritePayload(
        buildRequest({
          notes: "Completed review",
        }),
      ),
    ).rejects.toThrow("Habit check-in date is required.");
  });
});
