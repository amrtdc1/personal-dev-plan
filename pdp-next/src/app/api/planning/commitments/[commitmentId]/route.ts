import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse, requireRouteParam } from "@/lib/server/instant-route";
import {
  deletePlanningCommitment,
  parsePlanningCommitmentWritePayload,
  updatePlanningCommitment,
} from "@/lib/server/planning-route-core";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commitmentId: string }> },
) {
  try {
    const user = await requireInstantUser(request);
    const { commitmentId } = await params;
    requireRouteParam(commitmentId, "commitmentId");
    const payload = await parsePlanningCommitmentWritePayload(request);
    const commitment = await updatePlanningCommitment(user.id, commitmentId, payload);
    return NextResponse.json({ commitment });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ commitmentId: string }> },
) {
  try {
    const user = await requireInstantUser(request);
    const { commitmentId } = await params;
    requireRouteParam(commitmentId, "commitmentId");
    await deletePlanningCommitment(user.id, commitmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
