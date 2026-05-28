import { NextResponse } from "next/server";
import {
  parseTaskReorderPayload,
  reorderTasks,
} from "@/lib/server/instant-reorder";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function PATCH(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseTaskReorderPayload(request);

    const tasks = await reorderTasks(user.id, payload.parentGoalId, payload.orderedTaskIds);
    return NextResponse.json({ tasks });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}