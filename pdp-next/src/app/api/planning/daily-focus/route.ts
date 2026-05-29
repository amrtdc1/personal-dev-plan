import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  getOwnedDailyFocusPlan,
  parseDailyFocusDate,
  parseDailyFocusWritePayload,
  upsertDailyFocusPlan,
} from "@/lib/server/planning-route-core";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const date = parseDailyFocusDate(searchParams);
    const plan = await getOwnedDailyFocusPlan(user.id, date);
    return NextResponse.json({ plan });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const date = parseDailyFocusDate(searchParams);
    const payload = await parseDailyFocusWritePayload(request);
    const plan = await upsertDailyFocusPlan(user.id, date, payload);
    return NextResponse.json({ plan });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
