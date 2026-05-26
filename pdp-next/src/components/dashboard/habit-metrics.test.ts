import { buildHabitMetrics } from "@/components/dashboard/habit-metrics";
import type { Habit, HabitCadence, HabitCheckin } from "@/lib/domain/types";

describe("habit metrics", () => {
  it("computes daily streaks, adherence, and upward trend", () => {
    const habit = createHabit("daily", 1);
    const checkins = createCheckins([
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
      "2026-02-04",
      "2026-02-05",
      "2026-02-06",
      "2026-02-07",
      "2026-02-16",
      "2026-02-18",
      "2026-02-20",
      "2026-02-23",
      "2026-02-27",
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
    ]);

    const metrics = buildHabitMetrics(habit, checkins, new Date("2026-03-14T12:00:00Z"));

    expect(metrics.currentStreak).toBe(3);
    expect(metrics.bestStreak).toBe(10);
    expect(metrics.adherence28dPercent).toBe(64);
    expect(metrics.trend).toBe("up");
  });

  it("keeps daily trend flat inside threshold", () => {
    const habit = createHabit("daily", 1);
    const checkins = createCheckins([
      "2026-02-15",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-02-19",
      "2026-02-20",
      "2026-02-21",
      "2026-02-22",
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
    ]);

    const metrics = buildHabitMetrics(habit, checkins, new Date("2026-03-14T12:00:00Z"));

    expect(metrics.trend).toBe("flat");
  });

  it("marks daily trend down when drop is large", () => {
    const habit = createHabit("daily", 1);
    const checkins = createCheckins([
      "2026-02-15",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-02-19",
      "2026-02-20",
      "2026-02-21",
      "2026-02-22",
      "2026-03-01",
      "2026-03-05",
    ]);

    const metrics = buildHabitMetrics(habit, checkins, new Date("2026-03-14T12:00:00Z"));

    expect(metrics.trend).toBe("down");
  });

  it("computes weekly cadence streaks and adherence", () => {
    const habit = createHabit("weekly", 2);
    const checkins = createCheckins([
      "2026-02-16",
      "2026-02-18",
      "2026-02-23",
      "2026-02-25",
      "2026-03-02",
      "2026-03-04",
      "2026-03-16",
      "2026-03-18",
      "2026-03-23",
      "2026-03-25",
    ]);

    const metrics = buildHabitMetrics(habit, checkins, new Date("2026-03-29T12:00:00Z"));

    expect(metrics.currentStreak).toBe(2);
    expect(metrics.bestStreak).toBe(3);
    expect(metrics.adherence28dPercent).toBe(75);
    expect(metrics.trend).toBe("up");
  });
});

function createHabit(cadence: HabitCadence, targetCount: number): Habit {
  return {
    id: "habit-1",
    ownerUid: "user-1",
    title: "Test habit",
    cadence,
    targetCount,
    status: "active",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createCheckins(dates: string[]): HabitCheckin[] {
  return dates.map((checkInDate, index) => ({
    id: `checkin-${index + 1}`,
    ownerUid: "user-1",
    habitId: "habit-1",
    checkInDate,
    notes: null,
    createdAt: `${checkInDate}T12:00:00.000Z`,
    updatedAt: `${checkInDate}T12:00:00.000Z`,
  }));
}
