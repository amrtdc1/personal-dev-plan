import { NextResponse } from "next/server";
import {
  parseGoalWritePayload,
  updateGoal,
} from "@/lib/server/instant-write";
import { permanentlyDeleteGoal } from "@/lib/server/instant-lifecycle";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedGoal,
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    goalId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { goalId } = await context.params;
    requireRouteParam(goalId, "Goal id");
    const goal = await findOwnedGoal(user.id, goalId);
    return NextResponse.json({ goal });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { goalId } = await context.params;
    requireRouteParam(goalId, "Goal id");
    const payload = await parseGoalWritePayload(request);
    const goal = await updateGoal(user.id, goalId, payload);
    return NextResponse.json({ goal });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { goalId } = await context.params;
    requireRouteParam(goalId, "Goal id");
    const summary = await permanentlyDeleteGoal(user.id, goalId);
    return NextResponse.json({ summary });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}