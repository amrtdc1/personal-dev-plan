"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MagicCodeAuth } from "@/components/auth/magic-code-auth";
import { CalendarWorkspace } from "@/components/dashboard/calendar-workspace";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { JournalWorkspace } from "@/components/dashboard/journal-workspace";
import { MigrationDataPreview } from "@/components/dashboard/migration-data-preview";
import { OfflineSyncStatus } from "@/components/dashboard/offline-sync-status";
import { dataRepository } from "@/lib/data/repository";
import { validateUserProfileWrite } from "@/lib/data/validation";
import allowlistData from "@/lib/theming/data/espn-d1-allowlist.json";
import { db } from "@/lib/instantdb/client";
import { env } from "@/lib/config/env";
import type { UserProfile } from "@/lib/domain/types";

type AppSection = "dashboard" | "goals" | "calendar" | "journal" | "profile";
type ThemeChoice = "light" | "dark" | "system";

const PALETTE_OPTIONS: UserProfile["palette"][] = [
  "ocean",
  "sunset",
  "forest",
  "royal",
  "candy",
  "dusk",
  "lava",
  "mint",
];

type AllowlistTeam = {
  id: string;
  displayName: string;
  abbreviation: string;
  subdivision: "FBS" | "FCS";
};

const COLLEGE_TEAMS = ((allowlistData as { teams?: AllowlistTeam[] }).teams ?? [])
  .slice()
  .sort((a, b) => a.displayName.localeCompare(b.displayName));

const COLLEGE_TEAMS_BY_ID = new Map(COLLEGE_TEAMS.map((team) => [team.id, team]));

export function HomeExperience() {
  return (
    <>
      <db.SignedOut>
        <SignedOutLanding />
      </db.SignedOut>
      <db.SignedIn>
        <SignedInShell />
      </db.SignedIn>
    </>
  );
}

function SignedOutLanding() {
  return (
    <main className="auth-landing mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-6xl flex-1 items-center px-4 py-3 md:px-6 md:py-4">
      <section className="auth-hero-grid grid w-full gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="auth-story relative overflow-hidden rounded-3xl border border-slate-200 p-5 shadow-xl md:p-6">
          <div className="auth-orb auth-orb-a" aria-hidden="true" />
          <div className="auth-orb auth-orb-b" aria-hidden="true" />
          <div className="auth-orb auth-orb-c" aria-hidden="true" />

          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Personal Development Plan</p>
          <h1 className="mt-2 max-w-xl text-2xl font-semibold leading-tight tracking-tight text-slate-900 md:text-4xl">
            Build momentum with goals, calendar, and journal in one workspace.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 md:text-[15px]">
            Sign in with Magic Code and pick up exactly where you left off. Your dashboard becomes the launch point
            for planning goals, tracking your timeline, and reflecting on progress. Calendar sync support gives you a
            clean path to mirror milestones into your preferred calendar tools.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="auth-highlight-card rounded-2xl border border-white/70 bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Focus Engine</p>
              <p className="mt-1 text-sm text-slate-700">Drive priorities with focus insights and due-soon visibility.</p>
            </div>
            <div className="auth-highlight-card rounded-2xl border border-white/70 bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Journal Trail</p>
              <p className="mt-1 text-sm text-slate-700">Capture wins and blockers with mood and tag filters.</p>
            </div>
            <div className="auth-highlight-card rounded-2xl border border-white/70 bg-white/80 p-3 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Calendar Sync</p>
              <p className="mt-1 text-sm text-slate-700">
                Keep your PDP timeline aligned with external calendars through secure subscription-based sync.
              </p>
            </div>
          </div>

          <div className="auth-visual-stack mt-4">
            <div className="auth-visual-card auth-visual-card-top">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Today</p>
              <h2 className="mt-2 text-sm font-semibold text-slate-900">Q3 Product Milestones</h2>
              <div className="mt-3 space-y-2">
                <div className="auth-progress-row">
                  <span>Goal Progress</span>
                  <span>68%</span>
                </div>
                <div className="auth-progress-track">
                  <div className="auth-progress-bar w-[68%]" />
                </div>
              </div>
            </div>

            <div className="auth-visual-card auth-visual-card-bottom">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Upcoming</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-700">
                <li>Calendar review: Friday 10:00 AM</li>
                <li>Journal check-in: Friday evening</li>
                <li>Goal archive audit: next Monday</li>
              </ul>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Welcome</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Sign in to your workspace</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter your email to receive a secure Magic Code. New users are set up automatically after first sign-in.
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5">
            <MagicCodeAuth showSignedInPanel={false} />
          </div>
        </article>
      </section>
    </main>
  );
}

