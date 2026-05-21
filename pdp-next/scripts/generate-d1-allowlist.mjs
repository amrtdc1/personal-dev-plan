import fs from "node:fs/promises";
import path from "node:path";

const GROUPS_ENDPOINT = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/groups";
const LOCAL_SAMPLE_PATH = path.resolve(process.cwd(), "..", "assets", "college-football-teams.json");
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "src",
  "lib",
  "theming",
  "data",
  "espn-d1-allowlist.json"
);

function getLocalTeams(payload) {
  const teams = payload?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return new Map(
    teams
      .map((entry) => entry?.team)
      .filter(Boolean)
      .map((team) => [String(team.id), team])
  );
}

function getDivisionChildren(groupsPayload) {
  const d1 = (groupsPayload?.groups ?? []).find((group) => group?.name === "NCAA Division I");
  return d1?.children ?? [];
}

function buildAllowlist(localTeams, divisionChildren) {
  const rows = [];

  for (const subdivision of divisionChildren) {
    const subdivisionName = subdivision?.name;
    if (subdivisionName !== "FBS" && subdivisionName !== "FCS") {
      continue;
    }

    for (const team of subdivision?.teams ?? []) {
      const id = String(team?.id ?? "");
      const local = localTeams.get(id);
      if (!local) {
        continue;
      }

      rows.push({
        id,
        displayName: local.displayName,
        abbreviation: local.abbreviation,
        subdivision: subdivisionName,
      });
    }
  }

  const deduped = [...new Map(rows.map((row) => [row.id, row])).values()];
  deduped.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    source: {
      localSample: "../assets/college-football-teams.json",
      divisionEndpoint: GROUPS_ENDPOINT,
      notes:
        "Starter allowlist is the intersection of local sample team IDs and ESPN NCAA Division I groups (FBS/FCS).",
    },
    teams: deduped,
  };
}

async function main() {
  const localPayload = JSON.parse(await fs.readFile(LOCAL_SAMPLE_PATH, "utf8"));
  const localTeams = getLocalTeams(localPayload);

  const response = await fetch(GROUPS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Unable to fetch groups endpoint: ${response.status}`);
  }

  const groupsPayload = await response.json();
  const divisionChildren = getDivisionChildren(groupsPayload);
  const allowlist = buildAllowlist(localTeams, divisionChildren);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(allowlist, null, 2)}\n`, "utf8");

  const fbsCount = allowlist.teams.filter((team) => team.subdivision === "FBS").length;
  const fcsCount = allowlist.teams.filter((team) => team.subdivision === "FCS").length;
  console.log(`Wrote ${allowlist.teams.length} teams to ${OUTPUT_PATH}`);
  console.log(`FBS: ${fbsCount}, FCS: ${fcsCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
