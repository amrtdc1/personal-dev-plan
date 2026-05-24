import { createHmac, timingSafeEqual } from "node:crypto";
import { InstantRouteBadRequestError } from "@/lib/server/instant-errors";
import { InstantAuthError } from "@/lib/server/instant-errors";

type FeedTokenPayload = {
  uid: string;
  rev: string;
  exp: number;
};

export function createCalendarFeedToken(uid: string, rev: string, options?: { ttlDays?: number }) {
  const secret = getCalendarFeedSecret();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttlDays = options?.ttlDays ?? parseTtlDays(process.env.CALENDAR_FEED_TTL_DAYS);
  const exp = nowSeconds + ttlDays * 24 * 60 * 60;

  const payload: FeedTokenPayload = {
    uid,
    rev,
    exp,
  };

  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signatureBase64 = signPayload(payloadBase64, secret);

  return {
    token: `${payloadBase64}.${signatureBase64}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyCalendarFeedToken(token: string) {
  const secret = getCalendarFeedSecret();
  const [payloadBase64, signatureBase64] = token.split(".");

  if (!payloadBase64 || !signatureBase64) {
    throw new InstantAuthError("Invalid calendar feed token.");
  }

  const expectedSignature = signPayload(payloadBase64, secret);

  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signatureBase64);

  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new InstantAuthError("Invalid calendar feed token.");
  }

  let payload: FeedTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadBase64)) as FeedTokenPayload;
  } catch {
    throw new InstantAuthError("Invalid calendar feed token.");
  }

  if (!payload.uid || typeof payload.uid !== "string" || typeof payload.rev !== "string" || typeof payload.exp !== "number") {
    throw new InstantAuthError("Invalid calendar feed token.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    throw new InstantAuthError("Calendar feed token is expired.");
  }

  return {
    uid: payload.uid,
    rev: payload.rev,
    exp: payload.exp,
  };
}

function signPayload(payloadBase64: string, secret: string) {
  const digest = createHmac("sha256", secret).update(payloadBase64).digest("base64");
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getCalendarFeedSecret() {
  const secret = process.env.CALENDAR_FEED_SECRET?.trim();
  if (!secret) {
    throw new InstantRouteBadRequestError("Calendar feed is not configured. Set CALENDAR_FEED_SECRET.");
  }

  return secret;
}

function parseTtlDays(rawValue: string | undefined) {
  if (!rawValue) {
    return 365;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 365;
  }

  return Math.floor(parsed);
}
