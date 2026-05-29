import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse, requireRouteParam } from "@/lib/server/instant-route";
import { carryoverPlanningCommitment } from "@/lib/server/planning-route-core";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commitmentId: string }> },
) {
  try {
    const user = await requireInstantUser(request);
    const { commitmentId } = await params;
    requireRouteParam(commitmentId, "commitmentId");
    const commitment = await carryoverPlanningCommitment(user.id, commitmentId);
    return NextResponse.json({ commitment }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
