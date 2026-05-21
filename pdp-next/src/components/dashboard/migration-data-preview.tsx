"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Goal, UserProfile } from "@/lib/domain/types";
import { dataRepository } from "@/lib/data/repository";
import { db } from "@/lib/instantdb/client";

type RepositorySnapshot = {
  profile: UserProfile | null;
  professionalGoals: Goal[];
  personalGoals: Goal[];
  sampleGoalId: string | null;
  sampleSubgoals: { id: string; title: string }[];
  sampleTasks: { id: string; title: string }[];
};

export function MigrationDataPreview() {
  const { isLoading, user, error } = db.useAuth();
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalType, setGoalType] = useState<"professional" | "personal">("professional");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalStartDate, setGoalStartDate] = useState("");
  const [goalEndDate, setGoalEndDate] = useState("");
  const [goalTimeframeLabel, setGoalTimeframeLabel] = useState("");
  const [goalIsFocus, setGoalIsFocus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const allGoals = useMemo(
    () => [
      ...(snapshot?.professionalGoals ?? []),
      ...(snapshot?.personalGoals ?? []),
    ],
    [snapshot],
  );
  const editingGoal = allGoals.find((goal) => goal.id === editingGoalId) ?? null;

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;
    let isCancelled = false;

    async function loadSnapshot() {
      setIsRefreshing(true);
      setLoadError(null);

      try {
        const [profile, professionalGoals, personalGoals] = await Promise.all([
          dataRepository.getUserProfile(currentUser.id),
          dataRepository.listGoals(currentUser.id, "professional"),
          dataRepository.listGoals(currentUser.id, "personal"),
        ]);

        const sampleGoal = professionalGoals[0] ?? personalGoals[0] ?? null;
        const sampleSubgoals = sampleGoal
          ? await dataRepository.listSubgoals(currentUser.id, sampleGoal.id)
          : [];
        const sampleTasks = sampleSubgoals[0]
          ? await dataRepository.listTasks(currentUser.id, sampleSubgoals[0].id)
          : [];

        if (!isCancelled) {
          setSnapshot({
            profile,
            professionalGoals,
            personalGoals,
            sampleGoalId: sampleGoal?.id ?? null,
            sampleSubgoals: sampleSubgoals.map((subgoal) => ({
              id: subgoal.id,
              title: subgoal.title,
            })),
            sampleTasks: sampleTasks.map((task) => ({
              id: task.id,
              title: task.title,
            })),
          });
        }
      } catch (repositoryError) {
        if (!isCancelled) {
          setLoadError(getErrorMessage(repositoryError, "We could not load the migration preview."));
        }
      } finally {
        if (!isCancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [refreshKey, user]);

  if (isLoading || error || !user) {
    return null;
  }

  async function handleGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    const currentUser = user;
    setIsSaving(true);
    setSaveError(null);

    try {
      await dataRepository.saveGoal({
        goalId: editingGoal?.id,
        ownerUid: currentUser.id,
        type: goalType,
        title: goalTitle,
        description: goalDescription,
        projectedStartDate: goalStartDate || null,
        projectedEndDate: goalEndDate || null,
        timeframeLabel: goalTimeframeLabel,
        isFocus: goalIsFocus,
        existingGoal: editingGoal ?? undefined,
      });

      resetGoalForm();
      setRefreshKey((value) => value + 1);
    } catch (repositoryError) {
      setSaveError(getErrorMessage(repositoryError, "We could not save the goal."));
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(goal: Goal) {
    setGoalType(goal.type);
    setGoalTitle(goal.title);
    setGoalDescription(goal.description);
    setGoalStartDate(goal.projectedStartDate ?? "");
    setGoalEndDate(goal.projectedEndDate ?? "");
    setGoalTimeframeLabel(goal.timeframe === "Ongoing" ? "" : goal.timeframe);
    setGoalIsFocus(goal.isFocus);
    setSaveError(null);
    setEditingGoalId(goal.id);
  }

  function resetGoalForm() {
    setEditingGoalId(null);
    setGoalType("professional");
    setGoalTitle("");
    setGoalDescription("");
    setGoalStartDate("");
    setGoalEndDate("");
    setGoalTimeframeLabel("");
    setGoalIsFocus(false);
    setSaveError(null);
  }

  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Repository-backed preview</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            This panel reads through the shared repository contract instead of hitting InstantDB
            directly from the UI. It is the first parity slice for the migrated data layer.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
          {isRefreshing ? "Refreshing" : "Loaded"}
        </span>
      </div>

      {loadError ? <p className="mt-4 text-sm text-red-700">{loadError}</p> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Profile" value={snapshot?.profile ? "Ready" : "Missing"} />
        <MetricCard label="Professional goals" value={String(snapshot?.professionalGoals.length ?? 0)} />
        <MetricCard label="Personal goals" value={String(snapshot?.personalGoals.length ?? 0)} />
        <MetricCard label="Sample subgoals" value={String(snapshot?.sampleSubgoals.length ?? 0)} />
        <MetricCard label="Sample tasks" value={String(snapshot?.sampleTasks.length ?? 0)} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Goal write path</h3>
              <p className="mt-1 text-sm text-slate-600">
                This form writes through the repository contract and then reloads the repository-backed preview.
              </p>
            </div>
            {editingGoal ? (
              <button
                type="button"
                onClick={resetGoalForm}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-white"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleGoalSubmit}>
            <label className="block text-sm text-slate-700">
              Goal type
              <select
                value={goalType}
                onChange={(event) => setGoalType(event.target.value as "professional" | "personal")}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="professional">Professional</option>
                <option value="personal">Personal</option>
              </select>
            </label>

            <label className="block text-sm text-slate-700">
              Title
              <input
                value={goalTitle}
                onChange={(event) => setGoalTitle(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Improve leadership communication"
              />
            </label>

            <label className="block text-sm text-slate-700 md:col-span-2">
              Description
              <textarea
                value={goalDescription}
                onChange={(event) => setGoalDescription(event.target.value)}
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Capture the business outcome and why this goal matters."
              />
            </label>

            <label className="block text-sm text-slate-700">
              Projected start
              <input
                type="date"
                value={goalStartDate}
                onChange={(event) => setGoalStartDate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="block text-sm text-slate-700">
              Projected end
              <input
                type="date"
                value={goalEndDate}
                onChange={(event) => setGoalEndDate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="block text-sm text-slate-700">
              Timeframe label
              <input
                value={goalTimeframeLabel}
                onChange={(event) => setGoalTimeframeLabel(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Q3 2026"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={goalIsFocus}
                onChange={(event) => setGoalIsFocus(event.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              Mark as current focus goal
            </label>

            {saveError ? <p className="text-sm text-red-700 md:col-span-2">{saveError}</p> : null}

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Saving..." : editingGoal ? "Update goal" : "Create goal"}
              </button>
              <span className="text-sm text-slate-500">
                {editingGoal ? "Editing an existing goal." : "Creates the first repository-backed write path."}
              </span>
            </div>
          </form>
        </article>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Profile defaults</h3>
          {snapshot?.profile ? (
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <dt>Email</dt>
                <dd>{snapshot.profile.email || "Not set"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Theme</dt>
                <dd>{snapshot.profile.theme}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Timezone</dt>
                <dd>{snapshot.profile.timezone}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">The profile has not been read back yet.</p>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Goal snapshot</h3>
          <GoalList
            title="Professional"
            goals={snapshot?.professionalGoals ?? []}
            onEdit={startEditing}
          />
          <GoalList
            title="Personal"
            goals={snapshot?.personalGoals ?? []}
            onEdit={startEditing}
          />
        </article>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">Subgoal and task read probe</h3>
          {snapshot?.sampleGoalId ? (
            <>
              <p className="mt-2 text-sm text-slate-700">
                Loaded from goal <span className="font-mono text-xs text-slate-600">{snapshot.sampleGoalId}</span>
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Subgoals</p>
              {snapshot.sampleSubgoals.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {snapshot.sampleSubgoals.slice(0, 5).map((subgoal) => (
                    <li key={subgoal.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="font-medium text-slate-900">{subgoal.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{subgoal.id}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No subgoals found for the sampled goal yet.</p>
              )}

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Tasks from first subgoal</p>
              {snapshot.sampleTasks.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {snapshot.sampleTasks.slice(0, 5).map((task) => (
                    <li key={task.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{task.id}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No tasks found for the sampled subgoal yet.</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Add at least one goal to activate the repository subgoal/task probe.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function GoalList({
  title,
  goals,
  onEdit,
}: {
  title: string;
  goals: Goal[];
  onEdit: (goal: Goal) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      {goals.length > 0 ? (
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {goals.slice(0, 3).map((goal) => (
            <li key={goal.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{goal.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {goal.status.replaceAll("_", " ")} · {goal.timeframe || "No timeframe"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(goal)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">No goals found yet for this type.</p>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: string }).message;
    if (message) {
      return message;
    }
  }

  return fallbackMessage;
}