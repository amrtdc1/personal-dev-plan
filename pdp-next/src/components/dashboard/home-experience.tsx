"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { MagicCodeAuth } from "@/components/auth/magic-code-auth";
import { CalendarWorkspace } from "@/components/dashboard/calendar-workspace";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { HabitsWorkspace } from "@/components/dashboard/habits-workspace";
import { JournalWorkspace } from "@/components/dashboard/journal-workspace";
import { MigrationDataPreview as GoalsWorkspace } from "@/components/dashboard/migration-data-preview";
import { NodeMapWorkspace } from "@/components/dashboard/node-map-workspace";
import { OfflineSyncStatus } from "@/components/dashboard/offline-sync-status";
import { CalendarFeedRotationControl } from "@/components/dashboard/calendar-feed-rotation-control";
import { SchedulerHealthCard } from "@/components/dashboard/scheduler-health-card";
import { InstallAndNotifyBanner, OPEN_PUSH_SETTINGS_EVENT } from "@/components/pwa/install-and-notify-banner";
import { dataRepository } from "@/lib/data/repository";
import { validateUserProfileWrite } from "@/lib/data/validation";
import {
  formatOfflineOperationLabel,
  getFriendlySyncFailureReason,
  getOfflineSyncDiagnosticCode,
} from "@/lib/offline/sync-status";
import allowlistData from "@/lib/theming/data/espn-d1-allowlist.json";
import type { CollegeThemeTeam } from "@/lib/theming/providers/espn-college";
import { db } from "@/lib/instantdb/client";
import { env } from "@/lib/config/env";
import type { UserProfile } from "@/lib/domain/types";
import { IconButton } from "@/components/ui/icon-button";
import { Copy, Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";

type AppSection = "dashboard" | "goals" | "node-map" | "calendar" | "habits" | "journal" | "profile";
type SectionIconType = "dashboard" | "goals" | "node-map" | "calendar" | "habits" | "journal";
type SectionNavItem = {
  id: SectionIconType;
  label: string;
  shortLabel: string;
  icon: SectionIconType;
};
type ThemeChoice = "light" | "dark" | "system";
type ThemeSource = "palette" | "cwm" | "college";
type ThemeBrandSnapshot = {
  themeSource: ThemeSource;
  theme: "light" | "dark" | "cwm";
  palette: UserProfile["palette"];
  collegeTeamId: string | null;
  collegeTeamName: string | null;
  collegeLogoUrl: string | null;
};

type BrandVisual = {
  label: string;
  logoUrl: string | null;
  watermarkUrl: string | null;
  watermarkOpacity: number;
  watermarkScale: number;
};

const THEME_STORAGE_KEY = "pdp:theme";
const PALETTE_STORAGE_KEY = "pdp:palette";
const ACTIVE_SECTION_STORAGE_KEY = "pdp.activeSection";

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

const PALETTE_THEME_TOKENS: Record<UserProfile["palette"], { primary: string; soft: string }> = {
  ocean: { primary: "#0c4a6e", soft: "#e0f2fe" },
  sunset: { primary: "#9a3412", soft: "#ffedd5" },
  forest: { primary: "#14532d", soft: "#dcfce7" },
  royal: { primary: "#312e81", soft: "#e0e7ff" },
  candy: { primary: "#be185d", soft: "#fce7f3" },
  dusk: { primary: "#1f2937", soft: "#e5e7eb" },
  lava: { primary: "#7f1d1d", soft: "#fee2e2" },
  mint: { primary: "#065f46", soft: "#d1fae5" },
};

type AllowlistTeam = {
  id: string;
  displayName: string;
  abbreviation: string;
  subdivision: "FBS" | "FCS";
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
  colors?: {
    primary?: string | null;
    secondary?: string | null;
  };
};

const COLLEGE_TEAMS = ((allowlistData as { teams?: AllowlistTeam[] }).teams ?? [])
  .slice()
  .sort((a, b) => a.displayName.localeCompare(b.displayName));

const COLLEGE_TEAMS_BY_ID = new Map(COLLEGE_TEAMS.map((team) => [team.id, team]));
const FALLBACK_COLLEGE_THEME_TEAMS: CollegeThemeTeam[] = COLLEGE_TEAMS.map((team) => ({
  id: team.id,
  displayName: team.displayName,
  abbreviation: team.abbreviation,
  slug: "",
  subdivision: team.subdivision,
  logoUrl: getCollegeTeamLogoUrl(team.id),
  darkLogoUrl: null,
  colors: {
    primary: null,
    secondary: null,
  },
}));

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
            Sign in with Magic Code and pick up exactly where you left off. Your Today workspace becomes the launch point
            for daily execution, while Planning helps you build goals across timelines. Calendar sync support gives you a
            clean path to mirror childGoals into your preferred calendar tools.
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
              <h2 className="mt-2 text-sm font-semibold text-slate-900">Q3 Product ChildGoals</h2>
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
  const [activeSection, setActiveSection] = useState<AppSection>(() => readActiveSectionPreference());
  const [pendingOpenItem, setPendingOpenItem] = useState<
    { kind: "goal" | "childGoal" | "task"; id: string } | null
  >(null);
  const [isThemeSaving, setIsThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [savedThemeSnapshot, setSavedThemeSnapshot] = useState<ThemeBrandSnapshot | null>(null);
  const [previewThemeSnapshot, setPreviewThemeSnapshot] = useState<ThemeBrandSnapshot | null>(null);
  const [cachedTheme] = useState<"light" | "dark" | "cwm" | null>(() => readCachedTheme());
  const [cachedPalette] = useState<UserProfile["palette"] | null>(() => readCachedPalette());
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

  const navItems = useMemo<SectionNavItem[]>(
    () => [
      { id: "dashboard", label: "Today", shortLabel: "Today", icon: "dashboard" },
      { id: "goals", label: "Planning", shortLabel: "Plan", icon: "goals" },
      { id: "node-map", label: "Node Map", shortLabel: "Map", icon: "node-map" },
      { id: "calendar", label: "Calendar", shortLabel: "Calendar", icon: "calendar" },
      { id: "habits", label: "Habits", shortLabel: "Habits", icon: "habits" },
      { id: "journal", label: "Journal", shortLabel: "Journal", icon: "journal" },
    ],
    [],
  );

  const profile = data?.userProfiles?.[0] ?? null;
  const effectiveThemeSnapshot = previewThemeSnapshot ?? savedThemeSnapshot;
  const resolvedCollegeTeamId = effectiveThemeSnapshot?.collegeTeamId ?? profile?.collegeTeamId ?? null;
  const resolvedCollegeTeamName = effectiveThemeSnapshot?.collegeTeamName ?? profile?.collegeTeamName ?? null;
  const resolvedCollegeLogoUrl = effectiveThemeSnapshot?.collegeLogoUrl ?? profile?.collegeLogoUrl ?? null;
  const resolvedPalette = effectiveThemeSnapshot?.palette ?? profile?.palette ?? cachedPalette ?? "ocean";
  const storedTheme = normalizeStoredTheme(effectiveThemeSnapshot?.theme ?? profile?.theme ?? cachedTheme);
  const themeChoice = toThemeChoice(storedTheme);
  const themeSource =
    effectiveThemeSnapshot?.themeSource ?? normalizeThemeSource(profile?.themeMode, resolvedCollegeTeamId);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, storedTheme);
    window.localStorage.setItem(PALETTE_STORAGE_KEY, resolvedPalette);
  }, [resolvedPalette, storedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeSection === "profile") {
      window.localStorage.removeItem(ACTIVE_SECTION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection]);

  useEffect(() => {
    applyThemeToDocument(storedTheme);
    applyProfileThemeTokens(themeSource, resolvedPalette, resolvedCollegeTeamId);

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
  }, [resolvedCollegeTeamId, resolvedPalette, storedTheme, themeSource]);

  const handleThemeProfileSaved = useCallback((snapshot: ThemeBrandSnapshot) => {
    setSavedThemeSnapshot(snapshot);
    setPreviewThemeSnapshot(null);
  }, []);

  const handleThemeProfilePreview = useCallback((snapshot: ThemeBrandSnapshot | null) => {
    setPreviewThemeSnapshot((current) => (
      areThemeSnapshotsEqual(current, snapshot) ? current : snapshot
    ));
  }, []);

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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-2.5 py-3 sm:px-4 md:px-8 md:py-8">
        <section className="pdp-panel">
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

  const selectedCollegeTeam =
    themeSource === "college"
      ? getCollegeTeamSelection(
          resolvedCollegeTeamId,
          resolvedCollegeTeamName,
          resolvedCollegeLogoUrl,
        )
      : null;
  const effectiveBrandSource: ThemeSource = themeSource;
  const brandVisual = getBrandVisual(effectiveBrandSource, selectedCollegeTeam, storedTheme);
  const welcomeFirstName = getWelcomeFirstName(profile?.firstName ?? null, profile?.displayName ?? null, currentUser.email ?? null);

  async function handleQuickThemeChange(nextChoice: ThemeChoice) {
    const mappedTheme = nextChoice === "system" ? "cwm" : nextChoice;
    setThemeError(null);
    const previousTheme = storedTheme;
    applyThemeToDocument(mappedTheme);
    setIsThemeSaving(true);

    try {
      await saveUserProfileToServer({
        theme: mappedTheme,
      });
      setSavedThemeSnapshot((current) => ({
        themeSource: current?.themeSource ?? themeSource,
        theme: mappedTheme,
        palette: current?.palette ?? resolvedPalette,
        collegeTeamId: current?.collegeTeamId ?? resolvedCollegeTeamId,
        collegeTeamName: current?.collegeTeamName ?? resolvedCollegeTeamName,
        collegeLogoUrl: current?.collegeLogoUrl ?? resolvedCollegeLogoUrl,
      }));
    } catch (updateError) {
      applyThemeToDocument(previousTheme);
      setSavedThemeSnapshot((current) => (current ? { ...current, theme: previousTheme } : current));
      setThemeError(getFriendlyProfileSaveError(updateError, "We could not update your display mode."));
    } finally {
      setIsThemeSaving(false);
    }
  }

  function navigateToSection(section: AppSection) {
    if (section !== "profile") {
      setPreviewThemeSnapshot(null);
    }

    setActiveSection(section);
  }

  function handleOpenItemFromNodeMap(
    kind: "goal" | "childGoal" | "task",
    id: string,
  ) {
    setPendingOpenItem({ kind, id });
    setActiveSection("goals");
  }

  return (
    <main className="pdp-shell relative isolate mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-2.5 pb-20 pt-2 sm:px-4 sm:pt-3 md:px-8 md:pb-8 md:pt-8">
      <InstallAndNotifyBanner />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {brandVisual.watermarkUrl ? (
          <Image
            src={brandVisual.watermarkUrl}
            alt=""
            width={860}
            height={860}
            className="absolute left-1/2 top-[6rem] h-auto w-[min(44rem,92vw)] select-none object-contain"
            style={{ opacity: brandVisual.watermarkOpacity, transform: `translateX(-50%) scale(${brandVisual.watermarkScale})` }}
            aria-hidden="true"
            loading="eager"
            fetchPriority="high"
          />
        ) : null}
      </div>

      <HomeTopControls
        initials={initials}
        currentUserEmail={currentUser.email ?? "signed-in user"}
        isThemeSaving={isThemeSaving}
        themeChoice={themeChoice}
        onQuickThemeChange={handleQuickThemeChange}
        onOpenProfileSettings={() => navigateToSection("profile")}
        onSignOut={() => db.auth.signOut()}
        themeSource={themeSource}
        selectedCollegeTeamName={selectedCollegeTeam?.displayName ?? null}
        brandLogoUrl={brandVisual.logoUrl}
        resolvedPalette={resolvedPalette}
      />

      <section className="pdp-panel">

        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-2 flex min-w-0 items-center gap-2">
              {brandVisual.logoUrl ? (
                <span className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <Image
                    src={brandVisual.logoUrl}
                    alt={brandVisual.label}
                    width={48}
                    height={48}
                    className="h-full w-full object-contain p-1"
                    loading="eager"
                    fetchPriority="high"
                  />
                </span>
              ) : null}
              <p
                className="min-w-0 text-xs font-medium uppercase tracking-wide sm:text-sm"
                style={{ color: "var(--pdp-header-kicker-text, var(--pdp-theme-primary))" }}
              >
                Personal Development Plan
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Welcome back, {welcomeFirstName}
            </h1>
          </div>
        </div>

        {themeError ? <p className="mt-3 text-sm text-red-700">{themeError}</p> : null}

        <DesktopSectionNav
          items={navItems}
          activeSection={activeSection}
          onNavigate={navigateToSection}
        />
      </section>

      {activeSection === "dashboard" ? (
        <>
          <OfflineSyncStatus />
          <DashboardInsights />
        </>
      ) : null}

      <GoalsWorkspace
        pendingOpenItem={pendingOpenItem}
        onPendingItemConsumed={() => setPendingOpenItem(null)}
        showWorkspaceShell={activeSection === "goals"}
        enableDataHydration={activeSection === "goals" || pendingOpenItem !== null}
        showHabitsSection={false}
      />
      {activeSection === "node-map" ? <NodeMapWorkspace onOpenItem={handleOpenItemFromNodeMap} /> : null}
      {activeSection === "calendar" ? <CalendarWorkspace /> : null}
      {activeSection === "habits" ? <HabitsWorkspace /> : null}
      {activeSection === "journal" ? <JournalWorkspace /> : null}
      {activeSection === "profile" ? (
        <ProfileSettings onThemeSaved={handleThemeProfileSaved} onThemePreview={handleThemeProfilePreview} />
      ) : null}

      <MobileSectionNav
        items={navItems}
        activeSection={activeSection}
        onNavigate={navigateToSection}
      />
    </main>
  );
}

