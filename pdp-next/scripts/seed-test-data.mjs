#!/usr/bin/env node

import { init } from "@instantdb/admin";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Load environment variables from .env.local
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
  console.error("Error: NEXT_PUBLIC_INSTANT_APP_ID and INSTANT_ADMIN_TOKEN must be set");
  console.error("Set them in .env.local or as environment variables");
  process.exit(1);
}

// Import data generators
const { generateDataset, clearUserData } = await import(
  "./seed-data-generators.mjs"
);

// Parse command-line arguments
const args = process.argv.slice(2);
let userId = null;
let shouldClear = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--userId" && args[i + 1]) {
    userId = args[i + 1];
    i++;
  } else if (args[i].startsWith("--userId=")) {
    userId = args[i].split("=")[1];
  } else if (args[i] === "--clear") {
    shouldClear = true;
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
Usage: node scripts/seed-test-data.mjs [OPTIONS]

Options:
  --userId=<uid>    Instant $users.id to seed data for (required)
  --clear           Clear existing user data before seeding (optional)
  --help            Show this help message

Example:
  node scripts/seed-test-data.mjs --userId=8ab48e42-8517-40f5-aafb-74ae5ba4a8b3 --clear
  npm run seed:test-data -- --userId=8ab48e42-8517-40f5-aafb-74ae5ba4a8b3
`);
    process.exit(0);
  }
}

if (!userId) {
  console.error("Error: --userId argument is required");
  console.error("Usage: node scripts/seed-test-data.mjs --userId=<uid> [--clear]");
  process.exit(1);
}

try {
  console.log("🌱 Initializing InstantDB seed data script...");
  console.log(`📍 User ID: ${userId}`);

  // Initialize InstantDB admin
  const admin = init({
    appId,
    adminToken,
  });

  // Validate that userId belongs to a real Instant auth user in $users.
  const userLookup = await admin.query({
    $users: {
      $: {
        where: {
          id: userId,
        },
        limit: 1,
      },
    },
  });
  const instantUser = userLookup.$users?.[0];

  if (!instantUser) {
    console.error(
      `Error: userId ${userId} was not found in InstantDB $users. Use a real auth user id.`
    );
    process.exit(1);
  }

  console.log(
    `✅ Found Instant user in $users: ${instantUser.email || instantUser.id}`
  );

  // Clear data if requested
  if (shouldClear) {
    console.log("🗑️  Clearing existing user data...");
    const clearResult = await clearUserData({
      userId,
      admin,
      verbose: true,
    });
    console.log(`✅ Cleared ${clearResult.totalDeleted} records`);
    console.log(`   - Goals: ${clearResult.goalsDeleted}`);
    console.log(`   - Tasks: ${clearResult.tasksDeleted}`);
    console.log(`   - Habits: ${clearResult.habitsDeleted}`);
    console.log(`   - Habit Checkins: ${clearResult.habitCheckinsDeleted}`);
    console.log(`   - Journal Entries: ${clearResult.journalEntriesDeleted}`);
    console.log(`   - Planning Commitments: ${clearResult.planningCommitmentsDeleted}`);
    console.log(`   - Planning Cycles: ${clearResult.planningCyclesDeleted}`);
  }

  // Generate dataset
  console.log("🔨 Generating test data...");
  const dataset = generateDataset({
    userId,
    displayName: instantUser.email
      ? `Seed ${instantUser.email.split("@")[0]}`
      : "Seed User",
  });

  console.log(`✅ Generated dataset:`);
  console.log(`   - Goals: ${dataset.goals.length}`);
  console.log(`   - Child Goals: ${dataset.childGoals.length}`);
  console.log(`   - Planning Cycles: ${dataset.planningCycles.length}`);
  console.log(`   - Planning Commitments: ${dataset.planningCommitments.length}`);
  console.log(`   - Tasks: ${dataset.tasks.length}`);
  console.log(`   - Habits: ${dataset.habits.length}`);
  console.log(`   - Habit Checkins: ${dataset.habitCheckins.length}`);
  console.log(`   - Journal Entries: ${dataset.journalEntries.length}`);

  // Seed data to InstantDB
  console.log("📤 Uploading data to InstantDB...");

  let totalWritten = 0;
  let totalErrors = 0;

  // Helper function to batch write operations
  async function batchWrite(operations, label, batchSize = 10) {
    console.log(`  → ${label} (${operations.length})...`);
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      try {
        await admin.transact(batch);
        totalWritten += batch.length;
      } catch (error) {
        console.error(
          `    ⚠️ Error in batch ${Math.floor(i / batchSize) + 1}:`,
          error.message
        );
        totalErrors += batch.length;
      }
    }
  }

  // Write goals in batches
  const goalOps = dataset.goals.map((goal) =>
    admin.tx.goals[goal.id].update(goal)
  );
  await batchWrite(goalOps, `Goals`, 10);

  // Write child goals (stored in goals entity with parentGoalId set)
  const childGoalOps = dataset.childGoals.map((cg) =>
    admin.tx.goals[cg.id].update(cg)
  );
  await batchWrite(childGoalOps, `Child Goals`, 10);

  // Write planning cycles before commitments (commitments reference cycles)
  const cycleOps = dataset.planningCycles.map((cycle) =>
    admin.tx.planningCycles[cycle.id].update(cycle)
  );
  await batchWrite(cycleOps, `Planning Cycles`, 10);

  // Write planning commitments
  const commitmentOps = dataset.planningCommitments.map((commitment) =>
    admin.tx.planningCommitments[commitment.id].update(commitment)
  );
  await batchWrite(commitmentOps, `Planning Commitments`, 10);

  // Write tasks in batches
  const taskOps = dataset.tasks.map((task) =>
    admin.tx.tasks[task.id].update(task)
  );
  await batchWrite(taskOps, `Tasks`, 10);

  // Write habits in batches
  const habitOps = dataset.habits.map((habit) =>
    admin.tx.habits[habit.id].update(habit)
  );
  await batchWrite(habitOps, `Habits`, 10);

  // Write habit checkins in batches
  const checkinOps = dataset.habitCheckins.map((checkin) =>
    admin.tx.habitCheckins[checkin.id].update(checkin)
  );
  await batchWrite(checkinOps, `Habit Checkins`, 10);

  // Write journal entries in batches
  const journalOps = dataset.journalEntries.map((entry) =>
    admin.tx.journalEntries[entry.id].update(entry)
  );
  await batchWrite(journalOps, `Journal Entries`, 10);

  console.log("\n✨ Seed data upload complete!");
  console.log(`\n📊 Summary for user ${userId}:`);
  console.log(`   Total records written: ${totalWritten}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`   Expected records: ${
    dataset.goals.length +
    dataset.childGoals.length +
    dataset.planningCycles.length +
    dataset.planningCommitments.length +
    dataset.tasks.length +
    dataset.habits.length +
    dataset.habitCheckins.length +
    dataset.journalEntries.length
  }`);

  if (totalErrors > 0) {
    console.warn(
      `\n⚠️  Some writes failed. Check the errors above for details.`
    );
  }

  process.exit(totalErrors > 0 ? 1 : 0);
} catch (error) {
  console.error("\n❌ Seed script failed:");
  console.error(error);
  process.exit(1);
}
