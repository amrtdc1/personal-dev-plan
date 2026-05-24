import { NextResponse } from "next/server";
import { createHabit, parseHabitWritePayload } from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import { listOwnedHabits, parseIncludeDeleted } from "@/lib/server/instant-read";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const includeDeleted = parseIncludeDeleted(searchParams);
    const habits = await listOwnedHabits(user.id, { includeDeleted });
    return NextResponse.json({ habits });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseHabitWritePayload(request);
    const habit = await createHabit(user.id, payload);
    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
