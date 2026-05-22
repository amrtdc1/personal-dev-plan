import allowlistData from "@/lib/theming/data/espn-d1-allowlist.json";

const ALLOWED_LOGO_HOSTS = new Set([
  "a.espncdn.com",
  "a1.espncdn.com",
  "site.api.espn.com",
  "site.web.api.espn.com",
]);

type EspnLogo = {
  href?: string;
  rel?: string[];
};

type EspnTeam = {
  id?: string;
  displayName?: string;
  abbreviation?: string;
  slug?: string;
  color?: string;
  alternateColor?: string;
  logos?: EspnLogo[];
};

type EspnTeamsPayload = {
  sports?: Array<{
    leagues?: Array<{
      teams?: Array<{
        team?: EspnTeam;
      }>;
    }>;
  }>;
};

type D1AllowlistEntry = {
  id: string;
  displayName: string;
  abbreviation: string;
  subdivision: "FBS" | "FCS";
};

export type CollegeThemeTeam = {
  id: string;
  displayName: string;
  abbreviation: string;
  slug: string;
  subdivision: "FBS" | "FCS";
  logoUrl: string | null;
  darkLogoUrl: string | null;
  colors: {
    primary: string | null;
    secondary: string | null;
  };
};

const ALLOWLIST_ENTRIES: D1AllowlistEntry[] = (allowlistData.teams ?? []) as D1AllowlistEntry[];
const ALLOWLIST_BY_ID = new Map(ALLOWLIST_ENTRIES.map((entry) => [entry.id, entry]));
const STATIC_COLLEGE_THEME_TEAMS: CollegeThemeTeam[] = [...((allowlistData.teams ?? []) as CollegeThemeTeam[])].sort(
  (a, b) => a.displayName.localeCompare(b.displayName)
);

function normalizeHex(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function pickLogo(team: EspnTeam, preferredRel: string): string | null {
  const logos = Array.isArray(team.logos) ? team.logos : [];

  const exactRel = logos.find((logo) => Array.isArray(logo.rel) && logo.rel.includes(preferredRel));
  if (exactRel?.href) {
    return sanitizeCollegeLogoUrl(exactRel.href);
  }

  const fullDefault = logos.find(
    (logo) => Array.isArray(logo.rel) && logo.rel.includes("full") && logo.rel.includes("default")
  );
  if (fullDefault?.href) {
    return sanitizeCollegeLogoUrl(fullDefault.href);
  }

  const firstLogoHref = logos.find((logo) => typeof logo.href === "string")?.href;
  return sanitizeCollegeLogoUrl(firstLogoHref);
}

export function sanitizeCollegeLogoUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return null;
    }

    if (!ALLOWED_LOGO_HOSTS.has(parsed.hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeTeam(team: EspnTeam, allowlistEntry: D1AllowlistEntry): CollegeThemeTeam {
  return {
    id: allowlistEntry.id,
    displayName: team.displayName ?? allowlistEntry.displayName,
    abbreviation: team.abbreviation ?? allowlistEntry.abbreviation,
    slug: team.slug ?? "",
    subdivision: allowlistEntry.subdivision,
    logoUrl: pickLogo(team, "primary_logo_on_white_color"),
    darkLogoUrl: pickLogo(team, "primary_logo_on_black_color"),
    colors: {
      primary: normalizeHex(team.color),
      secondary: normalizeHex(team.alternateColor),
    },
  };
}

export function normalizeEspnCollegeTeams(payload: EspnTeamsPayload): CollegeThemeTeam[] {
  const rawTeams = payload.sports?.[0]?.leagues?.[0]?.teams ?? [];
  const normalizedTeams: CollegeThemeTeam[] = [];

  for (const rawTeam of rawTeams) {
    const team = rawTeam.team;
    if (!team?.id) {
      continue;
    }

    const allowlistEntry = ALLOWLIST_BY_ID.get(team.id);
    if (!allowlistEntry) {
      continue;
    }

    normalizedTeams.push(normalizeTeam(team, allowlistEntry));
  }

  normalizedTeams.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return normalizedTeams;
}

export async function fetchEspnCollegeTeams(fetchImpl: typeof fetch = fetch): Promise<CollegeThemeTeam[]> {
  void fetchImpl;
  return STATIC_COLLEGE_THEME_TEAMS;
}

export function getD1AllowlistIds(): string[] {
  return ALLOWLIST_ENTRIES.map((entry) => entry.id);
}
