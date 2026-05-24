import {
  filterAndPaginateDeliveries,
  parseDeliveryQueryFilters,
  parseHours,
  summarizeReminderDeliveries,
  type DeliveryRecord,
} from "./notification-route-core";

describe("notification route core helpers", () => {
  it("parses delivery query filters with defaults", () => {
    const filters = parseDeliveryQueryFilters(new URLSearchParams());

    expect(filters).toEqual({
      limit: 8,
      status: null,
      type: null,
      before: null,
      after: null,
    });
  });

  it("filters and paginates deliveries", () => {
    const rows: DeliveryRecord[] = [
      {
        id: "1",
        ownerUid: "u1",
        reminderType: "daily_agenda",
        status: "sent",
        createdAt: "2026-05-24T11:00:00.000Z",
      },
      {
        id: "2",
        ownerUid: "u1",
        reminderType: "daily_agenda",
        status: "sent",
        createdAt: "2026-05-24T10:00:00.000Z",
      },
      {
        id: "3",
        ownerUid: "u1",
        reminderType: "daily_agenda",
        status: "failed",
        createdAt: "2026-05-24T09:00:00.000Z",
      },
    ];

    const result = filterAndPaginateDeliveries(rows, {
      limit: 1,
      status: "sent",
      type: "daily_agenda",
      before: null,
      after: null,
    });

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]?.id).toBe("1");
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("2026-05-24T11:00:00.000Z");
  });

  it("summarizes reminder rows by type and status", () => {
    const summary = summarizeReminderDeliveries(
      [
        { reminderType: "daily_agenda", status: "sent", createdAt: "2026-05-24T11:00:00.000Z" },
        { reminderType: "daily_agenda", status: "failed", createdAt: "2026-05-24T11:10:00.000Z" },
        { reminderType: "weekly_review", status: "skipped", createdAt: "2026-05-24T11:20:00.000Z" },
      ],
      "2026-05-24T00:00:00.000Z",
    );

    expect(summary.totalRows).toBe(3);
    expect(summary.totals).toEqual({ sent: 1, failed: 1, skipped: 1 });
    expect(summary.byType.daily_agenda).toEqual({ sent: 1, failed: 1, skipped: 0 });
  });

  it("parses hours with bounds", () => {
    expect(parseHours(null)).toBe(24);
    expect(parseHours("1000")).toBe(24 * 14);
    expect(() => parseHours("0")).toThrow("hours must be greater than zero.");
  });
});
