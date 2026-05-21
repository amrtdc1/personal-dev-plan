import { NextResponse } from "next/server";
import { statusToPercent } from "@/lib/domain/status";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedSubgoal,
  instantRouteErrorResponse,
  parseStatusUpdatePayload,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    subgoalId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const instantAdmin = getInstantAdmin();
    const user = await requireInstantUser(request);
    const { subgoalId } = await context.params;
    requireRouteParam(subgoalId, "Subgoal id");
    const status = await parseStatusUpdatePayload(request);
    const subgoal = await findOwnedSubgoal(user.id, subgoalId);

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(status);

    await instantAdmin.transact(
      instantAdmin.tx.subgoals[subgoalId].update({
        status,
        percentComplete,
        updatedAt: now,
      }),
    );

    return NextResponse.json({
      subgoal: {
        ...subgoal,
        status,
        percentComplete,
        updatedAt: now,
      },
    });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}