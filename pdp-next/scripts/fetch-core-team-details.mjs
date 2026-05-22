/**
 * fetch-core-team-details.mjs
 *
 * Reads the $ref URLs from core-fbs-teams.json and core-fcs-teams.json,
 * then fetches each team detail page from ESPN's core API at a throttled
 * rate (default: 1 request per second) to avoid triggering rate limits.
 *
 * Progress is saved incrementally to core-team-details.json so the script
 * can be safely restarted if interrupted — already-fetched teams are skipped.
 *
 * Usage:
 *   node scripts/fetch-core-team-details.mjs
 *   node scripts/fetch-core-team-details.mjs --delay 1500   # ms between calls
 *   node scripts/fetch-core-team-details.mjs --reset        # clear cache first
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FBS_FILE = path.join(__dirname, "core-fbs-teams.json");
const FCS_FILE = path.join(__dirname, "core-fcs-teams.json");
const OUTPUT_FILE = path.join(__dirname, "core-team-details.json");

// Default: 1 request per second (~277 requests ≈ 5 minutes)
// Pass --delay <ms> to override (e.g. --delay 2000 for 30/min)
const args = process.argv.slice(2);
const delayIdx = args.indexOf("--delay");
const DELAY_MS = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) : 5000;
const RESET = args.includes("--reset");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function loadExistingOutput() {
  try {
    const raw = await fs.readFile(OUTPUT_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveOutput(data) {
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

async function fetchTeam(refUrl) {
  const res = await fetch(refUrl, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${refUrl}`);
  }
  return res.json();
}

async function main() {
  const [fbsData, fcsData] = await Promise.all([
    loadJson(FBS_FILE),
    loadJson(FCS_FILE),
  ]);

  const fbsRefs = (fbsData.items ?? []).map((item) => ({
    ref: item["$ref"],
    subdivision: "FBS",
  }));
  const fcsRefs = (fcsData.items ?? []).map((item) => ({
    ref: item["$ref"],
    subdivision: "FCS",
  }));

  const allRefs = [...fbsRefs, ...fcsRefs];
  const total = allRefs.length;
  console.log(`Found ${fbsRefs.length} FBS refs + ${fcsRefs.length} FCS refs = ${total} total`);

  if (RESET) {
    console.log("--reset flag set: clearing existing output.");
    await saveOutput({});
  }

  // existing is keyed by ESPN team id
  const existing = await loadExistingOutput();
  const alreadyDone = Object.keys(existing).length;
  if (alreadyDone > 0) {
    console.log(`Resuming: ${alreadyDone} teams already fetched, skipping those.`);
  }

  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < allRefs.length; i++) {
    const { ref, subdivision } = allRefs[i];

    // Extract team id from the ref URL
    const idMatch = ref.match(/\/teams\/(\d+)/);
    const teamId = idMatch ? idMatch[1] : null;

    if (!teamId) {
      console.warn(`  [${i + 1}/${total}] Could not parse team ID from: ${ref}`);
      errors++;
      continue;
    }

    if (existing[teamId]) {
      skipped++;
      continue;
    }

    process.stdout.write(
      `  [${i + 1}/${total}] Fetching team ${teamId} (${subdivision})... `
    );

    try {
      const data = await fetchTeam(ref);
      const id = String(data.id ?? teamId);
      existing[id] = {
        id,
        subdivision,
        displayName: data.displayName ?? data.name ?? "",
        abbreviation: data.abbreviation ?? "",
        shortDisplayName: data.shortDisplayName ?? "",
        location: data.location ?? "",
        name: data.name ?? "",
        color: data.color ?? null,
        alternateColor: data.alternateColor ?? null,
        logos: (data.logos ?? []).map((logo) => ({
          href: logo.href,
          rel: logo.rel ?? [],
          width: logo.width ?? null,
          height: logo.height ?? null,
        })),
        slug: data.slug ?? null,
        uid: data.uid ?? null,
        isActive: data.isActive ?? true,
      };
      console.log(`OK — ${existing[id].displayName}`);
      fetched++;

      // Save every 10 teams to preserve progress incrementally
      if (fetched % 10 === 0) {
        await saveOutput(existing);
        console.log(`  [checkpoint] Saved ${Object.keys(existing).length} teams so far.`);
      }
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      errors++;
    }

    // Rate limit — skip delay on last item
    if (i < allRefs.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Final save
  await saveOutput(existing);

  const finalCount = Object.keys(existing).length;
  console.log("\n========================================");
  console.log(`Done.`);
  console.log(`  Total refs:    ${total}`);
  console.log(`  Fetched:       ${fetched}`);
  console.log(`  Skipped:       ${skipped}`);
  console.log(`  Errors:        ${errors}`);
  console.log(`  Saved to:      ${OUTPUT_FILE}`);
  console.log(`  Total on disk: ${finalCount} teams`);
  console.log("========================================");

  if (errors > 0) {
    console.warn(`\nWarning: ${errors} team(s) failed. Re-run the script to retry them.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
