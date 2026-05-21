import { NextResponse } from "next/server";
import { statusToPercent } from "@/lib/domain/status";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedGoal,
  instantRouteErrorResponse,
  parseStatusUpdatePayload,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    goalId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const instantAdmin = getInstantAdmin();
    const user = await requireInstantUser(request);
    const { goalId } = await context.params;
    requireRouteParam(goalId, "Goal id");
    const status = await parseStatusUpdatePayload(request);
    const goal = await findOwnedGoal(user.id, goalId);

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(status);

    await instantAdmin.transact(
      instantAdmin.tx.goals[goalId].update({
        status,
        percentComplete,
        updatedAt: now,
      }),
    );

    return NextResponse.json({
      goal: {
        ...goal,
        status,
        percentComplete,
        updatedAt: now,
      },
    });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}