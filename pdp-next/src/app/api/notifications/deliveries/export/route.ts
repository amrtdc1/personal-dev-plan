import { NextResponse } from "next/server";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  filterAndPaginateDeliveries,
  parseDeliveryQueryFilters,
  type DeliveryRecord,
} from "@/lib/server/notification-route-core";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const filters = parseDeliveryQueryFilters(searchParams, {
      defaultLimit: 500,
      maxLimit: 1000,
    });

    const instantAdmin = getInstantAdmin();
    const { notificationDeliveries = [] } = await instantAdmin.query({
      notificationDeliveries: {
        $: {
          where: {
            ownerUid: user.id,
          },
        },
      },
    });

    const { deliveries } = filterAndPaginateDeliveries(notificationDeliveries as DeliveryRecord[], filters);

    const header = [
      "createdAt",
      "reminderType",
      "status",
      "title",
      "message",
      "deliveredCount",
      "failedCount",
      "staleDeletedCount",
    ];

    const lines = deliveries.map((entry) => [
      entry.createdAt,
      entry.reminderType,
      entry.status,
      entry.title ?? "",
      entry.message ?? "",
      String(entry.deliveredCount),
      String(entry.failedCount),
      String(entry.staleDeletedCount),
    ]);

    const csv = [header, ...lines]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=notification-deliveries.csv",
      },
    });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/deliveries/export",
      method: "GET",
      phase: "export-deliveries",
    });
  }
}

function escapeCsvValue(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