function DesktopSectionNav({
  items,
  activeSection,
  onNavigate,
}: {
  items: SectionNavItem[];
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
}) {
  return (
    <nav className="mt-4 hidden flex-wrap gap-2 sm:flex" aria-label="Primary app sections">
      {items.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "pdp-solid-muted-surface border border-slate-300 bg-slate-100 text-slate-900"
                : "pdp-solid-surface border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function MobileSectionNav({
  items,
  activeSection,
  onNavigate,
}: {
  items: SectionNavItem[];
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
}) {
  return (
    <nav
      className="pdp-solid-surface fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:hidden"
      aria-label="Mobile app sections"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-6">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={`mobile-${item.id}`}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium transition ${
                isActive ? "text-slate-800" : "text-slate-500"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                  isActive
                    ? "pdp-solid-surface border border-slate-300 bg-white text-slate-800 shadow-sm"
                    : "pdp-solid-muted-surface bg-slate-100 text-slate-600"
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
  );
}

function HomeTopControls({
  initials,
  currentUserEmail,
  isThemeSaving,
  themeChoice,
  onQuickThemeChange,
  onOpenProfileSettings,
  onSignOut,
  themeSource,
  selectedCollegeTeamName,
  brandLogoUrl,
  resolvedPalette,
}: {
  initials: string;
  currentUserEmail: string;
  isThemeSaving: boolean;
  themeChoice: ThemeChoice;
  onQuickThemeChange: (choice: ThemeChoice) => Promise<void>;
  onOpenProfileSettings: () => void;
  onSignOut: () => void;
  themeSource: ThemeSource;
  selectedCollegeTeamName: string | null;
  brandLogoUrl: string | null;
  resolvedPalette: UserProfile["palette"];
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-2">
      <ThemeModeControls
        isThemeSaving={isThemeSaving}
        themeChoice={themeChoice}
        onQuickThemeChange={onQuickThemeChange}
      />

      <ProfileMenuDropdown
        initials={initials}
        currentUserEmail={currentUserEmail}
        isProfileMenuOpen={isProfileMenuOpen}
        onToggle={() => setIsProfileMenuOpen((current) => !current)}
        onOpenProfileSettings={() => {
          onOpenProfileSettings();
          setIsProfileMenuOpen(false);
        }}
        onSignOut={onSignOut}
        themeSource={themeSource}
        selectedCollegeTeamName={selectedCollegeTeamName}
        brandLogoUrl={brandLogoUrl}
        resolvedPalette={resolvedPalette}
      />
    </div>
  );
}

function ThemeModeControls({
  isThemeSaving,
  themeChoice,
  onQuickThemeChange,
}: {
  isThemeSaving: boolean;
  themeChoice: ThemeChoice;
  onQuickThemeChange: (choice: ThemeChoice) => Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onQuickThemeChange(getNextThemeChoice(themeChoice))}
      disabled={isThemeSaving}
      className="pdp-solid-surface inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-9"
      aria-label={`Switch theme mode (currently ${themeChoice})`}
      title={`Theme: ${themeChoice}`}
    >
      {themeChoice === "light" ? (
        <SunIcon className="h-4 w-4" />
      ) : themeChoice === "dark" ? (
        <MoonIcon className="h-4 w-4" />
      ) : (
        <SystemIcon className="h-4 w-4" />
      )}
    </button>
  );
}

