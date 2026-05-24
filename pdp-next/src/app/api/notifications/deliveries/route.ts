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
      defaultLimit: 8,
      maxLimit: 20,
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

    const { deliveries, hasMore, nextCursor } = filterAndPaginateDeliveries(
      notificationDeliveries as DeliveryRecord[],
      filters,
    );

    return NextResponse.json({ deliveries, hasMore, nextCursor });
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/notifications/deliveries",
      method: "GET",
      phase: "list-deliveries",
    });
  }
}
