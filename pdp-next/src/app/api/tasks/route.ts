import { NextResponse } from "next/server";
import {
  createTask,
  parseTaskWritePayload,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseTaskWritePayload(request);
    const task = await createTask(user.id, payload);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}