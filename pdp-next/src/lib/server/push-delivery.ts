import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { getInstantAdmin } from "@/lib/instantdb/admin";

type StoredPushSubscription = {
  id: string;
  ownerUid: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number;
};

export type PushMessagePayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
};

export type PushDeliveryResult = {
  totalSubscriptions: number;
  delivered: number;
  staleDeleted: number;
  failed: number;
};

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) {
    return;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "mailto:notifications@localhost";

  if (!publicKey || !privateKey) {
    throw new Error("Web push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

function toWebPushSubscription(subscription: StoredPushSubscription): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export async function sendPushToOwner(ownerUid: string, payload: PushMessagePayload): Promise<PushDeliveryResult> {
  ensureVapidConfigured();

  const instantAdmin = getInstantAdmin();
  const { pushSubscriptions = [] } = await instantAdmin.query({
    pushSubscriptions: {
      $: {
        where: {
          ownerUid,
        },
      },
    },
  });

  const subscriptions = pushSubscriptions as StoredPushSubscription[];

  if (subscriptions.length === 0) {
    return {
      totalSubscriptions: 0,
      delivered: 0,
      staleDeleted: 0,
      failed: 0,
    };
  }

  const payloadBody = JSON.stringify(payload);
  const staleSubscriptionIds: string[] = [];
  let delivered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(toWebPushSubscription(subscription), payloadBody);
      delivered += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;

      if (statusCode === 404 || statusCode === 410) {
        staleSubscriptionIds.push(subscription.id);
      } else {
        failed += 1;
      }
    }
  }

  if (staleSubscriptionIds.length > 0) {
    await instantAdmin.transact(
      staleSubscriptionIds.map((subscriptionId) => instantAdmin.tx.pushSubscriptions[subscriptionId].delete()),
    );
  }

  return {
    totalSubscriptions: subscriptions.length,
    delivered,
    staleDeleted: staleSubscriptionIds.length,
    failed,
  };
}
