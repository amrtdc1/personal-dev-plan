import type { Goal, Task } from "@/lib/domain/types";
import { id } from "@instantdb/admin";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import type { PushMessagePayload } from "@/lib/server/push-delivery";

export type ReminderType = "daily_agenda" | "weekly_review" | "due_tasks";

type ReminderData = {
  activeGoals: number;
  dueToday: number;
  overdue: number;
  completedThisWeek: number;
};

const REMINDER_TYPES: ReminderType[] = ["daily_agenda", "weekly_review", "due_tasks"];

type NotificationPreference = {
  id: string;
  ownerUid: string;
  dailyAgendaEnabled?: boolean;
  weeklyReviewEnabled?: boolean;
  dueTasksEnabled?: boolean;
  preferredHourLocal?: number;
  timezone?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
};

type ReminderDeliveryStatus = "sent" | "failed" | "skipped";

type DeliveryRecord = {
  id: string;
  ownerUid: string;
  reminderType: ReminderType | "test";
  status: ReminderDeliveryStatus;
  createdAt: string;
};

export type ReminderScheduleDecision = {
  shouldSend: boolean;
  reason?: string;
};

export function isReminderType(value: unknown): value is ReminderType {
  return typeof value === "string" && REMINDER_TYPES.includes(value as ReminderType);
}

export async function buildReminderPayloadForOwner(
  ownerUid: string,
  type: ReminderType,
  now = new Date(),
): Promise<PushMessagePayload> {
  const data = await getReminderData(ownerUid, now);

  if (type === "daily_agenda") {
    return {
      title: "Daily Agenda",
      body: buildDailyAgendaBody(data),
      url: "/",
      tag: "pdp-daily-agenda",
    };
  }

  if (type === "weekly_review") {
    return {
      title: "Weekly Review",
      body: buildWeeklyReviewBody(data),
      url: "/",
      tag: "pdp-weekly-review",
    };
  }

  return {
    title: "Due Task Reminder",
    body: buildDueTasksBody(data),
    url: "/",
    tag: "pdp-due-tasks",
  };
}

export async function listOwnersWithPushSubscriptions(): Promise<string[]> {
  const instantAdmin = getInstantAdmin();
  const { pushSubscriptions = [] } = await instantAdmin.query({
    pushSubscriptions: {},
  });

  const uniqueOwners = new Set<string>();

  for (const row of pushSubscriptions as Array<{ ownerUid?: string }>) {
    if (row.ownerUid) {
      uniqueOwners.add(row.ownerUid);
    }
  }

  return [...uniqueOwners];
}

export async function isReminderEnabledForOwner(ownerUid: string, type: ReminderType): Promise<boolean> {
  const preference = await getNotificationPreference(ownerUid);

  return isTypeEnabled(preference, type);
}

export async function shouldSendScheduledReminderForOwner(
  ownerUid: string,
  type: ReminderType,
  now = new Date(),
): Promise<ReminderScheduleDecision> {
  const preference = await getNotificationPreference(ownerUid);

  if (!isTypeEnabled(preference, type)) {
    return {
      shouldSend: false,
      reason: "Reminder type disabled by user preference.",
    };
  }

  const timezone = preference?.timezone || "UTC";
  const local = getLocalTimeParts(now, timezone);

  if (type === "weekly_review" && local.weekday !== "Sun") {
    return {
      shouldSend: false,
      reason: "Weekly review is scheduled for Sunday in user local time.",
    };
  }

  if (typeof preference?.preferredHourLocal === "number" && local.hour !== preference.preferredHourLocal) {
    return {
      shouldSend: false,
      reason: `Current local hour ${local.hour} does not match preferredHourLocal ${preference.preferredHourLocal}.`,
    };
  }

  if (isWithinQuietHours(local.hour, local.minute, preference?.quietHoursStart, preference?.quietHoursEnd)) {
    return {
      shouldSend: false,
      reason: "Current local time is within quiet hours.",
    };
  }

  const lastSentAt = await getLastSentReminderAt(ownerUid, type);
  if (lastSentAt) {
    const cooldownMs = getReminderCooldownMs(type);
    if (now.getTime() - lastSentAt.getTime() < cooldownMs) {
      return {
        shouldSend: false,
        reason: "Reminder is still inside cooldown window.",
      };
    }
  }

  return {
    shouldSend: true,
  };
}

