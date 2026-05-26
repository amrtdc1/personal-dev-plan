import { getInstantAdmin } from "@/lib/instantdb/admin";
import type { Goal, Task } from "@/lib/domain/types";
import { buildCalendarIcs } from "@/lib/server/calendar-ics";
import { verifyCalendarFeedToken } from "@/lib/server/calendar-feed-token";
import { resolveInstantRouteError } from "@/lib/server/instant-error-response";
import { InstantAuthError } from "@/lib/server/instant-errors";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { uid, rev } = verifyCalendarFeedToken(token);

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

    const profile = userProfiles[0] as { updatedAt?: string; createdAt?: string } | undefined;
    const currentRevision = profile?.updatedAt || profile?.createdAt || "0";

    if (currentRevision !== rev) {
      throw new InstantAuthError("Calendar feed token has been rotated.");
    }

    const [{ goals = [] }, { tasks = [] }] = await Promise.all([
      instantAdmin.query({
        goals: {
          $: {
            where: {
              ownerUid: uid,
            },
          },
        },
      }),
      instantAdmin.query({
        tasks: {
          $: {
            where: {
              ownerUid: uid,
            },
          },
        },
      }),
    ]);

    const ics = buildCalendarIcs({
      goals: goals as Goal[],
      tasks: tasks as Task[],
    });

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline; filename=pdp-calendar.ics",
      },
    });
  } catch (error) {
    const resolved = resolveInstantRouteError(error);
    return Response.json(resolved.payload, { status: resolved.status });
  }
}
