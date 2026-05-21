import { NextResponse } from "next/server";
import {
  createSubgoal,
  parseSubgoalWritePayload,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseSubgoalWritePayload(request);
    const subgoal = await createSubgoal(user.id, payload);
    return NextResponse.json({ subgoal }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}