const {
  requireInstantUserMock,
  requireRouteParamMock,
  instantRouteErrorResponseMock,
  archiveJournalEntryMock,
  restoreJournalEntryMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  requireRouteParamMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
  archiveJournalEntryMock: vi.fn(),
  restoreJournalEntryMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  requireRouteParam: requireRouteParamMock,
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

vi.mock("@/lib/server/instant-lifecycle", () => ({
  archiveJournalEntry: archiveJournalEntryMock,
  restoreJournalEntry: restoreJournalEntryMock,
}));

import { PATCH as ARCHIVE_PATCH } from "@/app/api/journal/[journalEntryId]/archive/route";
import { PATCH as RESTORE_PATCH } from "@/app/api/journal/[journalEntryId]/restore/route";

describe("api/journal/[journalEntryId] lifecycle routes", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    requireRouteParamMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    archiveJournalEntryMock.mockReset();
    restoreJournalEntryMock.mockReset();
  });

  it("archives journal entry on archive PATCH", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    archiveJournalEntryMock.mockResolvedValue({ id: "entry-1", deletedAt: "2026-05-24T10:00:00.000Z" });

    const request = new Request("http://localhost:3000/api/journal/entry-1/archive", { method: "PATCH" });
    const context = { params: Promise.resolve({ journalEntryId: "entry-1" }) };
    const response = await ARCHIVE_PATCH(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("entry-1", "Journal entry id");
    expect(archiveJournalEntryMock).toHaveBeenCalledWith("user-1", "entry-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      journalEntry: { id: "entry-1", deletedAt: "2026-05-24T10:00:00.000Z" },
    });
  });

  it("restores journal entry on restore PATCH", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    restoreJournalEntryMock.mockResolvedValue({ id: "entry-1", deletedAt: null });

    const request = new Request("http://localhost:3000/api/journal/entry-1/restore", { method: "PATCH" });
    const context = { params: Promise.resolve({ journalEntryId: "entry-1" }) };
    const response = await RESTORE_PATCH(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("entry-1", "Journal entry id");
    expect(restoreJournalEntryMock).toHaveBeenCalledWith("user-1", "entry-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      journalEntry: { id: "entry-1", deletedAt: null },
    });
  });

  it("delegates archive failures to shared error response", async () => {
    const failure = new Error("not found");
    const expected = Response.json({ error: "Not found" }, { status: 404 });

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    archiveJournalEntryMock.mockRejectedValue(failure);
    instantRouteErrorResponseMock.mockReturnValue(expected);

    const request = new Request("http://localhost:3000/api/journal/entry-1/archive", { method: "PATCH" });
    const context = { params: Promise.resolve({ journalEntryId: "entry-1" }) };
    const response = await ARCHIVE_PATCH(request, context);

    expect(instantRouteErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response).toBe(expected);
  });
});
