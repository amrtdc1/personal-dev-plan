import { NextResponse } from "next/server";
import { statusToPercent } from "@/lib/domain/status";
import type { ItemStatus, Subgoal } from "@/lib/domain/types";
import { validateStatusUpdate } from "@/lib/data/validation";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantAuthError, requireInstantUser } from "@/lib/server/instant-auth";

type RouteContext = {
  params: Promise<{
    subgoalId: string;
  }>;
};

type StatusUpdatePayload = {
  status?: ItemStatus;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const instantAdmin = getInstantAdmin();
    const user = await requireInstantUser(request);
    const { subgoalId } = await context.params;
    const payload = (await request.json()) as StatusUpdatePayload;

    if (!subgoalId) {
      return NextResponse.json({ error: "Subgoal id is required." }, { status: 400 });
    }

    if (!payload.status) {
      return NextResponse.json({ error: "Status is required." }, { status: 400 });
    }

    validateStatusUpdate(payload.status);

    const { subgoals = [] } = await instantAdmin.query({
      subgoals: {
        $: {
          where: {
            ownerUid: user.id,
          },
        },
      },
    });

    const subgoal = subgoals.find((entry) => entry.id === subgoalId) as Subgoal | undefined;

    if (!subgoal) {
      return NextResponse.json({ error: "Subgoal was not found for this user." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(payload.status);

    await instantAdmin.transact(
      instantAdmin.tx.subgoals[subgoalId].update({
        status: payload.status,
        percentComplete,
        updatedAt: now,
      }),
    );

    return NextResponse.json({
      subgoal: {
        ...subgoal,
        status: payload.status,
        percentComplete,
        updatedAt: now,
      },
    });
  } catch (error) {
    if (error instanceof InstantAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}