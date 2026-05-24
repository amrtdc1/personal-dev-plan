import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import { sendPushToOwner, type PushMessagePayload } from "@/lib/server/push-delivery";

type NotificationTestPayload = {
  title?: string;
  body?: string;
  url?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parsePayload(request);
    const result = await sendPushToOwner(user.id, payload);

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/test",
      method: "POST",
      phase: "send-test",
    });
  }
}

async function parsePayload(request: Request): Promise<PushMessagePayload> {
  let payload: NotificationTestPayload;

  try {
    payload = (await request.json()) as NotificationTestPayload;
  } catch {
    throw new InstantRouteBadRequestError("Request body must be valid JSON.");
  }

  const title = payload.title?.trim() || "Personal Development Plan";
  const body = payload.body?.trim() || "This is a test notification from your PDP workspace.";
  const url = payload.url?.trim() || "/";

  if (!url.startsWith("/") && !url.startsWith("http://") && !url.startsWith("https://")) {
    throw new InstantRouteBadRequestError("url must be a relative path or absolute http(s) URL.");
  }

  return {
    title,
    body,
    url,
    tag: "pdp-test-notification",
  };
}
