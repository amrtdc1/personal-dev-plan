import { NextResponse } from "next/server";
import { archiveJournalEntry } from "@/lib/server/instant-lifecycle";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";

type RouteContext = {
  params: Promise<{
    journalEntryId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { journalEntryId } = await context.params;
    requireRouteParam(journalEntryId, "Journal entry id");

    const journalEntry = await archiveJournalEntry(user.id, journalEntryId);
    return NextResponse.json({ journalEntry });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
