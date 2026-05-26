#!/usr/bin/env node

import { init } from "@instantdb/admin";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { clearUserData } from "./seed-data-generators.mjs";

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
  console.error("Usage: node scripts/complete-wipe-data.mjs <userId>");
  process.exit(1);
}

async function wipeAllData() {
  try {
    console.log(`\n🗑️  Completely wiping all data for user ${userId}...\n`);
    
    const admin = init({
      appId,
      adminToken,
    });

    const clearResult = await clearUserData({
      userId,
      admin,
      verbose: true,
    });

    console.log(
      `\n✅ Complete wipe successful! Deleted ${clearResult.totalDeleted} total records.\n`
    );
    process.exit(0);
  } catch (error) {
    console.error("Error wiping data:", error);
    process.exit(1);
  }
}

wipeAllData();
