import { NextResponse } from "next/server";
import {
  createTask,
  parseTaskWritePayload,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  listOwnedTasks,
  parseIncludeDeleted,
  parseTaskParentGoalFilter,
} from "@/lib/server/instant-read";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const includeDeleted = parseIncludeDeleted(searchParams);
    const taskParentFilter = parseTaskParentGoalFilter(searchParams);
    const tasks = await listOwnedTasks(user.id, { includeDeleted, ...taskParentFilter });
    return NextResponse.json({ tasks });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

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