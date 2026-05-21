#!/usr/bin/env node

const previewUrlArg = process.argv[2];
const rawBaseUrl = previewUrlArg || process.env.PREVIEW_URL;

if (!rawBaseUrl) {
  console.error("Missing preview URL. Pass it as the first argument or set PREVIEW_URL.");
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(rawBaseUrl).toString().replace(/\/$/, "");
} catch {
  console.error(`Invalid preview URL: ${rawBaseUrl}`);
  process.exit(1);
}

const checks = [
  {
    name: "App root",
    path: "/",
    expect: (response) => response.status === 200,
    expectedText: "HTTP 200",
  },
  {
    name: "Web manifest",
    path: "/manifest.webmanifest",
    expect: (response) => response.status === 200,
    expectedText: "HTTP 200",
  },
  {
    name: "Protected goals API",
    path: "/api/goals",
    expect: (response) => response.status === 401,
    expectedText: "HTTP 401",
  },
];

const timeoutMs = 15000;
let failed = false;

console.log(`Running preview smoke checks against ${baseUrl}`);

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent": "pdp-next-preview-smoke/1.0",
      },
    });

    if (check.expect(response)) {
      console.log(`PASS ${check.name}: ${response.status}`);
    } else {
      failed = true;
      console.error(`FAIL ${check.name}: expected ${check.expectedText}, received HTTP ${response.status}`);
    }
  } catch (error) {
    failed = true;
    if (error && error.name === "AbortError") {
      console.error(`FAIL ${check.name}: request timed out after ${timeoutMs}ms`);
    } else {
      console.error(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

if (failed) {
  console.error("Preview smoke checks failed.");
  process.exit(1);
}

console.log("Preview smoke checks passed.");
