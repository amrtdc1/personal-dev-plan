import { NextResponse } from "next/server";
import {
  parseSubgoalReorderPayload,
  reorderSubgoals,
} from "@/lib/server/instant-reorder";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function PATCH(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseSubgoalReorderPayload(request);

    const subgoals = await reorderSubgoals(user.id, payload.goalId, payload.orderedSubgoalIds);
    return NextResponse.json({ subgoals });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}