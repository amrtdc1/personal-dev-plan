import { NextResponse } from "next/server";
import {
  createGoal,
  parseGoalWritePayload,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

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