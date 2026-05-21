import { NextResponse } from "next/server";
import {
  createGoal,
  parseGoalWritePayload,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  listOwnedGoals,
  parseGoalType,
  parseIncludeDeleted,
} from "@/lib/server/instant-read";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const includeDeleted = parseIncludeDeleted(searchParams);
    const type = parseGoalType(searchParams);
    const goals = await listOwnedGoals(user.id, { includeDeleted, type });
    return NextResponse.json({ goals });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseGoalWritePayload(request);
    const goal = await createGoal(user.id, payload);
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}