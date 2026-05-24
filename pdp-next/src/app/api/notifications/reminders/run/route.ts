import { NextResponse } from "next/server";
import {
  buildReminderPayloadForOwner,
  isReminderType,
  listOwnersWithPushSubscriptions,
  recordReminderDelivery,
  shouldSendScheduledReminderForOwner,
  type ReminderType,
} from "@/lib/server/notification-reminders";
import { sendPushToOwner } from "@/lib/server/push-delivery";

type ReminderRunPayload = {
  type?: ReminderType;
};

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.NOTIFICATION_CRON_SECRET?.trim();

    if (!cronSecret) {
      return NextResponse.json(
        {
          error: "NOTIFICATION_CRON_SECRET is not configured.",
        },
        { status: 500 },
      );
    }

    const providedSecret = request.headers.get("x-pdp-cron-secret")?.trim();
    if (!providedSecret || providedSecret !== cronSecret) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const { type } = await parsePayload(request);
    const owners = await listOwnersWithPushSubscriptions();
    const schedulerRunId = `${Date.now()}`;

    let ownersProcessed = 0;
    let ownersWithFailures = 0;
    let ownersSkipped = 0;
    let delivered = 0;
    let staleDeleted = 0;
    let failed = 0;

    for (const ownerUid of owners) {
      ownersProcessed += 1;

      try {
        const scheduleDecision = await shouldSendScheduledReminderForOwner(ownerUid, type);

        if (!scheduleDecision.shouldSend) {
          ownersSkipped += 1;
          await recordReminderDelivery({
            ownerUid,
            reminderType: type,
            status: "skipped",
            message: scheduleDecision.reason,
            schedulerRunId,
          });
          continue;
        }

        const payload = await buildReminderPayloadForOwner(ownerUid, type);
        const result = await sendPushToOwner(ownerUid, payload);
        delivered += result.delivered;
        staleDeleted += result.staleDeleted;
        failed += result.failed;

        await recordReminderDelivery({
          ownerUid,
          reminderType: type,
          status: result.delivered > 0 ? "sent" : result.failed > 0 ? "failed" : "skipped",
          title: payload.title,
          message: payload.body,
          deliveredCount: result.delivered,
          failedCount: result.failed,
          staleDeletedCount: result.staleDeleted,
          schedulerRunId,
        });
      } catch {
        ownersWithFailures += 1;
        await recordReminderDelivery({
          ownerUid,
          reminderType: type,
          status: "failed",
          message: "Unhandled error while processing scheduled reminder.",
          schedulerRunId,
          errorCode: "scheduler_exception",
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        type,
        schedulerRunId,
        ownersProcessed,
        ownersWithFailures,
        ownersSkipped,
        delivered,
        staleDeleted,
        failed,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Reminder run failed.",
      },
      { status: 500 },
    );
  }
}

async function parsePayload(request: Request): Promise<{ type: ReminderType }> {
  let payload: ReminderRunPayload = {};

  try {
    payload = (await request.json()) as ReminderRunPayload;
  } catch {
    payload = {};
  }

  const reminderType = payload.type ?? "daily_agenda";

  if (!isReminderType(reminderType)) {
    return {
      type: "daily_agenda",
    };
  }

  return {
    type: reminderType,
  };
}
