import type { Goal, GoalTimeframeLevel, Task } from "@/lib/domain/types";
import { buildNodeGraphModel } from "@/components/dashboard/node-map/graph-adapter";

const TIMEFRAME_ORDER: GoalTimeframeLevel[] = ["vision_5y", "annual", "quarterly", "monthly", "weekly"];

describe("graph adapter", () => {
  it("builds goal and task nodes with parent/task edges", () => {
    const goals = [
      buildGoal({ id: "goal-root", title: "Root", timeframeLevel: "annual", parentGoalId: null }),
      buildGoal({ id: "goal-child", title: "Child", timeframeLevel: "quarterly", parentGoalId: "goal-root" }),
    ];

    const tasks = [
      buildTask({ id: "task-1", title: "Task one", goalId: "goal-child" }),
      buildTask({ id: "task-2", title: "Task two", goalId: "goal-child" }),
    ];

    const result = buildNodeGraphModel({
      goals,
      tasks,
      timeframeOrder: TIMEFRAME_ORDER,
      includeFreestandingTasks: false,
    });

    expect(result.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["goal:goal-root", "goal:goal-child", "task:task-1", "task:task-2"]),
    );

    expect(result.edges.map((edge) => edge.id)).toEqual(
      expect.arrayContaining(["goal-link:goal-root:goal-child", "task-link:goal-child:task-1", "task-link:goal-child:task-2"]),
    );
  });

  it("includes freestanding task nodes only when enabled", () => {
    const goals = [buildGoal({ id: "goal-1", timeframeLevel: "weekly" })];
    const tasks = [buildTask({ id: "task-free", goalId: "missing-goal", title: "Freestanding" })];

    const hidden = buildNodeGraphModel({
      goals,
      tasks,
      timeframeOrder: TIMEFRAME_ORDER,
      includeFreestandingTasks: false,
    });

    const visible = buildNodeGraphModel({
      goals,
      tasks,
      timeframeOrder: TIMEFRAME_ORDER,
      includeFreestandingTasks: true,
    });

    expect(hidden.nodes.find((node) => node.id === "task:task-free")).toBeUndefined();
    expect(visible.nodes.find((node) => node.id === "task:task-free")).toBeDefined();
  });
});

function buildGoal(overrides: Partial<Goal>): Goal {
  return {
    id: "goal-1",
    ownerUid: "user-1",
    type: "professional",
    parentGoalId: null,
    timeframeLevel: "weekly",
    title: "Goal",
    description: "Desc",
    timeframe: "This week",
    projectedStartDate: null,
    projectedEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    status: "not_started",
    percentComplete: 0,
    isFocus: false,
    themeColor: "#2563eb",
    orderIndex: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}

function buildTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    ownerUid: "user-1",
    goalId: "goal-1",
    title: "Task",
    notes: "",
    dueDate: null,
    unplanned: false,
    status: "not_started",
    percentComplete: 0,
    orderIndex: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}
