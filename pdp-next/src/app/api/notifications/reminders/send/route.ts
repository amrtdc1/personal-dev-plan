import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  buildReminderPayloadForOwner,
  isReminderType,
  isReminderEnabledForOwner,
  recordReminderDelivery,
  type ReminderType,
} from "@/lib/server/notification-reminders";
import { sendPushToOwner } from "@/lib/server/push-delivery";

type ReminderSendPayload = {
  type?: ReminderType;
};

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const { type } = await parsePayload(request);
    const reminderEnabled = await isReminderEnabledForOwner(user.id, type);

    if (!reminderEnabled) {
      await recordReminderDelivery({
        ownerUid: user.id,
        reminderType: type,
        status: "skipped",
        message: "Reminder type is disabled by user preference.",
      });

      return NextResponse.json(
        {
          ok: true,
          type,
          skipped: true,
          reason: "Reminder type is disabled in your notification preferences.",
        },
        { status: 200 },
      );
    }

    const pushPayload = await buildReminderPayloadForOwner(user.id, type);
    const deliveryResult = await sendPushToOwner(user.id, pushPayload);

    await recordReminderDelivery({
      ownerUid: user.id,
      reminderType: type,
      status: deliveryResult.delivered > 0 ? "sent" : deliveryResult.failed > 0 ? "failed" : "skipped",
      title: pushPayload.title,
      message: pushPayload.body,
      deliveredCount: deliveryResult.delivered,
      failedCount: deliveryResult.failed,
      staleDeletedCount: deliveryResult.staleDeleted,
    });

    return NextResponse.json(
      {
        ok: true,
        type,
        message: pushPayload.body,
        ...deliveryResult,
      },
      { status: 200 },
    );
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/reminders/send",
      method: "POST",
      phase: "send-reminder",
    });
  }
}

async function parsePayload(request: Request): Promise<{ type: ReminderType }> {
  let payload: ReminderSendPayload;

  try {
    payload = (await request.json()) as ReminderSendPayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }

  const reminderType = payload.type ?? "daily_agenda";

  if (!isReminderType(reminderType)) {
    throw new InstantRouteBadRequestError("type must be one of: daily_agenda, weekly_review, due_tasks.");
  }

  return {
    type: reminderType,
  };
}
