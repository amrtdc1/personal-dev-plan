import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  createPlanningCycle,
  listOwnedPlanningCycles,
  parsePlanningCycleTypeFilter,
  parsePlanningCycleWritePayload,
} from "@/lib/server/planning-route-core";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const cycleType = parsePlanningCycleTypeFilter(searchParams);
    const cycles = await listOwnedPlanningCycles(user.id, { cycleType });
    return NextResponse.json({ cycles });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parsePlanningCycleWritePayload(request);
    const cycle = await createPlanningCycle(user.id, payload);
    return NextResponse.json({ cycle }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
