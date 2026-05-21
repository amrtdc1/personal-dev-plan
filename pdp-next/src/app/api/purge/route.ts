import { NextResponse } from "next/server";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { purgeExpiredOwnedData } from "@/lib/server/instant-lifecycle";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const summary = await purgeExpiredOwnedData(user.id);
    return NextResponse.json({ summary });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}