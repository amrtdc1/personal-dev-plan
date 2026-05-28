import type { Goal, Task } from "@/lib/domain/types";
import { getTaskParentGoalId } from "@/lib/domain/types";

type BuildCalendarIcsInput = {
  goals: Goal[];
  tasks: Task[];
  nowIso?: string;
};

export function buildCalendarIcs(input: BuildCalendarIcsInput) {
  const now = input.nowIso ?? new Date().toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Development Plan//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Personal Development Plan",
    ...buildGoalEvents(input.goals, now),
    ...buildTaskEvents(input.tasks, input.goals, now),
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}

function buildGoalEvents(goals: Goal[], nowIso: string) {
  const events: string[] = [];

  for (const goal of goals) {
    if (goal.deletedAt || !goal.projectedStartDate || !goal.projectedEndDate) {
      continue;
    }

    events.push(
      ...toAllDayEvent({
        uid: `goal-${goal.id}@pdp`,
        stampIso: nowIso,
        startDate: goal.projectedStartDate,
        endDate: goal.projectedEndDate,
        summary: `Goal: ${goal.title}`,
        description: `${goal.type} goal | status: ${goal.status}`,
      }),
    );
  }

  return events;
}

function buildTaskEvents(tasks: Task[], goals: Goal[], nowIso: string) {
  const events: string[] = [];
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  for (const task of tasks) {
    if (task.deletedAt || !task.dueDate) {
      continue;
    }

    const parentGoalId = getTaskParentGoalId(task);
    const parentGoal = parentGoalId ? goalById.get(parentGoalId) : null;

    events.push(
      ...toAllDayEvent({
        uid: `task-${task.id}@pdp`,
        stampIso: nowIso,
        startDate: task.dueDate,
        endDate: task.dueDate,
        summary: `Task Due: ${task.title}`,
        description: `${parentGoal?.title ?? "Unknown goal"} | status: ${task.status}`,
      }),
    );
  }

  return events;
}

function toAllDayEvent(args: {
  uid: string;
  stampIso: string;
  startDate: string;
  endDate: string;
  summary: string;
  description: string;
}) {
  const start = toDateOnly(args.startDate);
  const end = toDateOnly(args.endDate);

  if (!start || !end) {
    return [] as string[];
  }

  const endExclusive = addDays(end, 1);

  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(args.uid)}`,
    `DTSTAMP:${toUtcDateTime(args.stampIso)}`,
    `DTSTART;VALUE=DATE:${start.replaceAll("-", "")}`,
    `DTEND;VALUE=DATE:${endExclusive.replaceAll("-", "")}`,
    `SUMMARY:${escapeIcsText(args.summary)}`,
    `DESCRIPTION:${escapeIcsText(args.description)}`,
    "END:VEVENT",
  ];
}

function toDateOnly(isoLike: string) {
  const datePart = isoLike.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }

  return datePart;
}

function addDays(dateOnly: string, days: number) {
  const next = new Date(`${dateOnly}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function toUtcDateTime(iso: string) {
  const parsed = new Date(iso);
  const safe = Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
  return safe.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}
