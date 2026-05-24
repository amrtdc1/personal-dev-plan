const {
  requireInstantUserMock,
  listOwnedJournalEntriesMock,
  parseIncludeDeletedMock,
  parseJournalWritePayloadMock,
  createJournalEntryMock,
  instantRouteErrorResponseMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  listOwnedJournalEntriesMock: vi.fn(),
  parseIncludeDeletedMock: vi.fn(),
  parseJournalWritePayloadMock: vi.fn(),
  createJournalEntryMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-read", () => ({
  listOwnedJournalEntries: listOwnedJournalEntriesMock,
  parseIncludeDeleted: parseIncludeDeletedMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseJournalWritePayload: parseJournalWritePayloadMock,
  createJournalEntry: createJournalEntryMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

import { GET, POST } from "@/app/api/journal/route";

describe("api/journal route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    listOwnedJournalEntriesMock.mockReset();
    parseIncludeDeletedMock.mockReset();
    parseJournalWritePayloadMock.mockReset();
    createJournalEntryMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
  });

  it("lists owned journal entries with parsed includeDeleted option", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseIncludeDeletedMock.mockReturnValue(true);
    listOwnedJournalEntriesMock.mockResolvedValue([{ id: "entry-1", title: "Entry" }]);

    const request = new Request("http://localhost:3000/api/journal?includeDeleted=true", { method: "GET" });
    const response = await GET(request);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(parseIncludeDeletedMock).toHaveBeenCalledWith(new URL(request.url).searchParams);
    expect(listOwnedJournalEntriesMock).toHaveBeenCalledWith("user-1", { includeDeleted: true });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      journalEntries: [{ id: "entry-1", title: "Entry" }],
    });
  });

  it("creates a journal entry for authenticated user", async () => {
    const payload = {
      title: "Title",
      content: "Content",
      mood: null,
      tags: [],
      relatedGoalId: null,
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseJournalWritePayloadMock.mockResolvedValue(payload);
    createJournalEntryMock.mockResolvedValue({ id: "entry-1", ...payload });

    const request = new Request("http://localhost:3000/api/journal", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(parseJournalWritePayloadMock).toHaveBeenCalledWith(request);
    expect(createJournalEntryMock).toHaveBeenCalledWith("user-1", payload);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      journalEntry: { id: "entry-1", ...payload },
    });
  });

  it("delegates GET failures to shared error response", async () => {
    const failure = new Error("auth failed");
    const expected = Response.json({ error: "Unauthorized" }, { status: 401 });

    requireInstantUserMock.mockRejectedValue(failure);
    instantRouteErrorResponseMock.mockReturnValue(expected);

    const response = await GET(new Request("http://localhost:3000/api/journal", { method: "GET" }));

    expect(instantRouteErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response).toBe(expected);
  });
});
