import { init } from "@instantdb/react";

const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "missing-instant-app-id";

export const db = init({
  appId,
});

export const isInstantConfigured =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID !== undefined &&
  process.env.NEXT_PUBLIC_INSTANT_APP_ID.trim().length > 0;