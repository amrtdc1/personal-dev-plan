import { Position, type Edge, type Node } from "@xyflow/react";
import type { Goal, GoalTimeframeLevel, Task } from "@/lib/domain/types";

type GraphNodeKind = "goal" | "task";

export type GraphNodeData = {
  kind: GraphNodeKind;
  entityId: string;
  title: string;
  status: string;
  subtitle: string;
};

export type GraphModel = {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
};

const GOAL_COLUMN_GAP = 280;
const GOAL_ROW_GAP = 148;
const GOAL_BASE_X = 84;
const GOAL_BASE_Y = 86;
const TASK_OFFSET_X = 176;
const TASK_ROW_GAP = 48;
const MIN_GRAPH_HEIGHT = 640;

export function buildNodeGraphModel(input: {
  goals: Goal[];
  tasks: Task[];
  timeframeOrder: GoalTimeframeLevel[];
  includeFreestandingTasks: boolean;
}): GraphModel {
  const goalsById = new Map(input.goals.map((goal) => [goal.id, goal]));
  const goalsByTimeframe = new Map<GoalTimeframeLevel, Goal[]>();

  for (const level of input.timeframeOrder) {
    goalsByTimeframe.set(level, []);
  }

  for (const goal of input.goals) {
    const bucket = goalsByTimeframe.get(goal.timeframeLevel) ?? [];
    bucket.push(goal);
    goalsByTimeframe.set(goal.timeframeLevel, bucket);
  }

  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];
  const goalNodePositionById = new Map<string, { x: number; y: number }>();
  const maxGoalsInAnyColumn = Math.max(
    1,
    ...input.timeframeOrder.map((level) => goalsByTimeframe.get(level)?.length ?? 0),
  );
  const graphHeight = Math.max(MIN_GRAPH_HEIGHT, GOAL_BASE_Y + maxGoalsInAnyColumn * GOAL_ROW_GAP + 120);

  for (let columnIndex = 0; columnIndex < input.timeframeOrder.length; columnIndex += 1) {
    const timeframe = input.timeframeOrder[columnIndex];
    const sortedGoals = (goalsByTimeframe.get(timeframe) ?? []).slice().sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      return left.title.localeCompare(right.title);
    });

    for (let rowIndex = 0; rowIndex < sortedGoals.length; rowIndex += 1) {
      const goal = sortedGoals[rowIndex];
      const columnYOffset = Math.max(0, Math.floor((maxGoalsInAnyColumn - sortedGoals.length) * GOAL_ROW_GAP * 0.5));
      const position = {
        x: GOAL_BASE_X + columnIndex * GOAL_COLUMN_GAP,
        y: GOAL_BASE_Y + columnYOffset + rowIndex * GOAL_ROW_GAP,
      };

      goalNodePositionById.set(goal.id, position);
      nodes.push({
        id: goalNodeId(goal.id),
        type: "entity",
        position,
        data: {
          kind: "goal",
          entityId: goal.id,
          title: goal.title,
          status: goal.status,
          subtitle: goal.type === "professional" ? "Professional goal" : "Personal goal",
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: false,
      });
    }
  }

  for (const goal of input.goals) {
    if (!goal.parentGoalId || !goalNodePositionById.has(goal.parentGoalId)) {
      continue;
    }

    edges.push({
      id: `goal-link:${goal.parentGoalId}:${goal.id}`,
      source: goalNodeId(goal.parentGoalId),
      target: goalNodeId(goal.id),
      type: "smoothstep",
      data: {
        relationship: "goal-parent",
      },
      animated: false,
    });
  }

  const tasksByGoalId = new Map<string, Task[]>();
  for (const task of input.tasks) {
    const parentGoal = goalsById.get(task.goalId);
    if (!parentGoal) {
      continue;
    }

    const bucket = tasksByGoalId.get(parentGoal.id) ?? [];
    bucket.push(task);
    tasksByGoalId.set(parentGoal.id, bucket);
  }

  for (const [goalId, ownedTasks] of tasksByGoalId.entries()) {
    const goalPosition = goalNodePositionById.get(goalId);
    if (!goalPosition) {
      continue;
    }

    const sortedTasks = ownedTasks.slice().sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      return left.title.localeCompare(right.title);
    });

    for (let index = 0; index < sortedTasks.length; index += 1) {
      const task = sortedTasks[index];
      const position = {
        x: goalPosition.x + TASK_OFFSET_X,
        y: goalPosition.y - 28 + index * TASK_ROW_GAP,
      };

      nodes.push({
        id: taskNodeId(task.id),
        type: "entity",
        position,
        data: {
          kind: "task",
          entityId: task.id,
          title: task.title,
          status: task.status,
          subtitle: "Task",
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: false,
      });

      edges.push({
        id: `task-link:${goalId}:${task.id}`,
        source: goalNodeId(goalId),
        target: taskNodeId(task.id),
        type: "smoothstep",
        data: {
          relationship: "goal-task",
        },
        animated: false,
      });
    }
  }

  if (input.includeFreestandingTasks) {
    const freestandingTasks = input.tasks
      .filter((task) => !goalsById.has(task.goalId))
      .sort((left, right) => left.title.localeCompare(right.title));

    const freestandingColumnX = GOAL_BASE_X + input.timeframeOrder.length * GOAL_COLUMN_GAP;
    const centeredBaseY = Math.max(
      GOAL_BASE_Y,
      Math.floor((graphHeight - (freestandingTasks.length * (TASK_ROW_GAP + 20) + 80)) * 0.5),
    );
    for (let index = 0; index < freestandingTasks.length; index += 1) {
      const task = freestandingTasks[index];
      nodes.push({
        id: taskNodeId(task.id),
        type: "entity",
        position: {
          x: freestandingColumnX,
          y: centeredBaseY + index * (TASK_ROW_GAP + 20),
        },
        data: {
          kind: "task",
          entityId: task.id,
          title: task.title,
          status: task.status,
          subtitle: "Freestanding task",
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: false,
      });
    }
  }

  return { nodes, edges };
}

export function goalNodeId(goalId: string) {
  return `goal:${goalId}`;
}

export function taskNodeId(taskId: string) {
  return `task:${taskId}`;
}