function ProfileMenuDropdown({
  initials,
  currentUserEmail,
  isProfileMenuOpen,
  onToggle,
  onOpenProfileSettings,
  onSignOut,
  themeSource,
  selectedCollegeTeamName,
  brandLogoUrl,
  resolvedPalette,
}: {
  initials: string;
  currentUserEmail: string;
  isProfileMenuOpen: boolean;
  onToggle: () => void;
  onOpenProfileSettings: () => void;
  onSignOut: () => void;
  themeSource: ThemeSource;
  selectedCollegeTeamName: string | null;
  brandLogoUrl: string | null;
  resolvedPalette: UserProfile["palette"];
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="pdp-solid-surface inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-800 transition hover:bg-slate-50 sm:h-9 sm:w-9"
        aria-haspopup="menu"
        aria-expanded={isProfileMenuOpen}
        aria-label={`Open profile menu (signed in as ${currentUserEmail})`}
        title={`Signed in as ${currentUserEmail}`}
      >
        {initials}
      </button>

      {isProfileMenuOpen ? (
        <div className="pdp-card pdp-modal-theme absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
          <button
            type="button"
            onClick={onOpenProfileSettings}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Profile & Theme Settings
          </button>
          <div className="mx-2 mt-1">
            {themeSource === "cwm" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                <Image
                  src="/cwm-logo.png"
                  alt="CWM logo"
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-sm object-contain"
                />
                <span className="text-xs font-semibold text-slate-700">CWM Theme</span>
              </span>
            ) : themeSource === "college" && selectedCollegeTeamName ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                {brandLogoUrl ? (
                  <Image
                    src={brandLogoUrl}
                    alt={`${selectedCollegeTeamName} logo`}
                    width={16}
                    height={16}
                    className="h-4 w-4 rounded-sm object-contain"
                  />
                ) : null}
                <span className="text-xs font-semibold text-slate-700">{selectedCollegeTeamName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                <span
                  className="h-4 w-4 rounded-full border border-slate-300"
                  style={{
                    backgroundColor: PALETTE_THEME_TOKENS[resolvedPalette].primary,
                  }}
                />
                <span className="text-xs font-semibold text-slate-700">
                  Palette - {resolvedPalette.charAt(0).toUpperCase() + resolvedPalette.slice(1)}
                </span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileSettings({
  onThemeSaved,
  onThemePreview,
}: {
  onThemeSaved?: (snapshot: ThemeBrandSnapshot) => void;
  onThemePreview?: (snapshot: ThemeBrandSnapshot | null) => void;
}) {
  const { user, isLoading } = db.useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [themeSourceInput, setThemeSourceInput] = useState<ThemeSource | null>(null);
  const [liveCollegeTeams, setLiveCollegeTeams] = useState<CollegeThemeTeam[] | null>(null);
  const [isLiveCollegeTeamsLoading, setIsLiveCollegeTeamsLoading] = useState(false);
  const [liveCollegeTeamsError, setLiveCollegeTeamsError] = useState<string | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamSubdivisionFilter, setTeamSubdivisionFilter] = useState<"all" | "FBS" | "FCS">("all");
  const [selectedCollegeTeamIdInput, setSelectedCollegeTeamIdInput] = useState<string | null>(null);
  const [displayModeInput, setDisplayModeInput] = useState<ThemeChoice | null>(null);
  const [paletteInput, setPaletteInput] = useState<UserProfile["palette"] | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => dataRepository.getOfflineMutationCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);
  const [calendarFeedExpiresAt, setCalendarFeedExpiresAt] = useState<string | null>(null);
  const [isCalendarFeedLoading, setIsCalendarFeedLoading] = useState(false);
  const [isCalendarFeedChecking, setIsCalendarFeedChecking] = useState(false);
  const [calendarFeedError, setCalendarFeedError] = useState<string | null>(null);
  const [calendarFeedCopyMessage, setCalendarFeedCopyMessage] = useState<string | null>(null);
  const [calendarFeedRotateMessage, setCalendarFeedRotateMessage] = useState<string | null>(null);
  const [calendarFeedSetupMessage, setCalendarFeedSetupMessage] = useState<string | null>(null);
  const [calendarFeedCheckMessage, setCalendarFeedCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    return dataRepository.subscribeOfflineMutationCount((count) => {
      setPendingSyncCount(count);
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadCollegeTeams() {
      setIsLiveCollegeTeamsLoading(true);
      setLiveCollegeTeamsError(null);

      try {
        const response = await fetch("/api/themes/college-teams", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load live team catalog (${response.status}).`);
        }

        const payload = (await response.json()) as {
          teams?: CollegeThemeTeam[];
        };

        if (!isCancelled) {
          const teams = Array.isArray(payload.teams) ? payload.teams : [];
          setLiveCollegeTeams(teams);
        }
      } catch {
        if (!isCancelled) {
          setLiveCollegeTeams(null);
          setLiveCollegeTeamsError("Live team catalog unavailable. Using local team list.");
        }
      } finally {
        if (!isCancelled) {
          setIsLiveCollegeTeamsLoading(false);
        }
      }
    }

    void loadCollegeTeams();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isCancelled = false;

    async function loadCalendarFeed() {
      setIsCalendarFeedLoading(true);
      setCalendarFeedError(null);

      try {
        const response = await fetch("/api/calendar/feed/token", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { feedUrl?: string; expiresAt?: string; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Could not load calendar feed URL.");
        }

        if (!isCancelled) {
          setCalendarFeedUrl(payload?.feedUrl ?? null);
          setCalendarFeedExpiresAt(payload?.expiresAt ?? null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setCalendarFeedUrl(null);
          setCalendarFeedExpiresAt(null);
          setCalendarFeedError(loadError instanceof Error ? loadError.message : "Could not load calendar feed URL.");
        }
      } finally {
        if (!isCancelled) {
          setIsCalendarFeedLoading(false);
        }
      }
    }

    void loadCalendarFeed();

    return () => {
      isCancelled = true;
    };
  }, [user]);

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
  const timezoneOptions = useMemo(() => getTimezoneOptions(profile?.timezone), [profile?.timezone]);
  const themeSource = themeSourceInput ?? normalizeThemeSource(profile?.themeMode, profile?.collegeTeamId ?? null);
  const currentDisplayMode: ThemeChoice =
    displayModeInput ?? ((profile?.theme === "cwm" ? "system" : profile?.theme) as ThemeChoice | undefined) ?? "system";
  const currentPalette: UserProfile["palette"] = paletteInput ?? profile?.palette ?? "ocean";
  const availableCollegeTeams = liveCollegeTeams?.length ? liveCollegeTeams : FALLBACK_COLLEGE_THEME_TEAMS;
  const availableCollegeTeamsById = useMemo(
    () => new Map(availableCollegeTeams.map((team) => [team.id, team])),
    [availableCollegeTeams],
  );
  const selectedCollegeTeamId = selectedCollegeTeamIdInput ?? (profile?.collegeTeamId ?? "");

  useEffect(() => {
    if (!profile) {
      return;
    }

    const previewTheme = currentDisplayMode === "system" ? "cwm" : currentDisplayMode;
    const previewSource = themeSource;
    const previewPalette = previewSource === "palette" ? currentPalette : profile.palette;
    const previewCollegeTeamId = previewSource === "college" ? selectedCollegeTeamId || null : null;
    const previewCollegeTeam =
      previewSource === "college" && previewCollegeTeamId
        ? availableCollegeTeamsById.get(previewCollegeTeamId) ?? null
        : null;
    const previewCollegeLogoUrl =
      previewSource === "college"
        ? previewCollegeTeam
          ? getCollegeTeamLogoUrl(previewCollegeTeam.id)
          : nullableValue(profile.collegeLogoUrl ?? null)
        : null;
    const previewCollegeTeamName =
      previewSource === "college"
        ? previewCollegeTeam?.displayName ?? nullableValue(profile.collegeTeamName ?? null)
        : null;

    applyThemeToDocument(previewTheme);
    applyProfileThemeTokens(previewSource, previewPalette, previewCollegeTeamId);

    onThemePreview?.({
      themeSource: previewSource,
      theme: previewTheme,
      palette: previewPalette,
      collegeTeamId: previewCollegeTeamId,
      collegeTeamName: previewCollegeTeamName,
      collegeLogoUrl: previewCollegeLogoUrl,
    });
  }, [
    availableCollegeTeamsById,
    currentDisplayMode,
    currentPalette,
    onThemePreview,
    profile,
    selectedCollegeTeamId,
    themeSource,
  ]);

  useEffect(() => {
    return () => {
      onThemePreview?.(null);
    };
  }, [onThemePreview]);

  const filteredCollegeTeams = useMemo(() => {
    const query = teamSearchQuery.trim().toLowerCase();

    return availableCollegeTeams.filter((team) => {
      if (teamSubdivisionFilter !== "all" && team.subdivision !== teamSubdivisionFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = `${team.displayName} ${team.abbreviation} ${team.subdivision}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [availableCollegeTeams, teamSearchQuery, teamSubdivisionFilter]);

  const calendarFeedWebcalUrl = toWebcalUrl(calendarFeedUrl);

  if (isLoading || isProfileLoading) {
    return (
      <section className="pdp-panel">
        <h2 className="text-lg font-semibold text-slate-900">Profile & Theme</h2>
        <p className="mt-3 text-sm text-slate-700">Loading your profile settings...</p>
      </section>
    );
  }

  if (error || !user || !profile) {
    return (
      <section className="pdp-panel rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Profile & Theme</h2>
        <p className="mt-2 text-sm text-red-700">
          {error?.message ?? "Profile settings could not be loaded yet. Sign out and in again to retry."}
        </p>
      </section>
    );
  }

  const currentUser = user;
  const currentProfile = profile;
  const selectedCollegeTeam = selectedCollegeTeamId ? availableCollegeTeamsById.get(selectedCollegeTeamId) : null;
  const previewThemeValue: "light" | "dark" | "cwm" = currentDisplayMode === "system" ? "cwm" : currentDisplayMode;
  const previewCollegeTeam =
    themeSource === "college"
      ? getCollegeTeamSelection(
          selectedCollegeTeam?.id ?? null,
          selectedCollegeTeam?.displayName ?? null,
          selectedCollegeTeam
            ? getCollegeTeamLogoUrl(selectedCollegeTeam.id)
            : nullableValue(currentProfile.collegeLogoUrl ?? null),
        )
      : null;
  const previewBrandSource: ThemeSource = themeSource;
  const previewBrandVisual = getBrandVisual(previewBrandSource, previewCollegeTeam, previewThemeValue);

  // Debounced auto-save for theme changes (short debounce so quick theme toggles feel instant)
  const themeAutosaveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !profile) return;

    const mappedTheme = currentDisplayMode === "system" ? "cwm" : currentDisplayMode;
    const selectedThemeSource = themeSource;
    const desiredSnapshot: ThemeBrandSnapshot = {
      themeSource: selectedThemeSource,
      theme: mappedTheme,
      palette: selectedThemeSource === "palette" ? currentPalette : profile.palette,
      collegeTeamId: selectedThemeSource === "college" ? (selectedCollegeTeam?.id ?? null) : null,
      collegeTeamName:
        selectedThemeSource === "college"
          ? (selectedCollegeTeam?.displayName ?? nullableValue(profile.collegeTeamName ?? null))
          : null,
      collegeLogoUrl:
        selectedThemeSource === "college"
          ? (selectedCollegeTeam ? getCollegeTeamLogoUrl(selectedCollegeTeam.id) : nullableValue(profile.collegeLogoUrl ?? null))
          : null,
    };

    const currentSnapshot: ThemeBrandSnapshot = {
      themeSource: normalizeThemeSource(profile.themeMode, profile.collegeTeamId ?? null),
      theme: profile.theme ?? "cwm",
      palette: profile.palette ?? "ocean",
      collegeTeamId: profile.collegeTeamId ?? null,
      collegeTeamName: profile.collegeTeamName ?? null,
      collegeLogoUrl: profile.collegeLogoUrl ?? null,
    };

    if (areThemeSnapshotsEqual(currentSnapshot, desiredSnapshot)) {
      return;
    }

    if (themeAutosaveTimeoutRef.current) {
      window.clearTimeout(themeAutosaveTimeoutRef.current);
    }

    themeAutosaveTimeoutRef.current = window.setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      setSaveMessage(null);

      try {
        await saveUserProfileToServer({
          themeMode: desiredSnapshot.themeSource,
          theme: desiredSnapshot.theme,
          palette: desiredSnapshot.palette,
          collegeTeamId: desiredSnapshot.collegeTeamId,
          collegeTeamName: desiredSnapshot.collegeTeamName,
          collegeLogoUrl: desiredSnapshot.collegeLogoUrl,
        });

        onThemeSaved?.(desiredSnapshot);
        setSaveMessage("Theme saved.");
      } catch (updateError) {
        setSaveError(getFriendlyProfileSaveError(updateError, "We could not save your theme selection."));
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => {
      if (themeAutosaveTimeoutRef.current) {
        window.clearTimeout(themeAutosaveTimeoutRef.current);
        themeAutosaveTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, themeSource, currentDisplayMode, currentPalette, selectedCollegeTeamId, availableCollegeTeamsById]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const displayMode = currentDisplayMode;
      const mappedTheme = displayMode === "system" ? "cwm" : displayMode;
      const selectedThemeSource = themeSource;
      const selectedPalette =
        selectedThemeSource === "palette"
          ? currentPalette
          : currentProfile.palette;
      const selectedCollegeLogoUrl =
        selectedThemeSource === "college"
          ? selectedCollegeTeam
            ? getCollegeTeamLogoUrl(selectedCollegeTeam.id)
            : nullableValue(formData.get("collegeLogoUrl"))
          : null;

      const updatedProfile = validateUserProfileWrite({
        uid: currentUser.id,
        email: currentUser.email ?? currentProfile.email,
        displayName: nullableValue(formData.get("displayName")) ?? currentUser.email ?? null,
        firstName: nullableValue(formData.get("firstName")),
        lastName: nullableValue(formData.get("lastName")),
        themeMode: selectedThemeSource,
        theme: mappedTheme,
        palette: selectedPalette,
        collegeTeamId: selectedThemeSource === "college" ? selectedCollegeTeam?.id ?? null : null,
        collegeTeamName: selectedThemeSource === "college" ? selectedCollegeTeam?.displayName ?? null : null,
        collegeLogoUrl: selectedCollegeLogoUrl,
        timezone: String(formData.get("timezone") ?? currentProfile.timezone).trim() || currentProfile.timezone,
        retentionDays: Number(formData.get("retentionDays") ?? currentProfile.retentionDays),
        createdAt: currentProfile.createdAt,
        updatedAt: new Date().toISOString(),
      });

      await saveUserProfileToServer({
        firstName: updatedProfile.firstName ?? null,
        lastName: updatedProfile.lastName ?? null,
        displayName: updatedProfile.displayName,
        themeMode: updatedProfile.themeMode,
        theme: updatedProfile.theme,
        palette: updatedProfile.palette,
        collegeTeamId: updatedProfile.collegeTeamId ?? null,
        collegeTeamName: updatedProfile.collegeTeamName ?? null,
        collegeLogoUrl: updatedProfile.collegeLogoUrl ?? null,
        timezone: updatedProfile.timezone,
        retentionDays: updatedProfile.retentionDays,
        createdAt: updatedProfile.createdAt,
      });

      onThemeSaved?.({
        themeSource: normalizeThemeSource(updatedProfile.themeMode, updatedProfile.collegeTeamId ?? null),
        theme: updatedProfile.theme,
        palette: updatedProfile.palette,
        collegeTeamId: updatedProfile.collegeTeamId ?? null,
        collegeTeamName: updatedProfile.collegeTeamName ?? null,
        collegeLogoUrl: updatedProfile.collegeLogoUrl ?? null,
      });

      setSaveMessage("Profile preferences saved.");
    } catch (updateError) {
      setSaveError(getFriendlyProfileSaveError(updateError, "We could not save your profile updates."));
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
        const failedLabel = formatOfflineOperationLabel(result.failedOperation);
        const reason = getFriendlySyncFailureReason(result.failedError);
        const diagnosticCode = getOfflineSyncDiagnosticCode(result.failedError);
        setSyncMessage(
          `Sync paused on ${failedLabel}. ${result.remaining} change(s) remain queued. ${reason} (${diagnosticCode})`,
        );
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

  async function handleRotateCalendarFeed() {
    setCalendarFeedCopyMessage(null);
    setCalendarFeedSetupMessage(null);
    setCalendarFeedCheckMessage(null);
    setCalendarFeedRotateMessage(null);
    setIsCalendarFeedLoading(true);
    setCalendarFeedError(null);

    try {
      const response = await fetch("/api/calendar/feed/token", {
        method: "POST",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | { feedUrl?: string; expiresAt?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Could not rotate calendar feed URL.");
      }

      setCalendarFeedUrl(payload?.feedUrl ?? null);
      setCalendarFeedExpiresAt(payload?.expiresAt ?? null);
      setCalendarFeedRotateMessage("Feed URL revoked and rotated. Previously shared links are now invalid.");
      return true;
    } catch (refreshError) {
      setCalendarFeedError(refreshError instanceof Error ? refreshError.message : "Could not rotate calendar feed URL.");
      return false;
    } finally {
      setIsCalendarFeedLoading(false);
    }
  }

  async function handleCopyCalendarFeed() {
    if (!calendarFeedUrl) {
      return;
    }

    setCalendarFeedCopyMessage(null);
    setCalendarFeedSetupMessage(null);
    setCalendarFeedCheckMessage(null);

    try {
      await navigator.clipboard.writeText(calendarFeedUrl);
      setCalendarFeedCopyMessage("Feed URL copied.");
    } catch {
      setCalendarFeedCopyMessage("Copy failed. Select and copy the URL manually.");
    }
  }

  async function handleCopyCalendarSetupLink(link: string, label: string) {
    setCalendarFeedCopyMessage(null);
    setCalendarFeedSetupMessage(null);
    setCalendarFeedCheckMessage(null);

    try {
      await navigator.clipboard.writeText(link);
      setCalendarFeedSetupMessage(`${label} copied.`);
    } catch {
      setCalendarFeedSetupMessage(`Could not copy ${label.toLowerCase()}. Copy from the feed field above.`);
    }
  }

  async function handleCheckCalendarFeed() {
    if (!calendarFeedUrl) {
      return;
    }

    setCalendarFeedCopyMessage(null);
    setCalendarFeedSetupMessage(null);
    setCalendarFeedRotateMessage(null);
    setCalendarFeedCheckMessage(null);
    setCalendarFeedError(null);
    setIsCalendarFeedChecking(true);

    try {
      const response = await fetch(calendarFeedUrl, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Feed check failed (${response.status}).`);
      }

      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      if (!contentType.includes("text/calendar") || !body.includes("BEGIN:VCALENDAR")) {
        throw new Error("Feed URL responded, but did not return valid ICS content.");
      }

      setCalendarFeedCheckMessage("Feed check passed. Subscription URL is reachable and returns calendar data.");
    } catch (checkError) {
      setCalendarFeedError(checkError instanceof Error ? checkError.message : "Feed check failed.");
    } finally {
      setIsCalendarFeedChecking(false);
    }
  }

  function handleOpenPushNotifications() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem("pdp.installNotify.dismissedAt");
    window.dispatchEvent(new Event(OPEN_PUSH_SETTINGS_EVENT));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="pdp-panel">
      <h2 className="text-lg font-semibold text-slate-900">Profile & Theme</h2>
      <p className="mt-2 text-sm text-slate-600">Manage identity details separately from visual theme configuration.</p>

      <form className="mt-4 grid gap-3" onSubmit={handleSave}>
        <section className="pdp-panel-muted grid gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Profile</h3>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              First name
              <input
                name="firstName"
                defaultValue={currentProfile.firstName ?? ""}
                className="pdp-control mt-1"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Last name
              <input
                name="lastName"
                defaultValue={currentProfile.lastName ?? ""}
                className="pdp-control mt-1"
              />
            </label>
          </div>

          <label className="text-sm font-medium text-slate-700">
            Display name
            <input
              name="displayName"
              defaultValue={currentProfile.displayName ?? ""}
              className="pdp-control mt-1"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Timezone
              <select
                name="timezone"
                defaultValue={currentProfile.timezone}
                className="pdp-control mt-1"
              >
                {timezoneOptions.map((timezoneValue) => (
                  <option key={timezoneValue} value={timezoneValue}>
                    {timezoneValue}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Retention days
              <input
                name="retentionDays"
                type="number"
                min={1}
                defaultValue={currentProfile.retentionDays}
                className="pdp-control mt-1"
              />
            </label>
          </div>

          <label className="text-sm font-medium text-slate-700 md:max-w-sm">
            Display mode
            <select
              name="displayMode"
              value={currentDisplayMode}
              onChange={(event) => setDisplayModeInput(event.target.value as ThemeChoice)}
              className="pdp-control mt-1"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        </section>

        <hr className="my-1 border-slate-200" />

        <section className="pdp-panel-muted grid gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Theme</h3>

          <div className="pdp-card rounded-xl p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Theme branding preview</p>
            {previewBrandVisual.logoUrl ? (
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <Image
                    src={previewBrandVisual.logoUrl}
                    alt={previewBrandVisual.label}
                    width={56}
                    height={56}
                    className="h-full w-full object-contain p-1"
                  />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{previewBrandVisual.label}</p>
                  <p className="text-xs text-slate-600">
                    This is the logo shown in the header after saving your theme settings.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                No theme logo is active for this selection. Choose CWM or select a college team to show branding.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Theme base</p>
            <div className="mt-1 inline-flex rounded-lg border border-slate-300 bg-white p-1">
              {([
                { value: "palette" as const, label: "Palette" },
                { value: "cwm" as const, label: "CWM" },
                { value: "college" as const, label: "College Team" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setThemeSourceInput(option.value)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    themeSource === option.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {themeSource === "palette" ? (
            <label className="text-sm font-medium text-slate-700 md:max-w-sm">
              Palette
              <select
                name="palette"
                value={currentPalette}
                onChange={(event) => setPaletteInput(event.target.value as UserProfile["palette"])}
                className="pdp-control mt-1"
              >
                {PALETTE_OPTIONS.map((palette) => (
                  <option key={palette} value={palette}>
                    {capitalize(palette)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {themeSource === "cwm" ? (
            <div className="pdp-panel-muted text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <Image
                    src="/cwm-logo.png"
                    alt="CWM logo"
                    width={36}
                    height={36}
                    className="h-full w-full object-contain p-1"
                  />
                </span>
                <p>CWM uses the default app visual settings and does not require additional theme options.</p>
              </div>
            </div>
          ) : null}

          {themeSource === "college" ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Team filter</p>
                  <div className="pdp-card mt-1 inline-flex rounded-lg p-1">
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
                  Search teams
                  <input
                    value={teamSearchQuery}
                    onChange={(event) => setTeamSearchQuery(event.target.value)}
                    placeholder="Search school or abbreviation"
                    className="pdp-control mt-1"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-1">
                    <span>College logo URL override (optional)</span>
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-600"
                      title="Use this only when you need a custom logo URL. By default, the app derives logos from the selected college team."
                      aria-label="Use this only when you need a custom logo URL. By default, the app derives logos from the selected college team."
                    >
                      i
                    </span>
                  </span>
                  <input
                    name="collegeLogoUrl"
                    defaultValue={currentProfile.collegeLogoUrl ?? ""}
                    placeholder="https://a.espncdn.com/..."
                    className="pdp-control mt-1"
                  />
                </label>
              </div>

              <input type="hidden" name="collegeTeamId" value={selectedCollegeTeamId} />

              <section className="pdp-panel-muted">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">College team picker</h3>
                  <p className="text-xs text-slate-500">Showing {filteredCollegeTeams.length} team(s)</p>
                </div>

                {isLiveCollegeTeamsLoading ? (
                  <p className="mt-2 text-xs text-slate-500">Loading latest team catalog...</p>
                ) : null}
                {liveCollegeTeamsError ? <p className="mt-2 text-xs text-amber-700">{liveCollegeTeamsError}</p> : null}

                {selectedCollegeTeam ? (
                  <div className="pdp-card mt-3 rounded-lg p-2">
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

                <div className="mt-3 h-[22rem] overflow-y-auto pr-1">
                  {filteredCollegeTeams.length === 0 ? (
                    <p className="text-sm text-slate-600">No teams match your current search and subdivision filter.</p>
                  ) : (
                    <div className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                  )}
                </div>
              </section>
            </>
          ) : null}
        </section>

        {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}
        {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <IconButton
              type="submit"
              variant="primary"
              disabled={isSaving}
              title={isSaving ? "Saving..." : "Save profile"}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </IconButton>
            <IconButton
              onClick={() => void handleManualSync()}
              disabled={isSyncing || pendingSyncCount === 0}
              title={isSyncing ? "Syncing..." : "Sync now"}
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </IconButton>
            <span className="text-xs text-slate-500">Queued changes: {pendingSyncCount}</span>
          </div>
          {syncMessage ? <p className="mt-2 text-sm text-slate-600">{syncMessage}</p> : null}
        </div>

        <section className="pdp-panel-muted grid gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Calendar Subscription Feed</h3>
          <p className="text-sm text-slate-600">
            Use this private ICS URL in Apple Calendar, Outlook, or Google Calendar subscriptions. Anyone with this URL
            can read your calendar events, so treat it like a password.
          </p>

          {isCalendarFeedLoading ? <p className="text-sm text-slate-600">Loading feed URL...</p> : null}
          {calendarFeedError ? <p className="text-sm text-red-700">{calendarFeedError}</p> : null}

          {calendarFeedUrl ? (
            <>
              <label className="text-sm font-medium text-slate-700">
                Feed URL
                <input
                  readOnly
                  value={calendarFeedUrl}
                  className="pdp-control mt-1"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <IconButton
                  onClick={() => void handleCopyCalendarFeed()}
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </IconButton>
                <a
                  href={calendarFeedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                >
                  Open Feed
                </a>
                <IconButton
                  onClick={() => void handleCheckCalendarFeed()}
                  disabled={isCalendarFeedLoading || isCalendarFeedChecking}
                  title={isCalendarFeedChecking ? "Checking..." : "Validate Feed"}
                >
                  {isCalendarFeedChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                </IconButton>
                <CalendarFeedRotationControl
                  isLoading={isCalendarFeedLoading}
                  onPrepareRotate={() => {
                    setCalendarFeedRotateMessage(null);
                    setCalendarFeedError(null);
                  }}
                  onRotate={handleRotateCalendarFeed}
                />
              </div>

              {calendarFeedExpiresAt ? (
                <p className="text-xs text-slate-500">Token expires: {new Date(calendarFeedExpiresAt).toLocaleString()}</p>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Calendar client setup</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <IconButton
                      onClick={() => void handleCopyCalendarSetupLink(calendarFeedUrl, "HTTPS URL")}
                      title="Copy HTTPS"
                    >
                      <Copy className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      onClick={() => (calendarFeedWebcalUrl ? void handleCopyCalendarSetupLink(calendarFeedWebcalUrl, "webcal URL") : undefined)}
                      disabled={!calendarFeedWebcalUrl}
                      title="Copy webcal"
                    >
                      <Copy className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <article className="rounded-lg border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Apple Calendar</p>
                    <p className="mt-1 text-xs text-slate-600">File &gt; New Calendar Subscription, then paste webcal (or HTTPS).</p>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Google Calendar</p>
                    <p className="mt-1 text-xs text-slate-600">Settings &gt; Add calendar &gt; From URL, then paste the HTTPS URL.</p>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Outlook</p>
                    <p className="mt-1 text-xs text-slate-600">Add calendar &gt; Subscribe from web, then paste HTTPS or webcal URL.</p>
                  </article>
                </div>
              </div>

              {calendarFeedCopyMessage ? <p className="text-xs text-slate-600">{calendarFeedCopyMessage}</p> : null}
              {calendarFeedSetupMessage ? <p className="text-xs text-slate-600">{calendarFeedSetupMessage}</p> : null}
              {calendarFeedCheckMessage ? <p className="text-xs text-emerald-700">{calendarFeedCheckMessage}</p> : null}
              {calendarFeedRotateMessage ? <p className="text-xs text-emerald-700">{calendarFeedRotateMessage}</p> : null}
            </>
          ) : null}
        </section>

        <section className="pdp-panel-muted grid gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Install App</h3>
          <p className="text-sm text-slate-600">
            Install PDP on your home screen for a native app feel, faster launch, and better notification support.
          </p>

          <div className="grid gap-2 md:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">iPhone / iPad</p>
              <p className="mt-1 text-xs text-slate-600">Open in Safari, tap Share, choose Add to Home Screen, then tap Add.</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Android</p>
              <p className="mt-1 text-xs text-slate-600">Open in Chrome, tap Install app or use browser menu then Add to Home screen.</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Desktop</p>
              <p className="mt-1 text-xs text-slate-600">Use the browser install icon in the address bar to install PDP as an app.</p>
            </article>
          </div>

          <p className="text-xs text-slate-500">
            Install check: if the app opens without browser URL controls, it is running as an installed app.
          </p>
        </section>

        <section className="pdp-panel-muted grid gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Push Notifications</h3>
          <p className="text-sm text-slate-600">
            Open push notification settings anytime to enable reminders, adjust quiet hours, or review recent delivery activity.
          </p>
          <div>
            <button
              type="button"
              onClick={handleOpenPushNotifications}
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
            >
              Manage Push Notifications
            </button>
          </div>
        </section>

        <SchedulerHealthCard />
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
        themeMode?: ThemeSource;
        theme?: "light" | "dark" | "cwm";
        palette?: UserProfile["palette"];
        collegeTeamId?: string | null;
        collegeTeamName?: string | null;
        collegeLogoUrl?: string | null;
        timezone?: string;
        retentionDays?: number;
        createdAt?: string;
        id?: string;
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
        themeMode: profile?.themeMode ?? "palette",
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

      await saveUserProfileToServer({
        firstName: validatedProfile.firstName ?? null,
        lastName: validatedProfile.lastName ?? null,
        displayName: validatedProfile.displayName,
        themeMode: validatedProfile.themeMode,
        theme: validatedProfile.theme,
        palette: validatedProfile.palette,
        collegeTeamId: validatedProfile.collegeTeamId ?? null,
        collegeTeamName: validatedProfile.collegeTeamName ?? null,
        collegeLogoUrl: validatedProfile.collegeLogoUrl ?? null,
        timezone: validatedProfile.timezone,
        retentionDays: validatedProfile.retentionDays,
        createdAt: validatedProfile.createdAt,
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError, "We could not save your onboarding details."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 items-center px-2.5 py-3 sm:px-4 md:px-8 md:py-10">
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
  const fallbackLogoUrl = allowlistTeam
    ? allowlistTeam.logoUrl ?? getCollegeTeamLogoUrl(allowlistTeam.id)
    : null;

  return {
    id: allowlistTeam?.id ?? collegeTeamId ?? "",
    displayName: allowlistTeam?.displayName ?? collegeTeamName ?? "College Team",
    logoUrl: collegeLogoUrl ?? fallbackLogoUrl,
    darkLogoUrl: allowlistTeam?.darkLogoUrl ?? allowlistTeam?.logoUrl ?? fallbackLogoUrl,
  };
}

function getBrandVisual(
  themeSource: ThemeSource,
  selectedCollegeTeam:
    | {
        id: string;
        displayName: string;
        logoUrl: string | null;
        darkLogoUrl?: string | null;
      }
    | null,
  theme: "light" | "dark" | "cwm",
): BrandVisual {
  if (themeSource === "cwm") {
    return {
      label: "CWM brand mark",
      logoUrl: "/cwm-logo.png",
      watermarkUrl: "/cwm-logo.png",
      watermarkOpacity: 0.5,
      watermarkScale: 1,
    };
  }

  if (themeSource === "college" && selectedCollegeTeam) {
    const isDark = theme === "dark";
    const brandLogoUrl = isDark ? selectedCollegeTeam.darkLogoUrl ?? selectedCollegeTeam.logoUrl : selectedCollegeTeam.logoUrl;

    return {
      label: `${selectedCollegeTeam.displayName} brand mark`,
      logoUrl: brandLogoUrl ?? selectedCollegeTeam.logoUrl,
      watermarkUrl: brandLogoUrl ?? selectedCollegeTeam.logoUrl,
      watermarkOpacity: 0.5,
      watermarkScale: isDark ? 1.04 : 1,
    };
  }

  return {
    label: "PDP brand mark",
    logoUrl: null,
    watermarkUrl: null,
    watermarkOpacity: 0,
    watermarkScale: 1,
  };
}

function getCollegeTeamLogoUrl(teamId: string) {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

function normalizeThemeSource(themeMode: string | null | undefined, collegeTeamId: string | null): ThemeSource {
  if (themeMode === "palette" || themeMode === "cwm" || themeMode === "college") {
    return themeMode;
  }

  if (collegeTeamId) {
    return "college";
  }

  return "palette";
}

function normalizeStoredTheme(theme: string | null | undefined): "light" | "dark" | "cwm" {
  if (theme === "light" || theme === "dark" || theme === "cwm") {
    return theme;
  }

  return "cwm";
}

function normalizeStoredPalette(palette: string | null | undefined): UserProfile["palette"] {
  return PALETTE_OPTIONS.includes(palette as UserProfile["palette"])
    ? (palette as UserProfile["palette"])
    : "ocean";
}


function toWebcalUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return `webcal://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function readCachedTheme(): "light" | "dark" | "cwm" | null {
  if (typeof window === "undefined") {
    return null;
  }

  const cachedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return cachedTheme === "light" || cachedTheme === "dark" || cachedTheme === "cwm" ? cachedTheme : null;
}

function readCachedPalette(): UserProfile["palette"] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const cachedPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY);
  return cachedPalette ? normalizeStoredPalette(cachedPalette) : null;
}

function readActiveSectionPreference(): AppSection {
  if (typeof window === "undefined") {
    return "dashboard";
  }

  const stored = window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
  if (
    stored === "dashboard" ||
    stored === "goals" ||
    stored === "node-map" ||
    stored === "calendar" ||
    stored === "habits" ||
    stored === "journal"
  ) {
    return stored;
  }

  return "dashboard";
}

function toThemeChoice(theme: "light" | "dark" | "cwm"): ThemeChoice {
  return theme === "cwm" ? "system" : theme;
}

function getNextThemeChoice(current: ThemeChoice): ThemeChoice {
  if (current === "light") {
    return "dark";
  }
  if (current === "dark") {
    return "system";
  }
  return "light";
}

type UserProfileServerPatch = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  themeMode?: ThemeSource | null;
  theme?: "light" | "dark" | "cwm";
  palette?: UserProfile["palette"];
  collegeTeamId?: string | null;
  collegeTeamName?: string | null;
  collegeLogoUrl?: string | null;
  timezone?: string;
  retentionDays?: number;
  createdAt?: string;
};

async function saveUserProfileToServer(patch: UserProfileServerPatch) {
  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (response.ok) {
    return;
  }

  let errorMessage = "We could not save your profile updates.";

  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      errorMessage = payload.error;
    }
  } catch {
    // Keep default fallback message when server response is not JSON.
  }

  throw new Error(errorMessage);
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

function getWelcomeFirstName(firstName: string | null, displayName: string | null, email: string | null) {
  const fromFirstName = (firstName ?? "").trim();
  if (fromFirstName.length > 0) {
    return fromFirstName;
  }

  const fromDisplayName = (displayName ?? "").trim();
  if (fromDisplayName.length > 0) {
    return fromDisplayName.split(/\s+/)[0] ?? "there";
  }

  const fromEmail = (email ?? "").trim();
  if (fromEmail.length > 0) {
    const localPart = fromEmail.split("@")[0] ?? "";
    if (localPart.length > 0) {
      return capitalize(localPart);
    }
  }

  return "there";
}

function areThemeSnapshotsEqual(
  current: ThemeBrandSnapshot | null,
  next: ThemeBrandSnapshot | null,
) {
  if (current === next) {
    return true;
  }

  if (!current || !next) {
    return false;
  }

  return (
    current.themeSource === next.themeSource &&
    current.theme === next.theme &&
    current.palette === next.palette &&
    current.collegeTeamId === next.collegeTeamId &&
    current.collegeTeamName === next.collegeTeamName &&
    current.collegeLogoUrl === next.collegeLogoUrl
  );
}

function applyThemeToDocument(theme: "light" | "dark" | "cwm") {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  if (theme === "cwm") {
    const prefersDark = typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
    root.dataset.theme = prefersDark ? "dark" : "light";
    return;
  }

  root.dataset.theme = theme;
}

function applyProfileThemeTokens(
  themeSource: ThemeSource,
  palette: UserProfile["palette"],
  collegeTeamId: string | null,
) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const isDark = root.dataset.theme === "dark";
  root.dataset.themeSource = themeSource;

  const neutral = themeSource === "cwm"
    ? {
        surface: "#2d2c25",
        mutedSurface: "#182c28",
        border: "rgba(229, 225, 214, 0.4)",
        background: "#2d2c25",
        foreground: "#f5f2e8",
        textStrong: "#f5f2e8",
        text: "#e5e1d6",
        textMuted: "#b4afa0",
      }
    : isDark
      ? {
          surface: "#171717",
          mutedSurface: "#202020",
          border: "#3f3f46",
          background: "#111111",
          foreground: "#fafafa",
          textStrong: "#fafafa",
          text: "#e5e5e5",
          textMuted: "#a3a3a3",
        }
      : {
          surface: "#ffffff",
          mutedSurface: "#f8fafc",
          border: "#cbd5e1",
          background: "#ffffff",
          foreground: "#171717",
          textStrong: "#0f172a",
          text: "#334155",
          textMuted: "#64748b",
        };

  let primary = "#0f172a";
  let soft = isDark ? "#1e293b" : "#e2e8f0";

  if (themeSource === "palette") {
    const tokens = PALETTE_THEME_TOKENS[palette] ?? PALETTE_THEME_TOKENS.ocean;
    primary = tokens.primary;
    soft = tokens.soft;
  }

  if (themeSource === "college" && collegeTeamId) {
    const selectedTeam = COLLEGE_TEAMS_BY_ID.get(collegeTeamId);
    const teamPrimary = normalizeHexColor(selectedTeam?.colors?.primary);
    const teamSecondary = normalizeHexColor(selectedTeam?.colors?.secondary);

    primary = teamPrimary ?? primary;
    soft = teamSecondary ?? (isDark ? blendHex(primary, "#202020", 0.28) : blendHex(primary, "#ffffff", 0.26));
  }

  if (themeSource === "cwm") {
    primary = "#ffd400";
    soft = "#1e4741";
  }

  const resolvedBackground =
    themeSource === "cwm"
      ? neutral.background
      : isDark
        ? blendHex(primary, "#05070d", 0.17)
        : neutral.background;

  const tintedBorder =
    themeSource === "cwm"
      ? neutral.border
      : isDark
        ? blendHex(primary, neutral.border, 0.4)
        : blendHex(primary, neutral.border, 0.74);
  const tintedMutedSurface =
    themeSource === "cwm"
      ? neutral.mutedSurface
      : themeSource === "college"
        ? isDark
          ? blendHex(soft, neutral.mutedSurface, 0.18)
          : blendHex(soft, neutral.mutedSurface, 0.28)
        : isDark
          ? blendHex(soft, neutral.mutedSurface, 0.14)
          : blendHex(soft, neutral.mutedSurface, 0.22);

  const eventGoalProfessionalBackground =
    themeSource === "cwm" ? "#1e4741" : blendHex(primary, isDark ? "#2563eb" : "#2563eb", 0.5);
  const eventGoalProfessionalBorder = blendHex(eventGoalProfessionalBackground, neutral.border, 0.68);
  const eventGoalPersonalBackground =
    themeSource === "cwm" ? "#1e4741" : blendHex(primary, isDark ? "#db2777" : "#db2777", 0.42);
  const eventGoalPersonalBorder = blendHex(eventGoalPersonalBackground, neutral.border, 0.68);
  const eventChildGoalBackground =
    themeSource === "cwm" ? "#ffd400" : blendHex(primary, isDark ? "#f59e0b" : "#f59e0b", 0.38);
  const eventChildGoalBorder = blendHex(eventChildGoalBackground, neutral.border, 0.68);
  const eventTaskBackground =
    themeSource === "cwm" ? "#1e4741" : blendHex(primary, isDark ? "#059669" : "#059669", 0.38);
  const eventTaskBorder = blendHex(eventTaskBackground, neutral.border, 0.68);

  const statusNotStartedBackground = themeSource === "cwm" ? "#23221c" : blendHex(primary, neutral.mutedSurface, isDark ? 0.2 : 0.16);
  const statusNotStartedText = chooseAccessibleTextColor(
    statusNotStartedBackground,
    neutral.text,
    neutral.textStrong,
    isDark ? "#f8fafc" : "#0f172a",
  );
  const statusProgressBackground = themeSource === "cwm" ? "#1e4741" : blendHex(eventGoalProfessionalBackground, neutral.mutedSurface, isDark ? 0.34 : 0.26);
  const statusProgressText = chooseAccessibleTextColor(
    statusProgressBackground,
    isDark ? "#dbeafe" : "#1e40af",
    neutral.textStrong,
    isDark ? "#f8fafc" : "#0f172a",
  );
  const statusDoneBackground = themeSource === "cwm" ? "#182c28" : blendHex(eventTaskBackground, neutral.mutedSurface, isDark ? 0.34 : 0.26);
  const statusDoneText = chooseAccessibleTextColor(
    statusDoneBackground,
    isDark ? "#dcfce7" : "#166534",
    neutral.textStrong,
    isDark ? "#f8fafc" : "#0f172a",
  );
  const headerKickerText = isDark && getContrastRatio(primary, neutral.surface) < 4.5
    ? neutral.textStrong
    : primary;

  root.style.setProperty("--background", resolvedBackground);
  root.style.setProperty("--foreground", neutral.foreground);
  root.style.setProperty("--pdp-theme-primary", primary);
  root.style.setProperty("--pdp-theme-soft", soft);
  root.style.setProperty("--pdp-surface", neutral.surface);
  root.style.setProperty("--pdp-muted-surface", tintedMutedSurface);
  root.style.setProperty("--pdp-border", tintedBorder);
  root.style.setProperty("--pdp-text-strong", neutral.textStrong);
  root.style.setProperty("--pdp-text", neutral.text);
  root.style.setProperty("--pdp-text-muted", neutral.textMuted);
  root.style.setProperty("--pdp-event-goal-professional-bg", eventGoalProfessionalBackground);
  root.style.setProperty("--pdp-event-goal-professional-border", eventGoalProfessionalBorder);
  root.style.setProperty("--pdp-event-goal-personal-bg", eventGoalPersonalBackground);
  root.style.setProperty("--pdp-event-goal-personal-border", eventGoalPersonalBorder);
  root.style.setProperty("--pdp-event-childGoal-bg", eventChildGoalBackground);
  root.style.setProperty("--pdp-event-childGoal-border", eventChildGoalBorder);
  root.style.setProperty("--pdp-event-task-bg", eventTaskBackground);
  root.style.setProperty("--pdp-event-task-border", eventTaskBorder);
  root.style.setProperty("--pdp-status-not-started-bg", statusNotStartedBackground);
  root.style.setProperty("--pdp-status-not-started-text", statusNotStartedText);
  root.style.setProperty("--pdp-status-progress-bg", statusProgressBackground);
  root.style.setProperty("--pdp-status-progress-text", statusProgressText);
  root.style.setProperty("--pdp-status-done-bg", statusDoneBackground);
  root.style.setProperty("--pdp-status-done-text", statusDoneText);
  root.style.setProperty("--pdp-header-kicker-text", headerKickerText);
}

function getFriendlyProfileSaveError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("not perms-pass")) {
    return "We could not save that change because app permissions rejected it. Please refresh and try again.";
  }

  return getErrorMessage(error, fallback);
}

function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/^#/, "").trim();
  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned.toLowerCase()}` : null;
}

function blendHex(foreground: string, background: string, foregroundWeight: number): string {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) {
    return background;
  }

  const weight = Math.min(Math.max(foregroundWeight, 0), 1);
  const inverse = 1 - weight;

  const mix = (a: number, b: number) => Math.round(a * weight + b * inverse);

  return rgbToHex(mix(fg.r, bg.r), mix(fg.g, bg.g), mix(fg.b, bg.b));
}

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) {
    return null;
  }

  const hex = normalized.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function chooseAccessibleTextColor(background: string, preferred: string, fallback: string, emergency: string): string {
  const candidates = [preferred, fallback, emergency];
  let bestColor = preferred;
  let bestContrast = 0;

  for (const color of candidates) {
    const contrast = getContrastRatio(color, background);
    if (contrast >= 4.5) {
      return color;
    }

    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestColor = color;
    }
  }

  return bestColor;
}

function getContrastRatio(foreground: string, background: string): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) {
    return 21;
  }

  const fgLuminance = getRelativeLuminance(fg.r, fg.g, fg.b);
  const bgLuminance = getRelativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const rs = normalize(r);
  const gs = normalize(g);
  const bs = normalize(b);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
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
  type: SectionIconType;
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

  if (type === "node-map") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <circle cx="5" cy="6" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M7 6h10M6.7 7.4 10.8 16M17.3 7.4 13.2 16" />
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

  if (type === "habits") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m8 12 3 3 5-6" />
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
