import { NextResponse } from "next/server";
import { restoreHabit } from "@/lib/server/instant-lifecycle";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse, requireRouteParam } from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    habitId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId } = await context.params;
    requireRouteParam(habitId, "Habit id");

    const habit = await restoreHabit(user.id, habitId);
    return NextResponse.json({ habit });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
