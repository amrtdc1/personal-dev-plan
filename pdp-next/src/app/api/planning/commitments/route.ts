import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  createPlanningCommitment,
  listOwnedPlanningCommitments,
  parsePlanningCommitmentWritePayload,
  parsePlanningCommitmentsFilter,
} from "@/lib/server/planning-route-core";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const filters = parsePlanningCommitmentsFilter(searchParams);
    const commitments = await listOwnedPlanningCommitments(user.id, filters);
    return NextResponse.json({ commitments });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parsePlanningCommitmentWritePayload(request);
    const commitment = await createPlanningCommitment(user.id, payload);
    return NextResponse.json({ commitment }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
