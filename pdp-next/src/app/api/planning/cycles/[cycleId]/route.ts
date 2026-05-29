import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse, requireRouteParam } from "@/lib/server/instant-route";
import { parsePlanningCycleWritePayload, updatePlanningCycle } from "@/lib/server/planning-route-core";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cycleId: string }> },
) {
  try {
    const user = await requireInstantUser(request);
    const { cycleId } = await params;
    requireRouteParam(cycleId, "cycleId");
    const payload = await parsePlanningCycleWritePayload(request);
    const cycle = await updatePlanningCycle(user.id, cycleId, payload);
    return NextResponse.json({ cycle });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
