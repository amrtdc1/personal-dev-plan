"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { buildHabitMetrics, type HabitMetricSnapshot } from "@/components/dashboard/habit-metrics";
import { CrudModal } from "@/components/ui/crud-modal";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { InfoPopover } from "@/components/ui/info-popover";
import { IconButton } from "@/components/ui/icon-button";
import { LoadingSection } from "@/components/ui/loading-section";
import { Archive, Check, Loader2, Pause, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Habit, HabitCadence, HabitCheckin } from "@/lib/domain/types";

type DailyCheckinSummary = {
  date: string;
  checkins: Array<{
    checkinId: string;
    habitId: string;
    habitTitle: string;
    cadence: HabitCadence;
    targetCount: number;
    notes: string | null;
  }>;
};

type HabitSortKey =
  | "adherence_desc"
  | "current_streak_desc"
  | "best_streak_desc"
  | "checkins_desc"
  | "title_asc"
  | "status_asc";

export function HabitsWorkspace() {
  const { user, isLoading, error } = db.useAuth();
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [habitCheckinsByHabitId, setHabitCheckinsByHabitId] = useState<Record<string, HabitCheckin[]>>({});
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [habitTitle, setHabitTitle] = useState("");
  const [habitCadence, setHabitCadence] = useState<HabitCadence>("daily");
  const [habitTargetCount, setHabitTargetCount] = useState("1");
  const [isSavingHabit, setIsSavingHabit] = useState(false);
  const [isCreateHabitModalOpen, setIsCreateHabitModalOpen] = useState(false);
  const [isSavingHabitCheckin, setIsSavingHabitCheckin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [activeActionHabitId, setActiveActionHabitId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkinModalHabitId, setCheckinModalHabitId] = useState<string | null>(null);
  const [checkinDateInput, setCheckinDateInput] = useState("");
  const [selectedDailyCheckinDate, setSelectedDailyCheckinDate] = useState<string | null>(null);
  const [habitSortKey, setHabitSortKey] = useState<HabitSortKey>("adherence_desc");

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadHabits() {
      setIsRefreshing(true);
      setLoadError(null);

      try {
        const loadedHabits = await dataRepository.listHabits(currentUser.id, { includeDeleted: true });
        const activeHabits = loadedHabits.filter((habit) => !habit.deletedAt && habit.status !== "archived");
        const checkinEntries = await Promise.all(
          activeHabits.map(async (habit) => {
            const checkins = await dataRepository.listHabitCheckins(currentUser.id, habit.id);
            return [habit.id, checkins] as const;
          }),
        );

        const checkinsByHabitId: Record<string, HabitCheckin[]> = {};
        for (const [habitId, checkins] of checkinEntries) {
          checkinsByHabitId[habitId] = checkins;
        }

        if (!cancelled) {
          setAllHabits(loadedHabits);
          setHabitCheckinsByHabitId(checkinsByHabitId);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setLoadError(getErrorMessage(caughtError, "We could not load habits."));
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadHabits();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, user]);

  const activeHabits = useMemo(
    () => allHabits.filter((habit) => !habit.deletedAt && habit.status !== "archived"),
    [allHabits],
  );

  const archivedHabits = useMemo(
    () => allHabits.filter((habit) => Boolean(habit.deletedAt) || habit.status === "archived"),
    [allHabits],
  );

  const effectiveSelectedHabitId = useMemo(() => {
    if (selectedHabitId && activeHabits.some((habit) => habit.id === selectedHabitId)) {
      return selectedHabitId;
    }

    return activeHabits[0]?.id ?? null;
  }, [activeHabits, selectedHabitId]);

  const habitMetricsByHabitId = useMemo(() => {
    const metrics: Record<string, HabitMetricSnapshot> = {};

    for (const habit of activeHabits) {
      metrics[habit.id] = buildHabitMetrics(habit, habitCheckinsByHabitId[habit.id] ?? []);
    }

    return metrics;
  }, [activeHabits, habitCheckinsByHabitId]);

  const selectedCheckinHabit = useMemo(
    () => (checkinModalHabitId ? activeHabits.find((habit) => habit.id === checkinModalHabitId) ?? null : null),
    [activeHabits, checkinModalHabitId],
  );

  const recentDailyCheckins = useMemo<DailyCheckinSummary[]>(() => {
    const habitById = new Map(activeHabits.map((habit) => [habit.id, habit]));
    const byDate = new Map<string, DailyCheckinSummary>();

    for (const [habitId, checkins] of Object.entries(habitCheckinsByHabitId)) {
      const habit = habitById.get(habitId);
      if (!habit) {
        continue;
      }

      for (const checkin of checkins) {
        const existing = byDate.get(checkin.checkInDate) ?? { date: checkin.checkInDate, checkins: [] };
        existing.checkins.push({
          checkinId: checkin.id,
          habitId,
          habitTitle: habit.title,
          cadence: habit.cadence,
          targetCount: habit.targetCount,
          notes: checkin.notes,
        });
        byDate.set(checkin.checkInDate, existing);
      }
    }

    return Array.from(byDate.values())
      .map((day) => ({
        ...day,
        checkins: day.checkins.sort((left, right) => left.habitTitle.localeCompare(right.habitTitle)),
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [activeHabits, habitCheckinsByHabitId]);

  const selectedDailyCheckinSummary = useMemo(
    () => recentDailyCheckins.find((summary) => summary.date === selectedDailyCheckinDate) ?? null,
    [recentDailyCheckins, selectedDailyCheckinDate],
  );

  const sortedActiveHabits = useMemo(() => {
    const sorted = [...activeHabits];
    sorted.sort((left, right) => {
      const leftMetrics = habitMetricsByHabitId[left.id] ?? defaultMetricSnapshot();
      const rightMetrics = habitMetricsByHabitId[right.id] ?? defaultMetricSnapshot();
      const leftCheckins = habitCheckinsByHabitId[left.id]?.length ?? 0;
      const rightCheckins = habitCheckinsByHabitId[right.id]?.length ?? 0;

      switch (habitSortKey) {
        case "adherence_desc":
          return compareDescending(leftMetrics.adherence28dPercent, rightMetrics.adherence28dPercent, left.title, right.title);
        case "current_streak_desc":
          return compareDescending(leftMetrics.currentStreak, rightMetrics.currentStreak, left.title, right.title);
        case "best_streak_desc":
          return compareDescending(leftMetrics.bestStreak, rightMetrics.bestStreak, left.title, right.title);
        case "checkins_desc":
          return compareDescending(leftCheckins, rightCheckins, left.title, right.title);
        case "status_asc":
          return left.status.localeCompare(right.status) || left.title.localeCompare(right.title);
        case "title_asc":
        default:
          return left.title.localeCompare(right.title);
      }
    });

    return sorted;
  }, [activeHabits, habitCheckinsByHabitId, habitMetricsByHabitId, habitSortKey]);

  if (isLoading || isRefreshing) {
    return (
      <LoadingSection title="Habits" message="Loading habits..." />
    );
  }

  if (error) {
    return (
      <ErrorBanner title="Habits" message={error.message} />
    );
  }

  if (!user) {
    return (
      <EmptyStateCard
        title="Habits"
        description="Sign in to track and check in habits."
      />
    );
  }

  const currentUser = user;

  async function handleHabitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSavingHabit(true);
    setSaveError(null);

    try {
      await dataRepository.saveHabit({
        ownerUid: currentUser.id,
        title: habitTitle,
        cadence: habitCadence,
        targetCount: Number(habitTargetCount),
      });

      setHabitTitle("");
      setHabitCadence("daily");
      setHabitTargetCount("1");
      setIsCreateHabitModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setSaveError(getErrorMessage(caughtError, "We could not save the habit."));
    } finally {
      setIsSavingHabit(false);
    }
  }

  async function handleHabitStatusToggle(habit: Habit) {
    const nextStatus = habit.status === "paused" ? "active" : "paused";
    setActiveActionHabitId(habit.id);
    setLifecycleError(null);

    try {
      await dataRepository.saveHabit({
        habitId: habit.id,
        ownerUid: currentUser.id,
        title: habit.title,
        cadence: habit.cadence,
        targetCount: habit.targetCount,
        status: nextStatus,
        existingHabit: habit,
      });

      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setLifecycleError(getErrorMessage(caughtError, "We could not update habit status."));
    } finally {
      setActiveActionHabitId(null);
    }
  }

  async function handleArchiveHabit(habit: Habit) {
    setActiveActionHabitId(habit.id);
    setLifecycleError(null);

    try {
      await dataRepository.softDeleteHabit(currentUser.id, habit.id);
      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setLifecycleError(getErrorMessage(caughtError, "We could not archive the habit."));
    } finally {
      setActiveActionHabitId(null);
    }
  }

  async function handleRestoreHabit(habit: Habit) {
    setActiveActionHabitId(habit.id);
    setLifecycleError(null);

    try {
      await dataRepository.restoreHabit(currentUser.id, habit.id);
      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setLifecycleError(getErrorMessage(caughtError, "We could not restore the habit."));
    } finally {
      setActiveActionHabitId(null);
    }
  }

  async function handlePermanentlyDeleteHabit(habit: Habit) {
    const shouldDelete = window.confirm(
      `Permanently delete "${habit.title}"? This action cannot be undone.`,
    );
    if (!shouldDelete) {
      return;
    }

    setActiveActionHabitId(habit.id);
    setLifecycleError(null);

    try {
      await dataRepository.permanentlyDeleteHabit(currentUser.id, habit.id);
      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setLifecycleError(getErrorMessage(caughtError, "We could not permanently delete the habit."));
    } finally {
      setActiveActionHabitId(null);
    }
  }

  async function handleHabitCheckin(habitId: string, checkInDate: string) {
    setIsSavingHabitCheckin(true);
    setCheckinError(null);

    try {
      await dataRepository.saveHabitCheckin({
        ownerUid: currentUser.id,
        habitId,
        checkInDate,
        notes: null,
      });

      setCheckinModalHabitId(null);
      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setCheckinError(getErrorMessage(caughtError, "We could not save the habit check-in."));
    } finally {
      setIsSavingHabitCheckin(false);
    }
  }

  function openCheckinModal(habitId: string) {
    setCheckinModalHabitId(habitId);
    setCheckinDateInput(new Date().toISOString().slice(0, 10));
  }

  function openCreateHabitModal() {
    setHabitTitle("");
    setHabitCadence("daily");
    setHabitTargetCount("1");
    setSaveError(null);
    setIsCreateHabitModalOpen(true);
  }

  function closeCreateHabitModal() {
    setIsCreateHabitModalOpen(false);
    setHabitTitle("");
    setHabitCadence("daily");
    setHabitTargetCount("1");
  }

  return (
    <WorkspaceShell
      title="Habits"
      sectionClassName="pdp-panel-mobile-flat pdp-mobile-surface"
      titleTrailing={
        <InfoPopover className="self-center sm:hidden" label="Habits help">
          Track routines with quick daily check-ins.
        </InfoPopover>
      }
      description="Track routines with quick daily check-ins."
      descriptionClassName="hidden sm:block"
      notices={
        <>
          {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}
          {saveError ? <p className="mt-2 text-sm text-red-700">{saveError}</p> : null}
          {checkinError ? <p className="mt-2 text-sm text-red-700">{checkinError}</p> : null}
          {lifecycleError ? <p className="mt-2 text-sm text-red-700">{lifecycleError}</p> : null}
        </>
      }
    >
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {activeHabits.length} active
          </span>
          <IconButton onClick={openCreateHabitModal} title="Create habit" variant="primary">
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="w-52 sm:w-auto">
          <select
            value={habitSortKey}
            onChange={(event) => setHabitSortKey(event.target.value as HabitSortKey)}
            className="w-full rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 sm:w-auto"
            aria-label="Sort habits"
          >
            <option value="adherence_desc">Sort: 4-week adherence</option>
            <option value="current_streak_desc">Sort: Current streak</option>
            <option value="best_streak_desc">Sort: Best streak</option>
            <option value="checkins_desc">Sort: Total check-ins</option>
            <option value="status_asc">Sort: Status</option>
            <option value="title_asc">Sort: Name</option>
          </select>
        </div>
      </div>

      <CrudModal
        isOpen={isCreateHabitModalOpen}
        title="Create habit"
        onClose={closeCreateHabitModal}
      >
        <form className="grid gap-3" onSubmit={handleHabitSubmit}>
          <label className="block text-sm text-slate-700">
            Habit title
            <input
              value={habitTitle}
              onChange={(event) => setHabitTitle(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Habit title"
              aria-label="Habit title"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Habit cadence
            <select
              value={habitCadence}
              onChange={(event) => setHabitCadence(event.target.value as HabitCadence)}
              className="pdp-control mt-1 rounded-xl"
              aria-label="Habit cadence"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Target count
            <input
              type="number"
              min={1}
              value={habitTargetCount}
              onChange={(event) => setHabitTargetCount(event.target.value)}
              className="pdp-control mt-1 rounded-xl"
              placeholder="Target count"
              aria-label="Habit target count"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <IconButton
              type="submit"
              variant="primary"
              disabled={isSavingHabit || habitTitle.trim().length === 0}
              title={isSavingHabit ? "Saving..." : "Create habit"}
            >
              {isSavingHabit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </IconButton>
            <IconButton onClick={closeCreateHabitModal} title="Cancel">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </form>
      </CrudModal>

      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="min-w-0 px-1 py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active habits</p>
          <div className="mt-2 max-h-[min(34rem,calc(100dvh-22rem))] overflow-y-auto pr-1">
            <ul className="space-y-2">
              {activeHabits.length === 0 ? (
                <li className="pdp-card-mobile-ghost rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                  No habits yet.
                </li>
              ) : (
                sortedActiveHabits.map((habit) => {
                  const isSelected = effectiveSelectedHabitId === habit.id;
                  const checkinCount = habitCheckinsByHabitId[habit.id]?.length ?? 0;
                  const metrics = habitMetricsByHabitId[habit.id] ?? {
                    currentStreak: 0,
                    bestStreak: 0,
                    adherence28dPercent: 0,
                    trend: "flat" as const,
                  };
                  const activityCells = buildRecentActivityCells(habit, habitCheckinsByHabitId[habit.id] ?? []);
                  const streakFill = Math.max(6, Math.min(100, Math.round((metrics.currentStreak / Math.max(1, metrics.bestStreak || 1)) * 100)));

                  return (
                    <li key={habit.id} className="pdp-card-mobile-ghost min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedHabitId(habit.id)}
                        className="w-full min-w-0 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium ${isSelected ? "text-slate-900" : "text-slate-700"}`}>{habit.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${trendBadgeClass(metrics.trend)}`}>
                            {metrics.trend}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {habit.cadence === "daily" ? "Daily" : "Weekly"} | Target {habit.targetCount} | {checkinCount} check-ins | {habit.status}
                        </p>

                        <div className="mt-2 grid min-w-0 gap-2 md:grid-cols-3">
                          <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">4-week adherence</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{metrics.adherence28dPercent}%</p>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.max(4, metrics.adherence28dPercent)}%` }}
                              />
                            </div>
                          </div>

                          <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Streak</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{metrics.currentStreak} / {metrics.bestStreak}</p>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                              <div
                                className="h-1.5 rounded-full bg-sky-500 transition-all"
                                style={{ width: `${streakFill}%` }}
                              />
                            </div>
                          </div>

                          <div className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recent activity</p>
                            <div className="mt-1 grid grid-cols-7 gap-1">
                              {activityCells.map((isActive, index) => (
                                <span
                                  key={`${habit.id}-activity-${index}`}
                                  className={`h-2.5 rounded-sm ${isActive ? "bg-indigo-500" : "bg-slate-200"}`}
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <IconButton
                          onClick={() => openCheckinModal(habit.id)}
                          disabled={isSavingHabitCheckin || habit.status === "paused"}
                          title={habit.status === "paused" ? "Habit is paused" : "Check in today"}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          onClick={() => void handleHabitStatusToggle(habit)}
                          disabled={activeActionHabitId === habit.id}
                          title={habit.status === "paused" ? "Resume habit" : "Pause habit"}
                        >
                          {habit.status === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                        </IconButton>
                        <IconButton
                          onClick={() => void handleArchiveHabit(habit)}
                          disabled={activeActionHabitId === habit.id}
                          title="Archive habit"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>

        <div className="min-w-0 px-1 py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent check-in days</p>
          <div className="mt-2 max-h-[min(34rem,calc(100dvh-22rem))] overflow-y-auto pr-1">
            {recentDailyCheckins.length === 0 ? (
              <p className="text-xs text-slate-500">No check-ins yet.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700">
                {recentDailyCheckins.slice(0, 12).map((daily) => (
                  <li key={daily.date}>
                    <button
                      type="button"
                      onClick={() => setSelectedDailyCheckinDate(daily.date)}
                      className="pdp-card-mobile-ghost w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{daily.date}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                          {daily.checkins.length} check-ins
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {daily.checkins.slice(0, 3).map((entry) => entry.habitTitle).join(" | ")}
                        {daily.checkins.length > 3 ? " ..." : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {archivedHabits.length > 0 ? (
        <div className="mt-4 pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Archived habits</p>
          <div className="mt-2 max-h-64 overflow-y-auto pr-1">
            <ul className="space-y-2">
              {archivedHabits.map((habit) => (
                <li key={habit.id} className="pdp-card-mobile-ghost rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{habit.title}</p>
                      <p className="text-xs text-slate-500">Archived {habit.deletedAt ? habit.deletedAt.slice(0, 10) : ""}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <IconButton
                        onClick={() => void handleRestoreHabit(habit)}
                        disabled={activeActionHabitId === habit.id}
                        title="Restore habit"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        onClick={() => void handlePermanentlyDeleteHabit(habit)}
                        disabled={activeActionHabitId === habit.id}
                        title="Delete forever"
                        variant="danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <CrudModal
        isOpen={selectedCheckinHabit !== null}
        title={selectedCheckinHabit ? `Check in: ${selectedCheckinHabit.title}` : "Check in"}
        onClose={() => setCheckinModalHabitId(null)}
      >
        {selectedCheckinHabit ? (
          <div className="grid gap-3">
            <p className="text-sm text-slate-600">Confirm today or backfill a missed day.</p>
            <label className="text-sm text-slate-700">
              Check-in date
              <input
                type="date"
                value={checkinDateInput}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setCheckinDateInput(event.currentTarget.value)}
                className="pdp-control mt-1 rounded-lg"
              />
            </label>

            <div className="flex justify-end gap-2">
              <IconButton onClick={() => setCheckinModalHabitId(null)} title="Cancel">
                <X className="h-4 w-4" />
              </IconButton>
              <IconButton
                onClick={() => void handleHabitCheckin(selectedCheckinHabit.id, checkinDateInput)}
                disabled={isSavingHabitCheckin || checkinDateInput.length === 0}
                title="Confirm check-in"
                variant="success"
              >
                {isSavingHabitCheckin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </IconButton>
            </div>
          </div>
        ) : null}
      </CrudModal>

      <CrudModal
        isOpen={selectedDailyCheckinSummary !== null}
        title={selectedDailyCheckinSummary ? `Check-ins on ${selectedDailyCheckinSummary.date}` : "Daily Check-ins"}
        onClose={() => setSelectedDailyCheckinDate(null)}
      >
        {selectedDailyCheckinSummary ? (
          <div className="grid gap-3">
            <p className="text-sm text-slate-600">
              {selectedDailyCheckinSummary.checkins.length} habit check-in{selectedDailyCheckinSummary.checkins.length === 1 ? "" : "s"} recorded.
            </p>
            <ul className="space-y-2">
              {selectedDailyCheckinSummary.checkins.map((checkin) => (
                <li key={checkin.checkinId} className="pdp-card-mobile-ghost rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{checkin.habitTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {checkin.cadence === "daily" ? "Daily" : "Weekly"} target {checkin.targetCount}
                  </p>
                  {checkin.notes ? <p className="mt-1 text-xs text-slate-600">Notes: {checkin.notes}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CrudModal>
    </WorkspaceShell>
  );
}

function compareDescending(left: number, right: number, leftTitle: string, rightTitle: string) {
  if (right !== left) {
    return right - left;
  }

  return leftTitle.localeCompare(rightTitle);
}

function defaultMetricSnapshot(): HabitMetricSnapshot {
  return {
    currentStreak: 0,
    bestStreak: 0,
    adherence28dPercent: 0,
    trend: "flat",
  };
}

function trendBadgeClass(trend: HabitMetricSnapshot["trend"]) {
  if (trend === "up") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (trend === "down") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-slate-100 text-slate-700";
}

function buildRecentActivityCells(habit: Habit, checkins: HabitCheckin[]) {
  const isoDates = new Set(checkins.map((checkin) => checkin.checkInDate));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (habit.cadence === "weekly") {
    const cells: boolean[] = [];
    for (let index = 5; index >= 0; index -= 1) {
      const weekStart = new Date(today);
      const day = weekStart.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diffToMonday - index * 7);

      let count = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + offset);
        const iso = toIsoDate(dayDate);
        if (isoDates.has(iso)) {
          count += 1;
        }
      }

      cells.push(count >= Math.max(1, habit.targetCount));
    }

    while (cells.length < 7) {
      cells.unshift(false);
    }

    return cells;
  }

  const cells: boolean[] = [];
  for (let index = 6; index >= 0; index -= 1) {
    const cursor = new Date(today);
    cursor.setDate(today.getDate() - index);
    cells.push(isoDates.has(toIsoDate(cursor)));
  }

  return cells;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
