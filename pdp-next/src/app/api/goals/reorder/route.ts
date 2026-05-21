import { NextResponse } from "next/server";
import {
  parseGoalReorderPayload,
  reorderGoals,
} from "@/lib/server/instant-reorder";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function PATCH(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseGoalReorderPayload(request);

    const goals = await reorderGoals(user.id, payload.type, payload.orderedGoalIds);
    return NextResponse.json({ goals });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}