import { NextResponse } from "next/server";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { parseHours, summarizeReminderDeliveries } from "@/lib/server/notification-route-core";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

type DeliveryRecord = {
  reminderType: string;
  status: "sent" | "failed" | "skipped";
  createdAt: string;
};

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.NOTIFICATION_CRON_SECRET?.trim();

    if (!cronSecret) {
      return NextResponse.json({ error: "NOTIFICATION_CRON_SECRET is not configured." }, { status: 500 });
    }

    const providedSecret = request.headers.get("x-pdp-cron-secret")?.trim();
    if (!providedSecret || providedSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const hours = parseHours(searchParams.get("hours"), {
      defaultHours: 24,
      maxHours: 24 * 14,
    });
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const instantAdmin = getInstantAdmin();
    const { notificationDeliveries = [] } = await instantAdmin.query({
      notificationDeliveries: {},
    });

    const rows = notificationDeliveries as DeliveryRecord[];
    const summary = summarizeReminderDeliveries(rows, since);

    return NextResponse.json({
      ok: true,
      hours,
      since,
      totalRows: summary.totalRows,
      totals: summary.totals,
      byType: summary.byType,
    });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/reminders/summary",
      method: "GET",
      phase: "summary",
    });
  }
}
