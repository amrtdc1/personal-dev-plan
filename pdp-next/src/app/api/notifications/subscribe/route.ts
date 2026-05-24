import { id } from "@instantdb/admin";
import { NextResponse } from "next/server";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

type SubscribePayload = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
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
    const nowIso = new Date().toISOString();
    const userAgent = request.headers.get("user-agent") ?? undefined;

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

    if (existing) {
      await instantAdmin.transact([
        instantAdmin.tx.pushSubscriptions[existing.id].update({
          ownerUid: user.id,
          endpoint: payload.endpoint,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
          expirationTime: payload.expirationTime,
          userAgent,
          updatedAt: nowIso,
        }),
      ]);
    } else {
      await instantAdmin.transact([
        instantAdmin.tx.pushSubscriptions[id()].update({
          ownerUid: user.id,
          endpoint: payload.endpoint,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
          expirationTime: payload.expirationTime,
          userAgent,
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
      ]);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/subscribe",
      method: "POST",
      phase: "subscribe",
    });
  }
}

async function parsePayload(request: Request) {
  let payload: SubscribePayload;

  try {
    payload = (await request.json()) as SubscribePayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }

  if (!payload.endpoint || payload.endpoint.trim().length === 0) {
    throw new InstantRouteBadRequestError("Subscription endpoint is required.");
  }

  if (!payload.keys?.p256dh || !payload.keys?.auth) {
    throw new InstantRouteBadRequestError("Subscription encryption keys are required.");
  }

  return {
    endpoint: payload.endpoint.trim(),
    expirationTime: typeof payload.expirationTime === "number" ? payload.expirationTime : undefined,
    keys: {
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
  };
}
