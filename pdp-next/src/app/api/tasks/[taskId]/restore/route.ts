import { NextResponse } from "next/server";
import { restoreTask } from "@/lib/server/instant-lifecycle";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { taskId } = await context.params;
    requireRouteParam(taskId, "Task id");

    const task = await restoreTask(user.id, taskId);
    return NextResponse.json({ task });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}