import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { requireInstantUser } from "@/lib/server/instant-auth";
import { createCalendarFeedToken } from "@/lib/server/calendar-feed-token";
import { InstantRouteNotFoundError } from "@/lib/server/instant-errors";
import { instantRouteErrorResponse } from "@/lib/server/instant-route";

export async function GET(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const revision = await getCalendarFeedRevision(user.id);
    const { token, expiresAt } = createCalendarFeedToken(user.id, revision);

    const origin = env.appUrl || new URL(request.url).origin;
    const feedUrl = `${origin}/api/calendar/feed/${token}`;

    return NextResponse.json(
      {
        ok: true,
        token,
        revision,
        expiresAt,
        feedUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/calendar/feed/token",
      method: "GET",
      phase: "issue-calendar-feed-token",
    });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const revision = await rotateCalendarFeedRevision(user.id);
    const { token, expiresAt } = createCalendarFeedToken(user.id, revision);

    const origin = env.appUrl || new URL(request.url).origin;
    const feedUrl = `${origin}/api/calendar/feed/${token}`;

    return NextResponse.json(
      {
        ok: true,
        token,
        revision,
        expiresAt,
        feedUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    return instantRouteErrorResponse(error, {
      route: "/api/calendar/feed/token",
      method: "POST",
      phase: "rotate-calendar-feed-token",
    });
  }
}

async function getCalendarFeedRevision(uid: string) {
  const instantAdmin = getInstantAdmin();
  const { userProfiles = [] } = await instantAdmin.query({
    userProfiles: {
      $: {
        where: {
          uid,
        },
      },
    },
  });

  const profile = userProfiles[0] as { id?: string; updatedAt?: string; createdAt?: string } | undefined;
  if (!profile) {
    throw new InstantRouteNotFoundError("Profile was not found for this user.");
  }

  return profile.updatedAt || profile.createdAt || "0";
}

async function rotateCalendarFeedRevision(uid: string) {
  const instantAdmin = getInstantAdmin();
  const { userProfiles = [] } = await instantAdmin.query({
    userProfiles: {
      $: {
        where: {
          uid,
        },
      },
    },
  });

  const profile = userProfiles[0] as { id?: string } | undefined;
  if (!profile?.id) {
    throw new InstantRouteNotFoundError("Profile was not found for this user.");
  }

  const rotatedAt = new Date().toISOString();
  await instantAdmin.transact(instantAdmin.tx.userProfiles[profile.id].update({
    updatedAt: rotatedAt,
  }));

  return rotatedAt;
}
