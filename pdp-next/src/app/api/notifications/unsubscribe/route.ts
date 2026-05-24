import { NextResponse } from "next/server";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

type UnsubscribePayload = {
  endpoint?: string;
};

type PushSubscriptionRecord = {
  id: string;
  ownerUid: string;
  endpoint: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parsePayload(request);
    const instantAdmin = getInstantAdmin();

    const { pushSubscriptions = [] } = await instantAdmin.query({
      pushSubscriptions: {
        $: {
          where: {
            endpoint: payload.endpoint,
          },
        },
      },
    });

    const existing = (pushSubscriptions as PushSubscriptionRecord[])[0];

    if (!existing || existing.ownerUid !== user.id) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await instantAdmin.transact([instantAdmin.tx.pushSubscriptions[existing.id].delete()]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/unsubscribe",
      method: "POST",
      phase: "unsubscribe",
    });
  }
}

async function parsePayload(request: Request) {
  let payload: UnsubscribePayload;

  try {
    payload = (await request.json()) as UnsubscribePayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }

  if (!payload.endpoint || payload.endpoint.trim().length === 0) {
    throw new InstantRouteBadRequestError("Subscription endpoint is required.");
  }

  return {
    endpoint: payload.endpoint.trim(),
  };
}
