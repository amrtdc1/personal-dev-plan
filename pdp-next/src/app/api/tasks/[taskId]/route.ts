import { NextResponse } from "next/server";
import {
  parseTaskWritePayload,
  updateTask,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedTask,
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { taskId } = await context.params;
    requireRouteParam(taskId, "Task id");
    const task = await findOwnedTask(user.id, taskId);
    return NextResponse.json({ task });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { taskId } = await context.params;
    requireRouteParam(taskId, "Task id");
    const payload = await parseTaskWritePayload(request);
    const task = await updateTask(user.id, taskId, payload);
    return NextResponse.json({ task });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}