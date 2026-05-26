"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { buildHabitMetrics, type HabitMetricSnapshot } from "@/components/dashboard/habit-metrics";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";
import type { Habit, HabitCadence, HabitCheckin } from "@/lib/domain/types";

export function HabitsWorkspace() {
  const { user, isLoading, error } = db.useAuth();
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [habitCheckinsByHabitId, setHabitCheckinsByHabitId] = useState<Record<string, HabitCheckin[]>>({});
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [habitTitle, setHabitTitle] = useState("");
  const [habitCadence, setHabitCadence] = useState<HabitCadence>("daily");
  const [habitTargetCount, setHabitTargetCount] = useState("1");
  const [isSavingHabit, setIsSavingHabit] = useState(false);
  const [isSavingHabitCheckin, setIsSavingHabitCheckin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [activeActionHabitId, setActiveActionHabitId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const selectedHabitCheckins = useMemo(
    () => (effectiveSelectedHabitId ? habitCheckinsByHabitId[effectiveSelectedHabitId] ?? [] : []),
    [effectiveSelectedHabitId, habitCheckinsByHabitId],
  );

  const habitMetricsByHabitId = useMemo(() => {
    const metrics: Record<string, HabitMetricSnapshot> = {};

    for (const habit of activeHabits) {
      metrics[habit.id] = buildHabitMetrics(habit, habitCheckinsByHabitId[habit.id] ?? []);
    }

    return metrics;
  }, [activeHabits, habitCheckinsByHabitId]);

  if (isLoading || isRefreshing) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Habits</h2>
        <p className="mt-3 text-sm text-slate-700">Loading habits...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pdp-panel rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Habits</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Habits</h2>
        <p className="mt-3 text-sm text-slate-700">Sign in to track and check in habits.</p>
      </section>
    );
  }

  async function handleHabitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSavingHabit(true);
    setSaveError(null);

    try {
      await dataRepository.saveHabit({
        ownerUid: user.id,
        title: habitTitle,
        cadence: habitCadence,
        targetCount: Number(habitTargetCount),
      });

      setHabitTitle("");
      setHabitCadence("daily");
      setHabitTargetCount("1");
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
        ownerUid: user.id,
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
      await dataRepository.softDeleteHabit(user.id, habit.id);
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
      await dataRepository.restoreHabit(user.id, habit.id);
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
      await dataRepository.permanentlyDeleteHabit(user.id, habit.id);
      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setLifecycleError(getErrorMessage(caughtError, "We could not permanently delete the habit."));
    } finally {
      setActiveActionHabitId(null);
    }
  }

  async function handleHabitCheckin(habitId: string) {
    setIsSavingHabitCheckin(true);
    setCheckinError(null);

    try {
      await dataRepository.saveHabitCheckin({
        ownerUid: user.id,
        habitId,
        checkInDate: new Date().toISOString().slice(0, 10),
        notes: null,
      });

      setRefreshKey((value) => value + 1);
    } catch (caughtError) {
      setCheckinError(getErrorMessage(caughtError, "We could not save the habit check-in."));
    } finally {
      setIsSavingHabitCheckin(false);
    }
  }

  return (
    <WorkspaceShell
      title="Habits"
      description="Track recurring routines and keep your streaks alive with fast daily check-ins."
      notices={
        <>
          {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}
          {saveError ? <p className="mt-2 text-sm text-red-700">{saveError}</p> : null}
          {checkinError ? <p className="mt-2 text-sm text-red-700">{checkinError}</p> : null}
          {lifecycleError ? <p className="mt-2 text-sm text-red-700">{lifecycleError}</p> : null}
        </>
      }
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Habit Tracker</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {activeHabits.length} active
        </span>
      </div>

      <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={handleHabitSubmit}>
        <input
          value={habitTitle}
          onChange={(event) => setHabitTitle(event.target.value)}
          className="pdp-control rounded-xl"
          placeholder="Habit title"
          aria-label="Habit title"
        />
        <select
          value={habitCadence}
          onChange={(event) => setHabitCadence(event.target.value as HabitCadence)}
          className="pdp-control rounded-xl"
          aria-label="Habit cadence"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <input
          type="number"
          min={1}
          value={habitTargetCount}
          onChange={(event) => setHabitTargetCount(event.target.value)}
          className="pdp-control rounded-xl"
          placeholder="Target count"
          aria-label="Habit target count"
        />
        <button
          type="submit"
          disabled={isSavingHabit}
          className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSavingHabit ? "Saving..." : "Create habit"}
        </button>
      </form>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ul className="space-y-2">
          {activeHabits.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
              No habits yet.
            </li>
          ) : (
            activeHabits.map((habit) => {
              const isSelected = effectiveSelectedHabitId === habit.id;
              const checkinCount = habitCheckinsByHabitId[habit.id]?.length ?? 0;
              const metrics = habitMetricsByHabitId[habit.id] ?? {
                currentStreak: 0,
                bestStreak: 0,
                adherence28dPercent: 0,
                trend: "flat" as const,
              };
              return (
                <li key={habit.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedHabitId(habit.id)}
                    className="w-full text-left"
                  >
                    <p className={`font-medium ${isSelected ? "text-slate-900" : "text-slate-700"}`}>{habit.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {habit.cadence === "daily" ? "Daily" : "Weekly"} | Target {habit.targetCount} | {checkinCount} check-ins | {habit.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Streak {metrics.currentStreak} | Best {metrics.bestStreak} | 4-week {metrics.adherence28dPercent}% | Trend {metrics.trend}
                    </p>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleHabitCheckin(habit.id)}
                      disabled={isSavingHabitCheckin || habit.status === "paused"}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {habit.status === "paused" ? "Paused" : "Check in today"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleHabitStatusToggle(habit)}
                      disabled={activeActionHabitId === habit.id}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {habit.status === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleArchiveHabit(habit)}
                      disabled={activeActionHabitId === habit.id}
                      className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent check-ins</p>
          {effectiveSelectedHabitId ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {selectedHabitCheckins.length === 0 ? (
                <li className="text-xs text-slate-500">No check-ins yet.</li>
              ) : (
                selectedHabitCheckins.slice(0, 10).map((checkin) => (
                  <li key={checkin.id} className="rounded-md bg-slate-50 px-2 py-1">
                    <span className="font-medium">{checkin.checkInDate}</span>
                    {checkin.notes ? <span className="text-slate-500"> - {checkin.notes}</span> : null}
                  </li>
                ))
              )}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Select a habit to view check-ins.</p>
          )}
        </div>
      </div>

      {archivedHabits.length > 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Archived habits</p>
          <ul className="mt-2 space-y-2">
            {archivedHabits.map((habit) => (
              <li key={habit.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{habit.title}</p>
                    <p className="text-xs text-slate-500">Archived {habit.deletedAt ? habit.deletedAt.slice(0, 10) : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRestoreHabit(habit)}
                      disabled={activeActionHabitId === habit.id}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePermanentlyDeleteHabit(habit)}
                      disabled={activeActionHabitId === habit.id}
                      className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
