import { createCalendarFeedToken, verifyCalendarFeedToken } from "@/lib/server/calendar-feed-token";

describe("calendar feed token", () => {
  const originalSecret = process.env.CALENDAR_FEED_SECRET;

  beforeEach(() => {
    process.env.CALENDAR_FEED_SECRET = "test-calendar-secret";
  });

  afterEach(() => {
    process.env.CALENDAR_FEED_SECRET = originalSecret;
  });

  it("creates and verifies token payload", () => {
    const issued = createCalendarFeedToken("user-123", "rev-1", { ttlDays: 1 });

    const verified = verifyCalendarFeedToken(issued.token);
    expect(verified.uid).toBe("user-123");
    expect(verified.rev).toBe("rev-1");
    expect(typeof verified.exp).toBe("number");
  });

  it("rejects tampered token", () => {
    const issued = createCalendarFeedToken("user-123", "rev-1", { ttlDays: 1 });
    const tampered = `${issued.token}x`;

    expect(() => verifyCalendarFeedToken(tampered)).toThrow("Invalid calendar feed token.");
  });

  it("fails with actionable message when calendar feed secret is missing", () => {
    process.env.CALENDAR_FEED_SECRET = "";

    expect(() => createCalendarFeedToken("user-123", "rev-1", { ttlDays: 1 })).toThrow(
      "Calendar feed is not configured. Set CALENDAR_FEED_SECRET.",
    );
  });
});
