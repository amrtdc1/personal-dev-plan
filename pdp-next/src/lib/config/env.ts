const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Personal Development Plan";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const SOFT_DELETE_RETENTION_DAYS = Number(process.env.SOFT_DELETE_RETENTION_DAYS || "60");

if (Number.isNaN(SOFT_DELETE_RETENTION_DAYS) || SOFT_DELETE_RETENTION_DAYS <= 0) {
  throw new Error("SOFT_DELETE_RETENTION_DAYS must be a positive number.");
}

export const env = {
  appName: APP_NAME,
  appUrl: APP_URL,
  vapidPublicKey: VAPID_PUBLIC_KEY,
  softDeleteRetentionDays: SOFT_DELETE_RETENTION_DAYS,
  instantAppId: process.env.NEXT_PUBLIC_INSTANT_APP_ID || "",
};
