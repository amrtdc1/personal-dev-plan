"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import { renderStrictMarkdownToHtml } from "@/lib/journal/markdown";
import type { Goal, JournalEntry } from "@/lib/domain/types";
import { CrudModal } from "@/components/ui/crud-modal";
import { InfoPopover } from "@/components/ui/info-popover";

const MOOD_OPTIONS = ["great", "good", "okay", "low", "stressed"] as const;
const JOURNAL_PAGE_SIZE = 6;

export function JournalWorkspace() {
  const { isLoading, user, error } = db.useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [relatedGoalId, setRelatedGoalId] = useState("");

  const [moodFilter, setMoodFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const syncFilterPanel = () => {
      setIsFilterPanelOpen(!mobileQuery.matches);
    };

    syncFilterPanel();

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncFilterPanel);
    } else {
      mobileQuery.addListener(syncFilterPanel);
    }

    return () => {
      if (typeof mobileQuery.removeEventListener === "function") {
        mobileQuery.removeEventListener("change", syncFilterPanel);
      } else {
        mobileQuery.removeListener(syncFilterPanel);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadData() {
      setIsRefreshing(true);
      setLoadError(null);

      try {
        const [professionalGoals, personalGoals, journalEntries] = await Promise.all([
          dataRepository.listGoals(currentUser.id, "professional", { includeDeleted: true }),
          dataRepository.listGoals(currentUser.id, "personal", { includeDeleted: true }),
          dataRepository.listJournalEntries(currentUser.id, { includeDeleted: true }),
        ]);

        if (!cancelled) {
          setGoals([...professionalGoals, ...personalGoals].filter((goal) => !goal.deletedAt));
          setEntries(journalEntries);
        }
      } catch (repositoryError) {
        if (!cancelled) {
          setLoadError(getErrorMessage(repositoryError, "We could not load journal entries."));
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const goalMap = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);

  const filteredEntries = useMemo(() => {
    const normalizedTagFilter = tagFilter.trim().toLowerCase();

    return entries
      .filter((entry) => (includeArchived ? true : !entry.deletedAt))
      .filter((entry) => (moodFilter === "all" ? true : (entry.mood ?? "") === moodFilter))
      .filter((entry) => (goalFilter === "all" ? true : (entry.relatedGoalId ?? "") === goalFilter))
      .filter((entry) => {
        if (!normalizedTagFilter) {
          return true;
        }

        return entry.tags.some((tag) => tag.toLowerCase().includes(normalizedTagFilter));
      });
  }, [entries, includeArchived, moodFilter, goalFilter, tagFilter]);

  const editingEntry = entries.find((entry) => entry.id === editingEntryId) ?? null;

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / JOURNAL_PAGE_SIZE));
  const effectiveCurrentPage = Math.min(currentPage, totalPages);
  const pagedEntries = useMemo(() => {
    const start = (effectiveCurrentPage - 1) * JOURNAL_PAGE_SIZE;
    return filteredEntries.slice(start, start + JOURNAL_PAGE_SIZE);
  }, [effectiveCurrentPage, filteredEntries]);

  if (isLoading || isRefreshing) {
    return (
      <section className="pdp-panel">
        <h2 className="pdp-section-title text-slate-900">Journal</h2>
        <p className="mt-3 text-sm text-slate-700">Loading journal entries...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pdp-panel rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Journal</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pdp-panel">
        <h2 className="pdp-section-title text-slate-900">Journal</h2>
        <p className="mt-3 text-sm text-slate-700">Sign in to create and manage journal entries.</p>
      </section>
    );
  }

  const currentUser = user;

  async function refreshData() {
    const [professionalGoals, personalGoals, journalEntries] = await Promise.all([
      dataRepository.listGoals(currentUser.id, "professional", { includeDeleted: true }),
      dataRepository.listGoals(currentUser.id, "personal", { includeDeleted: true }),
      dataRepository.listJournalEntries(currentUser.id, { includeDeleted: true }),
    ]);

    setGoals([...professionalGoals, ...personalGoals].filter((goal) => !goal.deletedAt));
    setEntries(journalEntries);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setActionError(null);
    setIsSaving(true);

    try {
      await dataRepository.saveJournalEntry({
        journalEntryId: editingEntry?.id,
        ownerUid: currentUser.id,
        title,
        content,
        mood: mood || null,
        tags: parseTagsInput(tagsInput),
        relatedGoalId: relatedGoalId || null,
        existingJournalEntry: editingEntry ?? undefined,
      });

      resetForm();
      setIsEntryModalOpen(false);
      await refreshData();
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not save the journal entry."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveToggle(entry: JournalEntry) {
    setActionError(null);

    try {
      if (entry.deletedAt) {
        await dataRepository.restoreJournalEntry(currentUser.id, entry.id);
      } else {
        await dataRepository.softDeleteJournalEntry(currentUser.id, entry.id);
      }

      if (!entry.deletedAt && editingEntryId === entry.id) {
        resetForm();
      }

      await refreshData();
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not update archive state."));
    }
  }

  async function handlePermanentDelete(entry: JournalEntry) {
    if (!entry.deletedAt) {
      return;
    }

    const shouldDelete = window.confirm(
      `Permanently delete "${entry.title}"? This cannot be undone.`,
    );

    if (!shouldDelete) {
      return;
    }

    setActionError(null);

    try {
      await dataRepository.permanentlyDeleteJournalEntry(currentUser.id, entry.id);

      if (editingEntryId === entry.id) {
        resetForm();
      }

      await refreshData();
    } catch (repositoryError) {
      setActionError(getErrorMessage(repositoryError, "We could not permanently delete the journal entry."));
    }
  }

  function handleEdit(entry: JournalEntry) {
    setEditingEntryId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setMood(entry.mood ?? "");
    setTagsInput(entry.tags.join(", "));
    setRelatedGoalId(entry.relatedGoalId ?? "");
    setActionError(null);
    setIsEntryModalOpen(true);
  }

  function openCreateEntryModal() {
    resetForm();
    setActionError(null);
    setIsEntryModalOpen(true);
  }

  function closeEntryModal() {
    setIsEntryModalOpen(false);
    resetForm();
  }

  function resetForm() {
    setEditingEntryId(null);
    setTitle("");
    setContent("");
    setMood("");
    setTagsInput("");
    setRelatedGoalId("");
  }

  return (
    <section className="pdp-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="pdp-section-title text-slate-900">Journal</h2>
          <InfoPopover className="self-center sm:hidden" label="Journal help">
            Create, edit, archive, and filter journal entries with strict markdown rendering.
          </InfoPopover>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateEntryModal}
            className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            + Entry
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Entries: {filteredEntries.length}
          </span>
        </div>
      </div>

      <p className="mt-2 hidden text-sm text-slate-600 sm:block">
        Create, edit, archive, and filter journal entries with strict markdown rendering.
      </p>

      {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}
      {actionError ? <p className="mt-3 text-sm text-red-700">{actionError}</p> : null}

      <CrudModal
        isOpen={isEntryModalOpen}
        title={editingEntry ? "Edit journal entry" : "New journal entry"}
        onClose={closeEntryModal}
      >
        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="journal-title">
            Title
          </label>
          <input
            id="journal-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly reflection"
            className="pdp-control rounded-lg"
            required
          />

          <label className="text-sm font-medium text-slate-700" htmlFor="journal-content">
            Content (Markdown)
          </label>
          <textarea
            id="journal-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            placeholder="# What worked this week?"
            className="pdp-control rounded-lg"
          />

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="journal-mood">
                Mood
              </label>
              <select
                id="journal-mood"
                value={mood}
                onChange={(event) => setMood(event.target.value)}
                className="pdp-control mt-1"
              >
                <option value="">No mood</option>
                {MOOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {capitalize(option)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="journal-goal">
                Related Goal
              </label>
              <select
                id="journal-goal"
                value={relatedGoalId}
                onChange={(event) => setRelatedGoalId(event.target.value)}
                className="pdp-control mt-1"
              >
                <option value="">No goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="journal-tags">
                Tags (comma-separated)
              </label>
              <input
                id="journal-tags"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="focus, planning, wins"
                className="pdp-control mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="pdp-btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingEntry ? "Update Entry" : "Save Entry"}
            </button>
            <button
              type="button"
              onClick={closeEntryModal}
              className="pdp-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </CrudModal>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">JOURNAL FILTERS</p>
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen((current) => !current)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            aria-expanded={isFilterPanelOpen}
          >
            {isFilterPanelOpen ? "Hide filters" : "Show filters"}
          </button>
        </div>

        {isFilterPanelOpen ? (
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="text-sm font-medium text-slate-700" htmlFor="journal-filter-mood">
              Mood Filter
              <select
                id="journal-filter-mood"
                value={moodFilter}
                onChange={(event) => {
                  setMoodFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="pdp-control mt-1"
              >
                <option value="all">All moods</option>
                {MOOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {capitalize(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700" htmlFor="journal-filter-goal">
              Goal Filter
              <select
                id="journal-filter-goal"
                value={goalFilter}
                onChange={(event) => {
                  setGoalFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="pdp-control mt-1"
              >
                <option value="all">All goals</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700" htmlFor="journal-filter-tag">
              Tag Filter
              <input
                id="journal-filter-tag"
                value={tagFilter}
                onChange={(event) => {
                  setTagFilter(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search tag"
                className="pdp-control mt-1"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:pt-7">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => {
                  setIncludeArchived(event.target.checked);
                  setCurrentPage(1);
                }}
              />
              Include archived
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredEntries.length === 0 ? (
          <p className="text-sm text-slate-600">No journal entries match these filters.</p>
        ) : (
          pagedEntries.map((entry) => (
            <article
              key={entry.id}
              className={`pdp-card rounded-xl border p-4 ${entry.deletedAt ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{entry.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Updated {formatDateTime(entry.updatedAt)}
                    {entry.mood ? ` | Mood: ${capitalize(entry.mood)}` : ""}
                    {entry.relatedGoalId ? ` | Goal: ${goalMap.get(entry.relatedGoalId)?.title ?? "Unknown"}` : ""}
                    {entry.deletedAt ? " | Archived" : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!entry.deletedAt ? (
                    <button
                      type="button"
                      onClick={() => handleEdit(entry)}
                      className="pdp-btn-secondary rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleArchiveToggle(entry)}
                    className="pdp-btn-secondary rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    {entry.deletedAt ? "Restore" : "Archive"}
                  </button>
                  {entry.deletedAt ? (
                    <button
                      type="button"
                      onClick={() => void handlePermanentDelete(entry)}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100"
                    >
                      Delete permanently
                    </button>
                  ) : null}
                </div>
              </div>

              {entry.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <span
                      key={`${entry.id}-${tag}`}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div
                className="journal-markdown pdp-panel-muted mt-3 rounded-lg text-sm text-slate-800"
                dangerouslySetInnerHTML={{ __html: renderStrictMarkdownToHtml(entry.content) }}
              />
            </article>
          ))
        )}
      </div>

      {filteredEntries.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            Page {effectiveCurrentPage} of {totalPages} ({filteredEntries.length} total entries)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={effectiveCurrentPage <= 1}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={effectiveCurrentPage >= totalPages}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function parseTagsInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function capitalize(value: string) {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatDateTime(isoDateTime: string) {
  const parsed = new Date(isoDateTime);
  if (Number.isNaN(parsed.getTime())) {
    return isoDateTime;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}