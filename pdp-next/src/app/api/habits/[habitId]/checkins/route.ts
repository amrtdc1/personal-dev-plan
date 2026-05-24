import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse, requireRouteParam } from "@/lib/server/instant-route";
import { listOwnedHabitCheckins } from "@/lib/server/instant-read";
import { createHabitCheckin, parseHabitCheckinWritePayload } from "@/lib/server/instant-write";

type RouteContext = {
  params: Promise<{
    habitId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    const checkins = await listOwnedHabitCheckins(user.id, { habitId });
    return NextResponse.json({ checkins });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    const payload = await parseHabitCheckinWritePayload(request);
    const checkin = await createHabitCheckin(user.id, habitId, payload);
    return NextResponse.json({ checkin }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