function SignedInShell() {
  const { user } = db.useAuth();
  const [activeSection, setActiveSection] = useState<AppSection>("dashboard");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isThemeSaving, setIsThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [themeOverride, setThemeOverride] = useState<"light" | "dark" | "cwm" | null>(null);
  const { data, isLoading: isProfileLoading } = db.useQuery(
    user
      ? {
          userProfiles: {
            $: {
              where: {
                uid: user.id,
              },
            },
          },
        }
      : null,
  );

  const navItems = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard", shortLabel: "Home", icon: "dashboard" as const },
      { id: "goals" as const, label: "Goals", shortLabel: "Goals", icon: "goals" as const },
      { id: "calendar" as const, label: "Calendar", shortLabel: "Calendar", icon: "calendar" as const },
      { id: "journal" as const, label: "Journal", shortLabel: "Journal", icon: "journal" as const },
    ],
    [],
  );

  const profile = data?.userProfiles?.[0] ?? null;
  const storedTheme = themeOverride ?? normalizeStoredTheme(profile?.theme);
  const themeChoice = toThemeChoice(storedTheme);

  useEffect(() => {
    applyThemeToDocument(storedTheme);

    if (storedTheme !== "cwm" || typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      applyThemeToDocument("cwm");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemChange);
    } else {
      mediaQuery.addListener(handleSystemChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleSystemChange);
      } else {
        mediaQuery.removeListener(handleSystemChange);
      }
    };
  }, [storedTheme]);

  if (!user) {
    return null;
  }

  const currentUser = user;
  const initials = getUserInitials(
    profile?.firstName ?? null,
    profile?.lastName ?? null,
    currentUser.email ?? null,
  );

  if (isProfileLoading) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 py-6 md:px-8 md:py-8">
        <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Loading your workspace...</h2>
        </section>
      </main>
    );
  }

  const needsOnboarding =
    !profile || !profile.firstName?.trim() || !profile.lastName?.trim() || !profile.timezone?.trim();

  if (needsOnboarding) {
    return <FirstLoginOnboarding user={currentUser} profile={profile} />;
  }

  const selectedCollegeTeam = getCollegeTeamSelection(
    profile.collegeTeamId ?? null,
    profile.collegeTeamName ?? null,
    profile.collegeLogoUrl ?? null,
  );

  async function handleQuickThemeChange(nextChoice: ThemeChoice) {
    const mappedTheme = nextChoice === "system" ? "cwm" : nextChoice;
    setThemeError(null);
    setThemeOverride(mappedTheme);
    applyThemeToDocument(mappedTheme);
    setIsThemeSaving(true);

    try {
      await db.transact(
        db.tx.userProfiles[currentUser.id].update({
          theme: mappedTheme,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch (updateError) {
      setThemeOverride(null);
      applyThemeToDocument(normalizeStoredTheme(profile?.theme));
      setThemeError(getErrorMessage(updateError, "We could not update your display mode."));
    } finally {
      setIsThemeSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8">
      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">PDP Workspace</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-600">Signed in as {currentUser.email}</p>
            {selectedCollegeTeam ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                {selectedCollegeTeam.logoUrl ? (
                  <Image
                    src={selectedCollegeTeam.logoUrl}
                    alt={`${selectedCollegeTeam.displayName} logo`}
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] rounded-sm object-contain"
                  />
                ) : null}
                <span className="text-xs font-semibold text-slate-700">{selectedCollegeTeam.displayName}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 self-start">
            <div className="inline-flex rounded-full border border-slate-300 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => void handleQuickThemeChange("light")}
                disabled={isThemeSaving}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                  themeChoice === "light" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-label="Set light mode"
                title="Light mode"
              >
                <SunIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleQuickThemeChange("dark")}
                disabled={isThemeSaving}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                  themeChoice === "dark" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-label="Set dark mode"
                title="Dark mode"
              >
                <MoonIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleQuickThemeChange("system")}
                disabled={isThemeSaving}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                  themeChoice === "system" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-label="Set system mode"
                title="System mode"
              >
                <SystemIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                aria-label="Open profile menu"
              >
                {initials}
              </button>

              {isProfileMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection("profile");
                      setIsProfileMenuOpen(false);
                    }}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    Profile & Theme Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => db.auth.signOut()}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {themeError ? <p className="mt-3 text-sm text-red-700">{themeError}</p> : null}

        <nav className="mt-4 hidden flex-wrap gap-2 sm:flex" aria-label="Primary app sections">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </section>

      {activeSection === "dashboard" ? (
        <>
          <OfflineSyncStatus />
          <DashboardInsights />
        </>
      ) : null}

      {activeSection === "goals" ? <MigrationDataPreview /> : null}
      {activeSection === "calendar" ? <CalendarWorkspace /> : null}
      {activeSection === "journal" ? <JournalWorkspace /> : null}
      {activeSection === "profile" ? <ProfileSettings /> : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden"
        aria-label="Mobile app sections"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={`mobile-${item.id}`}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium transition ${
                  isActive ? "text-slate-900" : "text-slate-500"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                    isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                  aria-hidden="true"
                >
                  <SectionIcon type={item.icon} className="h-4 w-4" />
                </span>
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function ProfileSettings() {
  const { user, isLoading } = db.useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamSubdivisionFilter, setTeamSubdivisionFilter] = useState<"all" | "FBS" | "FCS">("all");
  const [selectedCollegeTeamIdInput, setSelectedCollegeTeamIdInput] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => dataRepository.getOfflineMutationCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    return dataRepository.subscribeOfflineMutationCount((count) => {
      setPendingSyncCount(count);
    });
  }, []);

  const { data, isLoading: isProfileLoading, error } = db.useQuery(
    user
      ? {
          userProfiles: {
            $: {
              where: {
                uid: user.id,
              },
            },
          },
        }
      : null,
  );

  const profile = data?.userProfiles?.[0] ?? null;
  const selectedCollegeTeamId = selectedCollegeTeamIdInput ?? (profile?.collegeTeamId ?? "");

  const filteredCollegeTeams = useMemo(() => {
    const query = teamSearchQuery.trim().toLowerCase();

    return COLLEGE_TEAMS.filter((team) => {
      if (teamSubdivisionFilter !== "all" && team.subdivision !== teamSubdivisionFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = `${team.displayName} ${team.abbreviation} ${team.subdivision}`.toLowerCase();
      return searchable.includes(query);
    }).slice(0, 18);
  }, [teamSearchQuery, teamSubdivisionFilter]);

  if (isLoading || isProfileLoading) {
    return (
      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Profile & Theme</h2>
        <p className="mt-3 text-sm text-slate-700">Loading your profile settings...</p>
      </section>
    );
  }

  if (error || !user || !profile) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Profile & Theme</h2>
        <p className="mt-2 text-sm text-red-700">
          {error?.message ?? "Profile settings could not be loaded yet. Sign out and in again to retry."}
        </p>
      </section>
    );
  }

  const currentUser = user;
  const currentProfile = profile;
  const defaultThemeChoice: ThemeChoice = currentProfile.theme === "cwm" ? "system" : currentProfile.theme;
  const selectedCollegeTeam = selectedCollegeTeamId ? COLLEGE_TEAMS_BY_ID.get(selectedCollegeTeamId) : null;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const themeChoice = String(formData.get("themeMode") ?? "system") as ThemeChoice;
      const mappedTheme = themeChoice === "system" ? "cwm" : themeChoice;
      const selectedCollegeLogoUrl = selectedCollegeTeam
        ? getCollegeTeamLogoUrl(selectedCollegeTeam.id)
        : nullableValue(formData.get("collegeLogoUrl"));

      const updatedProfile = validateUserProfileWrite({
        uid: currentUser.id,
        email: currentUser.email ?? currentProfile.email,
        displayName: nullableValue(formData.get("displayName")) ?? currentUser.email ?? null,
        firstName: nullableValue(formData.get("firstName")),
        lastName: nullableValue(formData.get("lastName")),
        theme: mappedTheme,
        palette: (formData.get("palette") as UserProfile["palette"]) ?? currentProfile.palette,
        collegeTeamId: selectedCollegeTeam?.id ?? null,
        collegeTeamName: selectedCollegeTeam?.displayName ?? null,
        collegeLogoUrl: selectedCollegeLogoUrl,
        timezone: String(formData.get("timezone") ?? currentProfile.timezone).trim() || currentProfile.timezone,
        retentionDays: Number(formData.get("retentionDays") ?? currentProfile.retentionDays),
        createdAt: currentProfile.createdAt,
        updatedAt: new Date().toISOString(),
      });

      await db.transact(
        db.tx.userProfiles[currentUser.id].update({
          uid: updatedProfile.uid,
          email: updatedProfile.email,
          firstName: updatedProfile.firstName ?? null,
          lastName: updatedProfile.lastName ?? null,
          displayName: updatedProfile.displayName,
          theme: updatedProfile.theme,
          palette: updatedProfile.palette,
          collegeTeamId: updatedProfile.collegeTeamId ?? null,
          collegeTeamName: updatedProfile.collegeTeamName ?? null,
          collegeLogoUrl: updatedProfile.collegeLogoUrl ?? null,
          timezone: updatedProfile.timezone,
          retentionDays: updatedProfile.retentionDays,
          updatedAt: updatedProfile.updatedAt,
        }),
      );

      setSaveMessage("Profile preferences saved.");
    } catch (updateError) {
      setSaveError(getErrorMessage(updateError, "We could not save your profile updates."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleManualSync() {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const result = await dataRepository.flushOfflineMutations();
      if (result.failed > 0) {
        setSyncMessage(`Sync paused. ${result.remaining} change(s) remain queued.`);
      } else if (result.processed > 0) {
        setSyncMessage(`Synced ${result.processed} queued change(s).`);
      } else {
        setSyncMessage("Everything is already in sync.");
      }
    } catch {
      setSyncMessage("Manual sync failed. Try again when your connection is stable.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Profile & Theme</h2>
      <p className="mt-2 text-sm text-slate-600">
        Update your profile info, theme palette, and display mode (light, dark, or system).
      </p>

      <form className="mt-4 grid gap-3" onSubmit={handleSave}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            First name
            <input
              name="firstName"
              defaultValue={currentProfile.firstName ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Last name
            <input
              name="lastName"
              defaultValue={currentProfile.lastName ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <label className="text-sm font-medium text-slate-700">
          Display name
          <input
            name="displayName"
            defaultValue={currentProfile.displayName ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Mode
            <select
              name="themeMode"
              defaultValue={defaultThemeChoice}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Palette
            <select
              name="palette"
              defaultValue={currentProfile.palette}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              {PALETTE_OPTIONS.map((palette) => (
                <option key={palette} value={palette}>
                  {capitalize(palette)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Timezone
            <input
              name="timezone"
              defaultValue={currentProfile.timezone}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Retention days
            <input
              name="retentionDays"
              type="number"
              min={1}
              defaultValue={currentProfile.retentionDays}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <div>
            <p className="text-sm font-medium text-slate-700">Team filter</p>
            <div className="mt-1 inline-flex rounded-lg border border-slate-300 p-1">
              {(["all", "FBS", "FCS"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTeamSubdivisionFilter(value)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    teamSubdivisionFilter === value
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {value === "all" ? "All" : value}
                </button>
              ))}
            </div>
          </div>

          <label className="text-sm font-medium text-slate-700">
            College logo URL override
            <input
              name="collegeLogoUrl"
              defaultValue={currentProfile.collegeLogoUrl ?? ""}
              placeholder="https://a.espncdn.com/..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Search teams
            <input
              value={teamSearchQuery}
              onChange={(event) => setTeamSearchQuery(event.target.value)}
              placeholder="Search school or abbreviation"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <input type="hidden" name="collegeTeamId" value={selectedCollegeTeamId} />

        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">College team picker</h3>
            <p className="text-xs text-slate-500">Showing {filteredCollegeTeams.length} team(s)</p>
          </div>

          {selectedCollegeTeam ? (
            <div className="mt-3 rounded-lg border border-slate-300 bg-white p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected</p>
              <div className="mt-2 flex items-center gap-2">
                <Image
                  src={getCollegeTeamLogoUrl(selectedCollegeTeam.id)}
                  alt={`${selectedCollegeTeam.displayName} logo`}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-sm object-contain"
                />
                <p className="text-sm font-semibold text-slate-900">{selectedCollegeTeam.displayName}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {selectedCollegeTeam.subdivision}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCollegeTeamIdInput("")}
                className="mt-2 text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
              >
                Clear team selection
              </button>
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCollegeTeams.map((team) => {
              const isSelected = selectedCollegeTeamId === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedCollegeTeamIdInput(team.id)}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  }`}
                >
                  <Image
                    src={getCollegeTeamLogoUrl(team.id)}
                    alt={`${team.displayName} logo`}
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-sm object-contain"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{team.displayName}</span>
                    <span className={`text-[11px] ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                      {team.abbreviation} • {team.subdivision}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {filteredCollegeTeams.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No teams match your current search and subdivision filter.</p>
          ) : null}
        </section>

        {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}
        {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Saving..." : "Save profile"}
            </button>
            <button
              type="button"
              onClick={() => void handleManualSync()}
              disabled={isSyncing || pendingSyncCount === 0}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSyncing ? "Syncing..." : "Sync now"}
            </button>
            <span className="text-xs text-slate-500">Queued changes: {pendingSyncCount}</span>
          </div>
          {syncMessage ? <p className="mt-2 text-sm text-slate-600">{syncMessage}</p> : null}
        </div>
      </form>
    </section>
  );
}

function FirstLoginOnboarding({
  user,
  profile,
}: {
  user: { id: string; email?: string | null };
  profile:
    | {
        email: string;
        firstName?: string | null;
        lastName?: string | null;
        displayName?: string | null;
        theme?: "light" | "dark" | "cwm";
        palette?: UserProfile["palette"];
        collegeTeamId?: string | null;
        collegeTeamName?: string | null;
        collegeLogoUrl?: string | null;
        timezone?: string;
        retentionDays?: number;
        createdAt?: string;
      }
    | null;
}) {
  const [step, setStep] = useState<"identity" | "preferences">("identity");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezoneOptions = useMemo(() => getTimezoneOptions(profile?.timezone), [profile?.timezone]);

  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? getDefaultTimezone());

  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(
    profile?.theme === "dark" ? "dark" : profile?.theme === "light" ? "light" : "system",
  );
  const [palette, setPalette] = useState<UserProfile["palette"]>(profile?.palette ?? "ocean");

  async function handleIdentitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !timezone.trim()) {
      setError("First name, last name, and timezone are required.");
      return;
    }

    setError(null);
    setStep("preferences");
  }

  async function handleFinish() {
    setIsSaving(true);
    setError(null);

    try {
      const mappedTheme = themeChoice === "system" ? "cwm" : themeChoice;
      const nowIso = new Date().toISOString();

      const validatedProfile = validateUserProfileWrite({
        uid: user.id,
        email: user.email ?? profile?.email ?? "",
        displayName:
          profile?.displayName ??
          (`${firstName.trim()} ${lastName.trim()}`.trim() || user.email || null),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        theme: mappedTheme,
        palette,
        collegeTeamId: profile?.collegeTeamId ?? null,
        collegeTeamName: profile?.collegeTeamName ?? null,
        collegeLogoUrl: profile?.collegeLogoUrl ?? null,
        timezone: timezone.trim(),
        retentionDays: profile?.retentionDays ?? env.softDeleteRetentionDays,
        createdAt: profile?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });

      await db.transact(
        db.tx.userProfiles[user.id].update({
          uid: validatedProfile.uid,
          email: validatedProfile.email,
          firstName: validatedProfile.firstName ?? null,
          lastName: validatedProfile.lastName ?? null,
          displayName: validatedProfile.displayName,
          theme: validatedProfile.theme,
          palette: validatedProfile.palette,
          collegeTeamId: validatedProfile.collegeTeamId ?? null,
          collegeTeamName: validatedProfile.collegeTeamName ?? null,
          collegeLogoUrl: validatedProfile.collegeLogoUrl ?? null,
          timezone: validatedProfile.timezone,
          retentionDays: validatedProfile.retentionDays,
          createdAt: validatedProfile.createdAt,
          updatedAt: validatedProfile.updatedAt,
        }),
      );
    } catch (saveError) {
      setError(getErrorMessage(saveError, "We could not save your onboarding details."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 items-center px-5 py-6 md:px-8 md:py-10">
      <section className="w-full rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Welcome to PDP</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Let&apos;s set up your workspace</h1>
        <p className="mt-2 text-sm text-slate-600">
          First login setup only takes a minute. We&apos;ll capture your profile basics, then theme preferences.
        </p>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {step === "identity" ? "Step 1 of 2" : "Step 2 of 2"}
          </p>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            <div
              className={`h-full rounded-full bg-slate-900 transition-all ${
                step === "identity" ? "w-1/2" : "w-full"
              }`}
            />
          </div>
        </div>

        {step === "identity" ? (
          <form className="mt-5 grid gap-3" onSubmit={handleIdentitySubmit}>
            <label className="text-sm font-medium text-slate-700">
              Email
              <input
                value={user.email ?? ""}
                disabled
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                First name
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  required
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Last name
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  required
                />
              </label>
            </div>

            <label className="text-sm font-medium text-slate-700">
              Timezone
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                required
              >
                {timezoneOptions.map((timezoneValue) => (
                  <option key={timezoneValue} value={timezoneValue}>
                    {timezoneValue}
                  </option>
                ))}
              </select>
            </label>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div>
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Continue
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 grid gap-3">
            <p className="text-sm text-slate-600">Choose your initial visual preferences. You can change these anytime.</p>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Mode
                <select
                  value={themeChoice}
                  onChange={(event) => setThemeChoice(event.target.value as ThemeChoice)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                Palette
                <select
                  value={palette}
                  onChange={(event) => setPalette(event.target.value as UserProfile["palette"])}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  {PALETTE_OPTIONS.map((paletteValue) => (
                    <option key={paletteValue} value={paletteValue}>
                      {capitalize(paletteValue)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep("identity")}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={isSaving}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Skip for now"}
              </button>
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={isSaving}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Saving..." : "Finish setup"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function nullableValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function capitalize(value: string) {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getDefaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getTimezoneOptions(initialTimezone?: string) {
  const defaultTimezone = getDefaultTimezone();
  const fallback = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "Australia/Sydney",
  ];

  const intlWithSupported = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const fromRuntime =
    typeof intlWithSupported.supportedValuesOf === "function"
      ? intlWithSupported.supportedValuesOf("timeZone")
      : fallback;

  const merged = Array.from(new Set([initialTimezone ?? "", defaultTimezone, ...fromRuntime])).filter(
    (value) => value.length > 0,
  );

  return merged;
}

function getCollegeTeamSelection(
  collegeTeamId: string | null,
  collegeTeamName: string | null,
  collegeLogoUrl: string | null,
) {
  if (!collegeTeamId && !collegeTeamName && !collegeLogoUrl) {
    return null;
  }

  const allowlistTeam = collegeTeamId ? COLLEGE_TEAMS_BY_ID.get(collegeTeamId) : null;
  const fallbackLogoUrl = allowlistTeam ? getCollegeTeamLogoUrl(allowlistTeam.id) : null;

  return {
    id: allowlistTeam?.id ?? collegeTeamId ?? "",
    displayName: allowlistTeam?.displayName ?? collegeTeamName ?? "College Team",
    logoUrl: collegeLogoUrl ?? fallbackLogoUrl,
  };
}

function getCollegeTeamLogoUrl(teamId: string) {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

function normalizeStoredTheme(theme: string | null | undefined): "light" | "dark" | "cwm" {
  if (theme === "light" || theme === "dark" || theme === "cwm") {
    return theme;
  }

  return "cwm";
}

function toThemeChoice(theme: "light" | "dark" | "cwm"): ThemeChoice {
  return theme === "cwm" ? "system" : theme;
}

function getUserInitials(firstName: string | null, lastName: string | null, email: string | null) {
  const combined = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  if (combined) {
    const parts = combined.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }

  if (email) {
    return email.charAt(0).toUpperCase();
  }

  return "U";
}

function applyThemeToDocument(theme: "light" | "dark" | "cwm") {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  if (theme === "cwm") {
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = prefersDark ? "dark" : "light";
    return;
  }

  root.dataset.theme = theme;
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.93 4.93 6.7 6.7M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07 6.7 17.3M17.3 6.7l1.77-1.77" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
    </svg>
  );
}

function SystemIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function SectionIcon({
  type,
  className,
}: {
  type: "dashboard" | "goals" | "calendar" | "journal";
  className?: string;
}) {
  if (type === "goals") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 6h16M4 12h10M4 18h8" />
      </svg>
    );
  }

  if (type === "calendar") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    );
  }

  if (type === "journal") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" />
        <path d="M8 8h7M8 12h7M8 16h5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  );
}
