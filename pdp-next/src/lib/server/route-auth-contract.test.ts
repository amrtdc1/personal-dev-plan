import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "src", "app", "api");
const PUBLIC_ROUTE_FILES = new Set([
  join("instant", "route.ts"),
  join("themes", "college-teams", "route.ts"),
  join("calendar", "feed", "[token]", "route.ts"),
]);

describe("protected API auth contract", () => {
  it("requires requireInstantUser on non-public route handlers", () => {
    const routeFiles = listRouteFiles(API_ROOT);

    for (const filePath of routeFiles) {
      const relativePath = relative(API_ROOT, filePath);

      if (PUBLIC_ROUTE_FILES.has(relativePath)) {
        continue;
      }

      const source = readFileSync(filePath, "utf8");
      const hasAuthGuard = source.includes("requireInstantUser(");
      const hasCronSecretGuard = source.includes("x-pdp-cron-secret") || source.includes("NOTIFICATION_CRON_SECRET");

      expect(
        hasAuthGuard || hasCronSecretGuard,
        `Expected auth guard or cron-secret guard in API route: src/app/api/${relativePath.replace(/\\/g, "/")}`,
      ).toBe(true);
    }
  });
});

function listRouteFiles(root: string): string[] {
  const entries = readdirSync(root);
  const results: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(root, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      results.push(...listRouteFiles(absolutePath));
      continue;
    }

    if (entry === "route.ts") {
      results.push(absolutePath);
    }
  }

  return results;
}