async function getNotificationPreference(ownerUid: string): Promise<NotificationPreference | null> {
  const instantAdmin = getInstantAdmin();
  const { notificationPreferences = [] } = await instantAdmin.query({
    notificationPreferences: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const preference = (notificationPreferences as NotificationPreference[])[0];

  return preference ?? null;
}

function isTypeEnabled(preference: NotificationPreference | null, type: ReminderType) {
  if (!preference) {
    return true;
  }

  if (type === "daily_agenda") {
    return preference.dailyAgendaEnabled ?? true;
  }

  if (type === "weekly_review") {
    return preference.weeklyReviewEnabled ?? true;
  }

  return preference.dueTasksEnabled ?? true;
}

function getLocalTimeParts(now: Date, timeZone: string) {
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = timeFormatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";

  return {
    hour,
    minute,
    weekday,
  };
}

function isWithinQuietHours(
  hour: number,
  minute: number,
  quietHoursStart?: string,
  quietHoursEnd?: string,
) {
  if (!quietHoursStart || !quietHoursEnd) {
    return false;
  }

  const start = parseClockTimeMinutes(quietHoursStart);
  const end = parseClockTimeMinutes(quietHoursEnd);

  if (start === null || end === null || start === end) {
    return false;
  }

  const current = hour * 60 + minute;

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

function parseClockTimeMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

async function getLastSentReminderAt(ownerUid: string, type: ReminderType): Promise<Date | null> {
  const instantAdmin = getInstantAdmin();
  const { notificationDeliveries = [] } = await instantAdmin.query({
    notificationDeliveries: {
      $: {
        where: {
          ownerUid,
          reminderType: type,
          status: "sent",
        },
      },
    },
  });

  const rows = notificationDeliveries as DeliveryRecord[];

  if (rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latest = sorted[0];
  const latestDate = new Date(latest.createdAt);

  if (Number.isNaN(latestDate.valueOf())) {
    return null;
  }

  return latestDate;
}

function getReminderCooldownMs(type: ReminderType) {
  const hourMs = 60 * 60 * 1000;

  if (type === "daily_agenda") {
    return parseEnvPositiveNumber("REMINDER_DAILY_COOLDOWN_HOURS", 20) * hourMs;
  }

  if (type === "weekly_review") {
    return parseEnvPositiveNumber("REMINDER_WEEKLY_COOLDOWN_HOURS", 24 * 6) * hourMs;
  }

  return parseEnvPositiveNumber("REMINDER_DUE_TASKS_COOLDOWN_HOURS", 4) * hourMs;
}

function parseEnvPositiveNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export async function recordReminderDelivery(args: {
  ownerUid: string;
  reminderType: ReminderType;
  status: ReminderDeliveryStatus;
  title?: string;
  message?: string;
  deliveredCount?: number;
  failedCount?: number;
  staleDeletedCount?: number;
  schedulerRunId?: string;
  errorCode?: string;
  errorMessage?: string;
}) {
  const instantAdmin = getInstantAdmin();

  await instantAdmin.transact([
    instantAdmin.tx.notificationDeliveries[id()].update({
      ownerUid: args.ownerUid,
      reminderType: args.reminderType,
      channel: "push",
      status: args.status,
      title: args.title,
      message: args.message,
      deliveredCount: args.deliveredCount ?? 0,
      failedCount: args.failedCount ?? 0,
      staleDeletedCount: args.staleDeletedCount ?? 0,
      schedulerRunId: args.schedulerRunId,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      createdAt: new Date().toISOString(),
    }),
  ]);
}

function buildDailyAgendaBody(data: ReminderData) {
  const base = `You have ${data.activeGoals} active goal${data.activeGoals === 1 ? "" : "s"}.`;

  if (data.overdue > 0) {
    return `${base} ${data.overdue} overdue task${data.overdue === 1 ? " is" : "s are"} waiting.`;
  }

  if (data.dueToday > 0) {
    return `${base} ${data.dueToday} task${data.dueToday === 1 ? " is" : "s are"} due today.`;
  }

  return `${base} You're clear for now, keep your momentum.`;
}

function buildWeeklyReviewBody(data: ReminderData) {
  return `This week: ${data.completedThisWeek} task${data.completedThisWeek === 1 ? "" : "s"} completed, ${data.activeGoals} active goal${data.activeGoals === 1 ? "" : "s"}, ${data.overdue} overdue task${data.overdue === 1 ? "" : "s"}.`;
}

function buildDueTasksBody(data: ReminderData) {
  if (data.overdue === 0 && data.dueToday === 0) {
    return "No tasks due today. Great job staying ahead.";
  }

  if (data.overdue > 0 && data.dueToday > 0) {
    return `${data.overdue} overdue and ${data.dueToday} due today. Pick one and start now.`;
  }

  if (data.overdue > 0) {
    return `${data.overdue} task${data.overdue === 1 ? " is" : "s are"} overdue. Quick win time.`;
  }

  return `${data.dueToday} task${data.dueToday === 1 ? " is" : "s are"} due today.`;
}

async function getReminderData(ownerUid: string, now: Date): Promise<ReminderData> {
  const instantAdmin = getInstantAdmin();
  const [goalsResult, tasksResult] = await Promise.all([
    instantAdmin.query({
      goals: {
        $: {
          where: {
            ownerUid,
          },
        },
      },
    }),
    instantAdmin.query({
      tasks: {
        $: {
          where: {
            ownerUid,
          },
        },
      },
    }),
  ]);

  const goals = (goalsResult.goals as Goal[] | undefined) ?? [];
  const tasks = (tasksResult.tasks as Task[] | undefined) ?? [];
  const activeGoals = goals.filter((goal) => !goal.deletedAt && goal.status !== "done").length;

  const today = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  let dueToday = 0;
  let overdue = 0;
  let completedThisWeek = 0;

  for (const task of tasks) {
    if (task.deletedAt) {
      continue;
    }

    if (task.status === "done") {
      const updatedAtDate = new Date(task.updatedAt);
      if (!Number.isNaN(updatedAtDate.valueOf()) && updatedAtDate >= weekStart) {
        completedThisWeek += 1;
      }
      continue;
    }

    if (!task.dueDate) {
      continue;
    }

    const dueDate = task.dueDate.slice(0, 10);
    if (dueDate === today) {
      dueToday += 1;
    } else if (dueDate < today) {
      overdue += 1;
    }
  }

  return {
    activeGoals,
    dueToday,
    overdue,
    completedThisWeek,
  };
}
