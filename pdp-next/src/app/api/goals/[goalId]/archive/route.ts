import { NextResponse } from "next/server";
import { archiveGoal } from "@/lib/server/instant-lifecycle";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    goalId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { goalId } = await context.params;
    requireRouteParam(goalId, "Goal id");

    const goal = await archiveGoal(user.id, goalId);
    return NextResponse.json({ goal });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}