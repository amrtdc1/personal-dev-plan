import { NextResponse } from "next/server";
import { parseHabitWritePayload, updateHabit } from "@/lib/server/instant-write";
import { permanentlyDeleteHabit } from "@/lib/server/instant-lifecycle";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { findOwnedHabit, instantRouteErrorResponse, requireRouteParam } from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    habitId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    const habit = await findOwnedHabit(user.id, habitId);
    return NextResponse.json({ habit });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    const payload = await parseHabitWritePayload(request);
    const habit = await updateHabit(user.id, habitId, payload);
    return NextResponse.json({ habit });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { habitId } = await context.params;
    requireRouteParam(habitId, "Habit id");
    const summary = await permanentlyDeleteHabit(user.id, habitId);
    return NextResponse.json({ summary });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
