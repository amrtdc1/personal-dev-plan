#!/usr/bin/env node

import { init } from "@instantdb/admin";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Load environment variables
const envPath = join(projectRoot, ".env.local");
let envVars = {};
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && !key.startsWith("#")) {
      envVars[key.trim()] = rest.join("=").trim();
    }
  });
} catch {
  console.warn(`Could not read ${envPath}, using process.env`);
}

const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID || envVars.NEXT_PUBLIC_INSTANT_APP_ID;
const adminToken = process.env.INSTANT_ADMIN_TOKEN || envVars.INSTANT_ADMIN_TOKEN;

if (!appId || !adminToken) {
  console.error("Error: Missing credentials");
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/check-seeded-data.mjs <userId>");
  process.exit(1);
}

async function checkData() {
  try {
    console.log(`\n🔍 Checking data for user ${userId}...\n`);
    
    const admin = init({
      appId,
      adminToken,
    });

    const QUERY_PAGE_SIZE = 500;

    async function queryAllOwnedRecords(entityName) {
      const allRows = [];
      let offset = 0;

      while (true) {
        const result = await admin.query({
          [entityName]: {
            $: {
              where: {
                ownerUid: userId,
              },
              limit: QUERY_PAGE_SIZE,
              offset,
            },
          },
        });

        const pageRows = result[entityName] || [];
        allRows.push(...pageRows);

        if (pageRows.length < QUERY_PAGE_SIZE) {
          break;
        }

        offset += QUERY_PAGE_SIZE;
      }

      return allRows;
    }

    // Check all entities with full pagination-aware totals
    const goals = await queryAllOwnedRecords("goals");
    const tasks = await queryAllOwnedRecords("tasks");
    const habits = await queryAllOwnedRecords("habits");
    const habitCheckins = await queryAllOwnedRecords("habitCheckins");
    const journalEntries = await queryAllOwnedRecords("journalEntries");

    console.log("📊 Current Data in InstantDB (page-limited snapshot):");
    console.log(`   Goals: ${goals.length}`);
    console.log(`   Tasks: ${tasks.length}`);
    console.log(`   Habits: ${habits.length}`);
    console.log(`   Habit Checkins: ${habitCheckins.length}`);
    console.log(`   Journal Entries: ${journalEntries.length}`);
    console.log(
      "   Note: Instant admin queries can be paginated; these values are useful for quick checks, not guaranteed full totals."
    );

    if (tasks.length > 0) {
      console.log("\n🔎 Sample Tasks:");
      tasks.slice(0, 3).forEach((task, i) => {
        console.log(`   ${i + 1}. "${task.title}" - parentGoalId: ${task.parentGoalId ?? "null"}`);
      });
    }

    if (habits.length > 0) {
      console.log("\n🔎 Habits:");
      habits.forEach((habit, i) => {
        console.log(`   ${i + 1}. "${habit.title}" (id: ${habit.id})`);
      });
    }

    if (habitCheckins.length > 0) {
      console.log("\n🔎 Sample Habit Checkins:");
      const uniqueHabitIds = new Set(habitCheckins.map(c => c.habitId));
      console.log(`   Unique habitIds: ${uniqueHabitIds.size}`);
      habitCheckins.slice(0, 3).forEach((checkin, i) => {
        console.log(`   ${i + 1}. habitId: ${checkin.habitId}, date: ${checkin.checkInDate}`);
      });
    }

  } catch (error) {
    console.error("Error checking data:", error);
    process.exit(1);
  }
}

checkData();
