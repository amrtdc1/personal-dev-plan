import { init } from "@instantdb/admin";
import { appSchema } from "@/lib/instantdb/schema";

export function getInstantAdmin() {
  const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
  const adminToken = process.env.INSTANT_ADMIN_TOKEN;

  if (!appId) {
    throw new Error("NEXT_PUBLIC_INSTANT_APP_ID must be set for server-side InstantDB access.");
  }

  if (!adminToken) {
    throw new Error("INSTANT_ADMIN_TOKEN must be set for server-side InstantDB access.");
  }

  return init({
    appId,
    adminToken,
    schema: appSchema,
  });
}