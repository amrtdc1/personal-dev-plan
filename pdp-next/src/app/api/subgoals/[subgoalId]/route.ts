import { NextResponse } from "next/server";
import {
  parseSubgoalWritePayload,
  updateSubgoal,
} from "@/lib/server/instant-write";
import { permanentlyDeleteSubgoal } from "@/lib/server/instant-lifecycle";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedSubgoal,
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    subgoalId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { subgoalId } = await context.params;
    requireRouteParam(subgoalId, "Subgoal id");
    const subgoal = await findOwnedSubgoal(user.id, subgoalId);
    return NextResponse.json({ subgoal });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { subgoalId } = await context.params;
    requireRouteParam(subgoalId, "Subgoal id");
    const payload = await parseSubgoalWritePayload(request);
    const subgoal = await updateSubgoal(user.id, subgoalId, payload);
    return NextResponse.json({ subgoal });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { subgoalId } = await context.params;
    requireRouteParam(subgoalId, "Subgoal id");
    const summary = await permanentlyDeleteSubgoal(user.id, subgoalId);
    return NextResponse.json({ summary });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}