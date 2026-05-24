import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedHabitCheckin,
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";
import {
  deleteHabitCheckin,
  parseHabitCheckinWritePayload,
  updateHabitCheckin,
} from "@/lib/server/instant-write";

type RouteContext = {
  params: Promise<{
    habitId: string;
    checkinId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId, checkinId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    requireRouteParam(checkinId, "Check-in id");
    const checkin = await findOwnedHabitCheckin(user.id, habitId, checkinId);
    return NextResponse.json({ checkin });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId, checkinId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    requireRouteParam(checkinId, "Check-in id");
    const payload = await parseHabitCheckinWritePayload(request);
    const checkin = await updateHabitCheckin(user.id, habitId, checkinId, payload);
    return NextResponse.json({ checkin });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId, checkinId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    requireRouteParam(checkinId, "Check-in id");
    const summary = await deleteHabitCheckin(user.id, habitId, checkinId);
    return NextResponse.json({ summary });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
