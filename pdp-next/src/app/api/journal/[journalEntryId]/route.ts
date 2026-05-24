import { NextResponse } from "next/server";
import {
  parseJournalWritePayload,
  updateJournalEntry,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import {
  findOwnedJournalEntry,
  instantRouteErrorResponse,
  requireRouteParam,
} from "@/lib/server/instant-route";
import { permanentlyDeleteJournalEntry } from "@/lib/server/instant-lifecycle";

type RouteContext = {
  params: Promise<{
    journalEntryId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { journalEntryId } = await context.params;
    requireRouteParam(journalEntryId, "Journal entry id");

    const journalEntry = await findOwnedJournalEntry(user.id, journalEntryId);
    return NextResponse.json({ journalEntry });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { journalEntryId } = await context.params;
    requireRouteParam(journalEntryId, "Journal entry id");

    const payload = await parseJournalWritePayload(request);
    const journalEntry = await updateJournalEntry(user.id, journalEntryId, payload);
    return NextResponse.json({ journalEntry });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireInstantUser(request);
    const { journalEntryId } = await context.params;
    requireRouteParam(journalEntryId, "Journal entry id");

    const deletion = await permanentlyDeleteJournalEntry(user.id, journalEntryId);
    return NextResponse.json(deletion);
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
