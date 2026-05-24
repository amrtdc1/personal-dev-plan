import type { Goal, Subgoal, Task } from "@/lib/domain/types";

type BuildCalendarIcsInput = {
  goals: Goal[];
  subgoals: Subgoal[];
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
    ...buildSubgoalEvents(input.subgoals, input.goals, now),
    ...buildTaskEvents(input.tasks, input.subgoals, input.goals, now),
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

function buildSubgoalEvents(subgoals: Subgoal[], goals: Goal[], nowIso: string) {
  const events: string[] = [];
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  for (const subgoal of subgoals) {
    if (subgoal.deletedAt || !subgoal.projectedStartDate || !subgoal.projectedEndDate) {
      continue;
    }

    const parentGoal = goalById.get(subgoal.goalId);

    events.push(
      ...toAllDayEvent({
        uid: `subgoal-${subgoal.id}@pdp`,
        stampIso: nowIso,
        startDate: subgoal.projectedStartDate,
        endDate: subgoal.projectedEndDate,
        summary: `Subgoal: ${subgoal.title}`,
        description: `${parentGoal?.title ?? "Unknown goal"} | status: ${subgoal.status}`,
      }),
    );
  }

  return events;
}

function buildTaskEvents(tasks: Task[], subgoals: Subgoal[], goals: Goal[], nowIso: string) {
  const events: string[] = [];
  const subgoalById = new Map(subgoals.map((subgoal) => [subgoal.id, subgoal]));
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  for (const task of tasks) {
    if (task.deletedAt || !task.dueDate) {
      continue;
    }

    const parentSubgoal = subgoalById.get(task.subgoalId);
    const parentGoal = parentSubgoal ? goalById.get(parentSubgoal.goalId) : undefined;

    events.push(
      ...toAllDayEvent({
        uid: `task-${task.id}@pdp`,
        stampIso: nowIso,
        startDate: task.dueDate,
        endDate: task.dueDate,
        summary: `Task Due: ${task.title}`,
        description: `${parentGoal?.title ?? "Unknown goal"} -> ${parentSubgoal?.title ?? "Unknown subgoal"} | status: ${task.status}`,
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
