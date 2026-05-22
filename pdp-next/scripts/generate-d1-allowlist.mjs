/**
 * generate-d1-allowlist.mjs
 *
 * Reads core-team-details.json (produced by fetch-core-team-details.mjs)
 * and generates src/lib/theming/data/espn-d1-allowlist.json.
 *
 * Usage:
 *   node scripts/generate-d1-allowlist.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEAM_DETAILS_FILE = path.join(__dirname, "core-team-details.json");
const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "theming",
  "data",
  "espn-d1-allowlist.json"
);

// ---------------------------------------------------------------------------
// Color normalization
// ---------------------------------------------------------------------------

function normalizeHex(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^#/, "").trim();
  return cleaned.length === 6 && /^[0-9a-fA-F]{6}$/.test(cleaned)
    ? `#${cleaned.toLowerCase()}`
    : null;
}

// ---------------------------------------------------------------------------
// Logo selection — prefer white-bg version for light theming
// ---------------------------------------------------------------------------

function selectLogos(logos) {
  const find = (...rels) =>
    logos.find((l) =>
      rels.every((r) => (l.rel ?? []).includes(r))
    )?.href ?? null;

  return {
    default:
      find("full", "primary_logo_on_white_color") ??
      find("full", "default") ??
      logos[0]?.href ??
      null,
    dark:
      find("full", "primary_logo_on_black_color") ??
      find("full", "dark") ??
      null,
  };
}

function isEligibleCollegeTeam(team) {
  const displayName = String(team.displayName ?? "").trim();
  const abbreviation = String(team.abbreviation ?? "").trim();
  const slug = String(team.slug ?? "").trim().toLowerCase();

  if (!displayName) return false;
  if (/all[- ]stars?/i.test(displayName)) return false;
  if (/^team\s+/i.test(displayName)) return false;
  if (/^(american|national|tba)$/i.test(displayName)) return false;
  if (/^tba$/i.test(abbreviation)) return false;
  if (slug.includes("all-stars") || slug.endsWith("-stars")) return false;
  if (slug === "american" || slug === "national" || slug === "tba") return false;

  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let teamDetails;
  try {
    const raw = await fs.readFile(TEAM_DETAILS_FILE, "utf-8");
    teamDetails = JSON.parse(raw);
  } catch {
    console.error(`Cannot read ${TEAM_DETAILS_FILE}.`);
    console.error("Run: node scripts/fetch-core-team-details.mjs first.");
    process.exit(1);
  }

  const teams = Object.values(teamDetails);
  console.log(`Loaded ${teams.length} teams from core-team-details.json`);

  const allowlistTeams = [];
  let excluded = 0;

  for (const team of teams) {
    const id = String(team.id ?? "");
    if (!id) continue;

    const subdivision = team.subdivision; // "FBS" | "FCS"
    if (subdivision !== "FBS" && subdivision !== "FCS") continue;
    if (!isEligibleCollegeTeam(team)) {
      excluded++;
      continue;
    }

    const logos = selectLogos(team.logos ?? []);
    const primary = normalizeHex(team.color);
    const secondary = normalizeHex(team.alternateColor);

    allowlistTeams.push({
      id,
      displayName: team.displayName ?? "",
      abbreviation: team.abbreviation ?? "",
      slug: team.slug ?? null,
      subdivision,
      logoUrl: logos.default,
      darkLogoUrl: logos.dark,
      colors: {
        primary,
        secondary,
      },
    });
  }

  // Sort alphabetically by displayName for a stable, human-readable file
  allowlistTeams.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const fbsCount = allowlistTeams.filter((t) => t.subdivision === "FBS").length;
  const fcsCount = allowlistTeams.filter((t) => t.subdivision === "FCS").length;
  console.log(`  FBS: ${fbsCount} teams`);
  console.log(`  FCS: ${fcsCount} teams`);
  console.log(`  Excluded: ${excluded} non-school entries`);
  console.log(`  Total: ${allowlistTeams.length} teams`);

  const output = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: "sports.core.api.espn.com/v2/sports/football/leagues/college-football",
    teams: allowlistTeams,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nWrote allowlist to: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
