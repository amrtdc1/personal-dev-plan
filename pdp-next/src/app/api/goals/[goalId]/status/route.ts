import { NextResponse } from "next/server";
import { statusToPercent } from "@/lib/domain/status";
import type { Goal, ItemStatus } from "@/lib/domain/types";
import { validateStatusUpdate } from "@/lib/data/validation";
import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantAuthError, requireInstantUser } from "@/lib/server/instant-auth";

type RouteContext = {
  params: Promise<{
    goalId: string;
  }>;
};

type StatusUpdatePayload = {
  status?: ItemStatus;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const instantAdmin = getInstantAdmin();
    const user = await requireInstantUser(request);
    const { goalId } = await context.params;
    const payload = (await request.json()) as StatusUpdatePayload;

    if (!goalId) {
      return NextResponse.json({ error: "Goal id is required." }, { status: 400 });
    }

    if (!payload.status) {
      return NextResponse.json({ error: "Status is required." }, { status: 400 });
    }

    validateStatusUpdate(payload.status);

    const { goals = [] } = await instantAdmin.query({
      goals: {
        $: {
          where: {
            ownerUid: user.id,
          },
        },
      },
    });

    const goal = goals.find((entry) => entry.id === goalId) as Goal | undefined;

    if (!goal) {
      return NextResponse.json({ error: "Goal was not found for this user." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const percentComplete = statusToPercent(payload.status);

    await instantAdmin.transact(
      instantAdmin.tx.goals[goalId].update({
        status: payload.status,
        percentComplete,
        updatedAt: now,
      }),
    );

    return NextResponse.json({
      goal: {
        ...goal,
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