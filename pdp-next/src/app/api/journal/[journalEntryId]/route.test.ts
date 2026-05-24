const {
  requireInstantUserMock,
  findOwnedJournalEntryMock,
  requireRouteParamMock,
  instantRouteErrorResponseMock,
  parseJournalWritePayloadMock,
  updateJournalEntryMock,
  permanentlyDeleteJournalEntryMock,
} = vi.hoisted(() => ({
  requireInstantUserMock: vi.fn(),
  findOwnedJournalEntryMock: vi.fn(),
  requireRouteParamMock: vi.fn(),
  instantRouteErrorResponseMock: vi.fn(),
  parseJournalWritePayloadMock: vi.fn(),
  updateJournalEntryMock: vi.fn(),
  permanentlyDeleteJournalEntryMock: vi.fn(),
}));

vi.mock("@/lib/server/instant-auth", () => ({
  requireInstantUser: requireInstantUserMock,
}));

vi.mock("@/lib/server/instant-route", () => ({
  findOwnedJournalEntry: findOwnedJournalEntryMock,
  requireRouteParam: requireRouteParamMock,
  instantRouteErrorResponse: instantRouteErrorResponseMock,
}));

vi.mock("@/lib/server/instant-write", () => ({
  parseJournalWritePayload: parseJournalWritePayloadMock,
  updateJournalEntry: updateJournalEntryMock,
}));

vi.mock("@/lib/server/instant-lifecycle", () => ({
  permanentlyDeleteJournalEntry: permanentlyDeleteJournalEntryMock,
}));

import { DELETE, GET, PATCH } from "@/app/api/journal/[journalEntryId]/route";

describe("api/journal/[journalEntryId] route", () => {
  beforeEach(() => {
    requireInstantUserMock.mockReset();
    findOwnedJournalEntryMock.mockReset();
    requireRouteParamMock.mockReset();
    instantRouteErrorResponseMock.mockReset();
    parseJournalWritePayloadMock.mockReset();
    updateJournalEntryMock.mockReset();
    permanentlyDeleteJournalEntryMock.mockReset();
  });

  it("returns owned journal entry on GET", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    findOwnedJournalEntryMock.mockResolvedValue({ id: "entry-1", title: "Entry" });

    const request = new Request("http://localhost:3000/api/journal/entry-1", { method: "GET" });
    const context = { params: Promise.resolve({ journalEntryId: "entry-1" }) };
    const response = await GET(request, context);

    expect(requireInstantUserMock).toHaveBeenCalledWith(request);
    expect(requireRouteParamMock).toHaveBeenCalledWith("entry-1", "Journal entry id");
    expect(findOwnedJournalEntryMock).toHaveBeenCalledWith("user-1", "entry-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      journalEntry: { id: "entry-1", title: "Entry" },
    });
  });

  it("updates owned journal entry on PATCH", async () => {
    const payload = {
      title: "Updated title",
      content: "Updated content",
      mood: null,
      tags: [],
      relatedGoalId: null,
    };

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseJournalWritePayloadMock.mockResolvedValue(payload);
    updateJournalEntryMock.mockResolvedValue({ id: "entry-1", ...payload });

    const request = new Request("http://localhost:3000/api/journal/entry-1", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const context = { params: Promise.resolve({ journalEntryId: "entry-1" }) };
    const response = await PATCH(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("entry-1", "Journal entry id");
    expect(parseJournalWritePayloadMock).toHaveBeenCalledWith(request);
    expect(updateJournalEntryMock).toHaveBeenCalledWith("user-1", "entry-1", payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      journalEntry: { id: "entry-1", ...payload },
    });
  });

  it("permanently deletes archived journal entry on DELETE", async () => {
    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    permanentlyDeleteJournalEntryMock.mockResolvedValue({ deletedJournalEntryId: "entry-1" });

    const request = new Request("http://localhost:3000/api/journal/entry-1", { method: "DELETE" });
    const context = { params: Promise.resolve({ journalEntryId: "entry-1" }) };
    const response = await DELETE(request, context);

    expect(requireRouteParamMock).toHaveBeenCalledWith("entry-1", "Journal entry id");
    expect(permanentlyDeleteJournalEntryMock).toHaveBeenCalledWith("user-1", "entry-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedJournalEntryId: "entry-1",
    });
  });

  it("delegates PATCH failures to shared error response", async () => {
    const failure = new Error("bad request");
    const expected = Response.json({ error: "Invalid payload" }, { status: 400 });

    requireInstantUserMock.mockResolvedValue({ id: "user-1" });
    parseJournalWritePayloadMock.mockRejectedValue(failure);
    instantRouteErrorResponseMock.mockReturnValue(expected);

    const request = new Request("http://localhost:3000/api/journal/entry-1", { method: "PATCH" });
    const context = { params: Promise.resolve({ journalEntryId: "entry-1" }) };
    const response = await PATCH(request, context);

    expect(instantRouteErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response).toBe(expected);
  });
});
