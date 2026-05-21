import { createInstantRouteHandler } from "@instantdb/react/nextjs";

const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;

if (!appId) {
  throw new Error("NEXT_PUBLIC_INSTANT_APP_ID must be set to enable Instant auth sync.");
}

export const { POST } = createInstantRouteHandler({
  appId,
});