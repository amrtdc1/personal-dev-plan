import { NextResponse } from "next/server";
import {
  createJournalEntry,
  parseJournalWritePayload,
} from "@/lib/server/instant-write";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";
import {
  listOwnedJournalEntries,
  parseIncludeDeleted,
} from "@/lib/server/instant-read";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const searchParams = new URL(request.url).searchParams;
    const includeDeleted = parseIncludeDeleted(searchParams);
    const journalEntries = await listOwnedJournalEntries(user.id, { includeDeleted });
    return NextResponse.json({ journalEntries });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const payload = await parseJournalWritePayload(request);
    const journalEntry = await createJournalEntry(user.id, payload);
    return NextResponse.json({ journalEntry }, { status: 201 });
  } catch (error) {
    return instantRouteErrorResponse(error);
  }
}
