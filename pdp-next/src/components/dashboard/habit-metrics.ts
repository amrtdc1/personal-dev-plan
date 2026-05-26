import type { Habit, HabitCheckin } from "@/lib/domain/types";

export type HabitMetricSnapshot = {
  currentStreak: number;
  bestStreak: number;
  adherence28dPercent: number;
  trend: "up" | "flat" | "down";
};

export function buildHabitMetrics(
  habit: Habit,
  checkins: HabitCheckin[],
  referenceDate: Date = new Date(),
): HabitMetricSnapshot {
  const uniqueDates = Array.from(new Set(checkins.map((checkin) => checkin.checkInDate).filter(Boolean))).sort();
  const checkinsByDate = new Map<string, number>();
  for (const checkin of checkins) {
    if (!checkin.checkInDate) {
      continue;
    }
    checkinsByDate.set(checkin.checkInDate, (checkinsByDate.get(checkin.checkInDate) ?? 0) + 1);
  }

  if (habit.cadence === "weekly") {
    return buildWeeklyMetrics(habit.targetCount, checkinsByDate, referenceDate);
  }

  return buildDailyMetrics(habit.targetCount, uniqueDates, checkins, referenceDate);
}

function buildDailyMetrics(
  targetCount: number,
  uniqueDates: string[],
  checkins: HabitCheckin[],
  referenceDate: Date,
): HabitMetricSnapshot {
  const today = startOfDay(referenceDate);
  const dateSet = new Set(uniqueDates);

  let currentStreak = 0;
  const cursor = new Date(today);
  while (dateSet.has(toIsoDate(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  let bestStreak = 0;
  let running = 0;
  let previousDate: Date | null = null;

  for (const isoDate of uniqueDates) {
    const parsed = parseIsoDate(isoDate);
    if (!parsed) {
      continue;
    }

    if (!previousDate) {
      running = 1;
    } else {
      const dayDiff = differenceInDays(parsed, previousDate);
      running = dayDiff === 1 ? running + 1 : 1;
    }

    if (running > bestStreak) {
      bestStreak = running;
    }

    previousDate = parsed;
  }

  const recent14 = countCheckinsSince(checkins, 14, referenceDate);
  const previous14 = countCheckinsBetween(checkins, 14, 28, referenceDate);
  const recent14Expected = Math.max(targetCount, 1) * 14;
  const previous14Expected = Math.max(targetCount, 1) * 14;
  const trend = deriveTrend(recent14 / recent14Expected, previous14 / previous14Expected);

  const recent28 = countCheckinsSince(checkins, 28, referenceDate);
  const expected28 = Math.max(targetCount, 1) * 28;
  const adherence28dPercent = Math.round(Math.min(1, recent28 / expected28) * 100);

  return {
    currentStreak,
    bestStreak,
    adherence28dPercent,
    trend,
  };
}

function buildWeeklyMetrics(
  targetCount: number,
  checkinsByDate: Map<string, number>,
  referenceDate: Date,
): HabitMetricSnapshot {
  const normalizedTarget = Math.max(targetCount, 1);
  const weeklyCounts = new Map<string, number>();

  for (const [isoDate, count] of checkinsByDate.entries()) {
    const parsed = parseIsoDate(isoDate);
    if (!parsed) {
      continue;
    }
    const weekKey = getIsoWeekKey(parsed);
    weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) ?? 0) + count);
  }

  const weekKeys = Array.from(weeklyCounts.keys()).sort();
  const activeWeekKeys = weekKeys.filter((weekKey) => (weeklyCounts.get(weekKey) ?? 0) >= normalizedTarget);
  const activeWeekSet = new Set(activeWeekKeys);

  let bestStreak = 0;
  let running = 0;
  let previousWeekStart: Date | null = null;

  for (const weekKey of activeWeekKeys) {
    const weekStart = parseWeekKey(weekKey);
    if (!weekStart) {
      continue;
    }

    if (!previousWeekStart) {
      running = 1;
    } else {
      const dayDiff = differenceInDays(weekStart, previousWeekStart);
      running = dayDiff === 7 ? running + 1 : 1;
    }

    if (running > bestStreak) {
      bestStreak = running;
    }

    previousWeekStart = weekStart;
  }

  const currentWeekStart = getWeekStart(startOfDay(referenceDate));
  let currentStreak = 0;
  const cursor = new Date(currentWeekStart);
  while (activeWeekSet.has(getIsoWeekKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  const recent2 = countQualifiedWeeks(weeklyCounts, normalizedTarget, 0, 2, referenceDate);
  const previous2 = countQualifiedWeeks(weeklyCounts, normalizedTarget, 2, 4, referenceDate);
  const trend = deriveTrend(recent2 / 2, previous2 / 2);

  const recent4 = countQualifiedWeeks(weeklyCounts, normalizedTarget, 0, 4, referenceDate);
  const adherence28dPercent = Math.round((recent4 / 4) * 100);

  return {
    currentStreak,
    bestStreak,
    adherence28dPercent,
    trend,
  };
}

function countQualifiedWeeks(
  weeklyCounts: Map<string, number>,
  targetCount: number,
  startOffsetWeeks: number,
  endOffsetWeeks: number,
  referenceDate: Date,
): number {
  let qualifiedWeeks = 0;
  const currentWeekStart = getWeekStart(startOfDay(referenceDate));

  for (let offset = startOffsetWeeks; offset < endOffsetWeeks; offset += 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - offset * 7);
    const weekKey = getIsoWeekKey(weekStart);
    if ((weeklyCounts.get(weekKey) ?? 0) >= targetCount) {
      qualifiedWeeks += 1;
    }
  }

  return qualifiedWeeks;
}

function countCheckinsSince(checkins: HabitCheckin[], days: number, referenceDate: Date): number {
  const endDate = startOfDay(referenceDate);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));

  return checkins.filter((checkin) => {
    const parsed = parseIsoDate(checkin.checkInDate);
    return Boolean(parsed && parsed >= startDate && parsed <= endDate);
  }).length;
}

function countCheckinsBetween(
  checkins: HabitCheckin[],
  startOffsetDays: number,
  endOffsetDays: number,
  referenceDate: Date,
): number {
  const endDate = startOfDay(referenceDate);
  const windowEnd = new Date(endDate);
  windowEnd.setDate(endDate.getDate() - startOffsetDays);
  const windowStart = new Date(endDate);
  windowStart.setDate(endDate.getDate() - (endOffsetDays - 1));

  return checkins.filter((checkin) => {
    const parsed = parseIsoDate(checkin.checkInDate);
    return Boolean(parsed && parsed >= windowStart && parsed < windowEnd);
  }).length;
}

function deriveTrend(currentRate: number, previousRate: number): "up" | "flat" | "down" {
  const delta = currentRate - previousRate;
  if (delta > 0.08) {
    return "up";
  }
  if (delta < -0.08) {
    return "down";
  }
  return "flat";
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function differenceInDays(later: Date, earlier: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / msPerDay);
}

function getWeekStart(date: Date): Date {
  const value = startOfDay(date);
  const day = value.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diffToMonday);
  return value;
}

function getIsoWeekKey(date: Date): string {
  const monday = getWeekStart(date);
  return toIsoDate(monday);
}

function parseWeekKey(value: string): Date | null {
  return parseIsoDate(value);
}
