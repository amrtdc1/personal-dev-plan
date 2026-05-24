import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function GET(request: Request) {
  try {
    await requireInstantUser(request);

    const cronSecret = process.env.NOTIFICATION_CRON_SECRET?.trim();
    if (!cronSecret) {
      return NextResponse.json({ error: "NOTIFICATION_CRON_SECRET is not configured." }, { status: 500 });
    }

    const searchParams = new URL(request.url).searchParams;
    const hours = parseHours(searchParams.get("hours"));
    const origin = new URL(request.url).origin;

    const response = await fetch(`${origin}/api/notifications/reminders/summary?hours=${hours}`, {
      method: "GET",
      headers: {
        "x-pdp-cron-secret": cronSecret,
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: body?.error || "Could not load reminder summary.",
        },
        { status: response.status },
      );
    }

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/reminders/summary-proxy",
      method: "GET",
      phase: "summary-proxy",
    });
  }
}

function parseHours(rawValue: string | null) {
  if (!rawValue) {
    return 24;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    throw new InstantRouteBadRequestError("hours must be a number.");
  }

  const normalized = Math.floor(parsed);

  if (normalized <= 0) {
    throw new InstantRouteBadRequestError("hours must be greater than zero.");
  }

  return Math.min(normalized, 24 * 14);
}
