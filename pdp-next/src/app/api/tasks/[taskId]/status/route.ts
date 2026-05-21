import { NextResponse } from "next/server";
import { statusToPercent } from "@/lib/domain/status";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedTask,
  instantRouteErrorResponse,
  parseStatusUpdatePayload,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const instantAdmin = getInstantAdmin();
    const user = await requireInstantUser(request);
    const { taskId } = await context.params;
    requireRouteParam(taskId, "Task id");
    const status = await parseStatusUpdatePayload(request);
    const task = await findOwnedTask(user.id, taskId);

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(status);

    await instantAdmin.transact(
      instantAdmin.tx.tasks[taskId].update({
        status,
        percentComplete,
        updatedAt: now,
      }),
    );

    return NextResponse.json({
      task: {
        ...task,
        status,
        percentComplete,
        updatedAt: now,
      },
    });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}