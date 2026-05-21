import { init } from "@instantdb/react/nextjs";
import { appSchema } from "@/lib/instantdb/schema";

const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "missing-instant-app-id";

export const db = init({
  appId,
  schema: appSchema,
  firstPartyPath: "/api/instant",
});

export const isInstantConfigured =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID !== undefined &&
  process.env.NEXT_PUBLIC_INSTANT_APP_ID.trim().length > 0;