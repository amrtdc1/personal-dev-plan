import { Position, type Edge, type Node } from "@xyflow/react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import type { Goal, GoalTimeframeLevel, Task } from "@/lib/domain/types";

type GraphNodeKind = "goal" | "task";

type Point = {
  x: number;
  y: number;
};

type ForceRelationship = "goal-parent" | "goal-task";

type ForceNode = {
  id: string;
  kind: GraphNodeKind;
  timeframeIndex: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  anchorX: number;
  anchorY: number;
};

type ForceLink = {
  source: string;
  target: string;
  relationship: ForceRelationship;
};

export type NodeGraphForceProfile = "compact" | "balanced" | "spacious";

type ForceTuning = {
  chargeGoal: number;
  chargeTask: number;
  collisionGoal: number;
  collisionTask: number;
  goalTaskDistance: number;
  parentLinkDistance: number;
  goalTaskStrength: number;
  parentLinkStrength: number;
  anchorGoalStrength: number;
  anchorTaskStrength: number;
  clusterGoalStrength: number;
  clusterTaskStrength: number;
  iterations: number;
};

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

const CENTER_X = 900;
const CENTER_Y = 640;
const RING_START_RADIUS = 220;
const RING_GAP = 210;
const TASK_ORBIT_RADIUS = 118;
const TASK_ORBIT_GAP = 26;
const GOAL_NODE_WIDTH = 176;
const GOAL_NODE_HEIGHT = 92;
const TASK_NODE_WIDTH = 176;
const TASK_NODE_HEIGHT = 92;

export function buildNodeGraphModel(input: {
  goals: Goal[];
  tasks: Task[];
  timeframeOrder: GoalTimeframeLevel[];
  includeFreestandingTasks: boolean;
  forceProfile: NodeGraphForceProfile;
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
  const forceNodes: ForceNode[] = [];
  const forceLinks: ForceLink[] = [];
  const goalNodePositionById = new Map<string, Point>();
  const goalAngleById = new Map<string, number>();
  const timeframeIndexByGoalId = new Map<string, number>();

  for (let levelIndex = 0; levelIndex < input.timeframeOrder.length; levelIndex += 1) {
    const timeframe = input.timeframeOrder[levelIndex];
    const ringGoals = (goalsByTimeframe.get(timeframe) ?? []).slice().sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      return left.title.localeCompare(right.title);
    });

    if (ringGoals.length === 0) {
      continue;
    }

    const radius = RING_START_RADIUS + levelIndex * RING_GAP;
    const angleStep = (Math.PI * 2) / ringGoals.length;
    const ringOffset = levelIndex * 0.33;

    for (let ringIndex = 0; ringIndex < ringGoals.length; ringIndex += 1) {
      const goal = ringGoals[ringIndex];
      const angle = ringOffset + ringIndex * angleStep;
      const position = {
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius * 0.82,
      };

      goalNodePositionById.set(goal.id, position);
      goalAngleById.set(goal.id, angle);
      timeframeIndexByGoalId.set(goal.id, levelIndex);

      nodes.push({
        id: goalNodeId(goal.id),
        type: "entity",
        position,
        data: {
          kind: "goal",
          entityId: goal.id,
          title: goal.title,
          status: goal.status,
          subtitle: `${humanizeTimeframe(goal.timeframeLevel)} | ${goal.type === "professional" ? "Pro" : "Personal"}`,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: true,
      });

      forceNodes.push({
        id: goalNodeId(goal.id),
        kind: "goal",
        timeframeIndex: levelIndex,
        x: position.x,
        y: position.y,
        anchorX: position.x,
        anchorY: position.y,
      });
    }
  }

  for (const goal of input.goals) {
    if (!goal.parentGoalId || !goalNodePositionById.has(goal.parentGoalId) || !goalNodePositionById.has(goal.id)) {
      continue;
    }

    edges.push({
      id: `goal-link:${goal.parentGoalId}:${goal.id}`,
      source: goalNodeId(goal.parentGoalId),
      target: goalNodeId(goal.id),
      sourceHandle: "source",
      targetHandle: "target",
      type: "smoothstep",
      data: {
        relationship: "goal-parent",
      },
      animated: false,
    });

    forceLinks.push({
      source: goalNodeId(goal.parentGoalId),
      target: goalNodeId(goal.id),
      relationship: "goal-parent",
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

    const baseAngle = goalAngleById.get(goalId) ?? 0;
    const timeframeIndex = timeframeIndexByGoalId.get(goalId) ?? 0;

    for (let index = 0; index < sortedTasks.length; index += 1) {
      const task = sortedTasks[index];
      const localOffset = index - (sortedTasks.length - 1) / 2;
      const orbitAngle = baseAngle + localOffset * 0.42;
      const orbitRadius = TASK_ORBIT_RADIUS + Math.floor(index / 3) * TASK_ORBIT_GAP;
      const position = {
        x: goalPosition.x + Math.cos(orbitAngle) * orbitRadius,
        y: goalPosition.y + Math.sin(orbitAngle) * orbitRadius,
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
        draggable: true,
      });

      forceNodes.push({
        id: taskNodeId(task.id),
        kind: "task",
        timeframeIndex,
        x: position.x,
        y: position.y,
        anchorX: position.x,
        anchorY: position.y,
      });

      edges.push({
        id: `task-link:${goalId}:${task.id}`,
        source: goalNodeId(goalId),
        target: taskNodeId(task.id),
        sourceHandle: "source",
        targetHandle: "target",
        type: "smoothstep",
        data: {
          relationship: "goal-task",
        },
        animated: false,
      });

      forceLinks.push({
        source: goalNodeId(goalId),
        target: taskNodeId(task.id),
        relationship: "goal-task",
      });
    }
  }

  if (input.includeFreestandingTasks) {
    const freestandingTasks = input.tasks
      .filter((task) => !goalsById.has(task.goalId))
      .sort((left, right) => left.title.localeCompare(right.title));

    const outerRadius = RING_START_RADIUS + input.timeframeOrder.length * RING_GAP + 180;

    for (let index = 0; index < freestandingTasks.length; index += 1) {
      const task = freestandingTasks[index];
      const angle = -0.75 + index * 0.22;
      nodes.push({
        id: taskNodeId(task.id),
        type: "entity",
        position: {
          x: CENTER_X + Math.cos(angle) * outerRadius,
          y: CENTER_Y + Math.sin(angle) * (outerRadius * 0.62),
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
        draggable: true,
      });

      forceNodes.push({
        id: taskNodeId(task.id),
        kind: "task",
        timeframeIndex: input.timeframeOrder.length,
        x: CENTER_X + Math.cos(angle) * outerRadius,
        y: CENTER_Y + Math.sin(angle) * (outerRadius * 0.62),
        anchorX: CENTER_X + Math.cos(angle) * outerRadius,
        anchorY: CENTER_Y + Math.sin(angle) * (outerRadius * 0.62),
      });
    }
  }

  const timeframeCenters = buildTimeframeCenters(input.timeframeOrder.length, input.forceProfile);
  const forcedNodeCenters = runForceLayout(forceNodes, forceLinks, input.forceProfile, timeframeCenters);

  const reflowedNodes = nodes.map((node) => {
    const forced = forcedNodeCenters.get(node.id);
    if (!forced) {
      return node;
    }

    const width = node.data.kind === "goal" ? GOAL_NODE_WIDTH : TASK_NODE_WIDTH;
    const height = node.data.kind === "goal" ? GOAL_NODE_HEIGHT : TASK_NODE_HEIGHT;

    return {
      ...node,
      position: {
        x: forced.x - width / 2,
        y: forced.y - height / 2,
      },
    };
  });

  return { nodes: reflowedNodes, edges };
}

export function goalNodeId(goalId: string) {
  return `goal:${goalId}`;
}

export function taskNodeId(taskId: string) {
  return `task:${taskId}`;
}

function humanizeTimeframe(level: GoalTimeframeLevel) {
  switch (level) {
    case "vision_5y":
      return "Long-term";
    case "annual":
      return "Annual";
    case "quarterly":
      return "Quarterly";
    case "monthly":
      return "Monthly";
    case "weekly":
      return "Weekly";
    default:
      return level;
  }
}

function runForceLayout(
  nodes: ForceNode[],
  links: ForceLink[],
  profile: NodeGraphForceProfile,
  timeframeCenters: Point[],
) {
  if (nodes.length === 0) {
    return new Map<string, Point>();
  }

  const simulationNodes = nodes.map((node) => ({ ...node }));
  const tuning = deriveForceTuning(simulationNodes, links, profile);

  const simulation = forceSimulation(simulationNodes)
    .force(
      "charge",
      forceManyBody<ForceNode>().strength((node) => (node.kind === "goal" ? tuning.chargeGoal : tuning.chargeTask)),
    )
    .force(
      "collision",
      forceCollide<ForceNode>().radius((node) => (node.kind === "goal" ? tuning.collisionGoal : tuning.collisionTask)).strength(0.98),
    )
    .force(
      "link",
      forceLink<ForceNode, ForceLink>(links)
        .id((node) => node.id)
        .distance((link) => (link.relationship === "goal-task" ? tuning.goalTaskDistance : tuning.parentLinkDistance))
        .strength((link) => (link.relationship === "goal-task" ? tuning.goalTaskStrength : tuning.parentLinkStrength)),
    )
    .force(
      "anchor-x",
      forceX<ForceNode>((node) => node.anchorX).strength((node) => (node.kind === "goal" ? tuning.anchorGoalStrength : tuning.anchorTaskStrength)),
    )
    .force(
      "anchor-y",
      forceY<ForceNode>((node) => node.anchorY).strength((node) => (node.kind === "goal" ? tuning.anchorGoalStrength : tuning.anchorTaskStrength)),
    )
    .force(
      "cluster-x",
      forceX<ForceNode>((node) => timeframeCenters[node.timeframeIndex]?.x ?? CENTER_X).strength((node) =>
        node.kind === "goal" ? tuning.clusterGoalStrength : tuning.clusterTaskStrength,
      ),
    )
    .force(
      "cluster-y",
      forceY<ForceNode>((node) => timeframeCenters[node.timeframeIndex]?.y ?? CENTER_Y).strength((node) =>
        node.kind === "goal" ? tuning.clusterGoalStrength : tuning.clusterTaskStrength,
      ),
    )
    .stop();

  for (let iteration = 0; iteration < tuning.iterations; iteration += 1) {
    simulation.tick();
  }

  const result = new Map<string, Point>();
  for (const node of simulationNodes) {
    result.set(node.id, {
      x: Number.isFinite(node.x) ? node.x : node.anchorX,
      y: Number.isFinite(node.y) ? node.y : node.anchorY,
    });
  }

  return result;
}

function deriveForceTuning(nodes: ForceNode[], links: ForceLink[], profile: NodeGraphForceProfile): ForceTuning {
  const nodeCount = Math.max(1, nodes.length);
  const goalCount = nodes.filter((node) => node.kind === "goal").length;
  const taskCount = nodeCount - goalCount;
  const linkDensity = links.length / nodeCount;
  const spreadScale = Math.max(1, Math.sqrt(nodeCount / 18));
  const profileMultipliers =
    profile === "compact"
      ? { spread: 0.82, anchor: 1.2, cluster: 1.18, distance: 0.84 }
      : profile === "spacious"
        ? { spread: 1.22, anchor: 0.8, cluster: 0.82, distance: 1.18 }
        : { spread: 1, anchor: 1, cluster: 1, distance: 1 };

  return {
    chargeGoal: clamp((-530 - spreadScale * 88 - linkDensity * 28) * profileMultipliers.spread, -1120, -460),
    chargeTask: clamp((-240 - spreadScale * 52 - linkDensity * 16) * profileMultipliers.spread, -720, -190),
    collisionGoal: clamp(98 + spreadScale * 8 + Math.min(12, goalCount * 0.09), 92, 136),
    collisionTask: clamp(88 + spreadScale * 7 + Math.min(14, taskCount * 0.05), 82, 124),
    goalTaskDistance: clamp((164 + spreadScale * 20 + linkDensity * 5) * profileMultipliers.distance, 136, 276),
    parentLinkDistance: clamp((228 + spreadScale * 26 + linkDensity * 10) * profileMultipliers.distance, 186, 360),
    goalTaskStrength: clamp(0.72 - spreadScale * 0.05, 0.5, 0.75),
    parentLinkStrength: clamp(0.42 - spreadScale * 0.05, 0.22, 0.44),
    anchorGoalStrength: clamp((0.09 - spreadScale * 0.015) * profileMultipliers.anchor, 0.03, 0.12),
    anchorTaskStrength: clamp((0.08 - spreadScale * 0.015) * profileMultipliers.anchor, 0.03, 0.1),
    clusterGoalStrength: clamp((0.4 - spreadScale * 0.03) * profileMultipliers.cluster, 0.22, 0.48),
    clusterTaskStrength: clamp((0.34 - spreadScale * 0.03) * profileMultipliers.cluster, 0.18, 0.42),
    iterations: Math.round(clamp(220 + nodeCount * 1.8 + linkDensity * 8, 240, 520)),
  };
}

function buildTimeframeCenters(timeframeCount: number, profile: NodeGraphForceProfile) {
  const centers: Point[] = [];
  if (timeframeCount <= 0) {
    return centers;
  }

  const spacingMultiplier = profile === "compact" ? 0.92 : profile === "spacious" ? 1.28 : 1.14;
  const clusterRadius = (RING_START_RADIUS + Math.max(420, timeframeCount * 122)) * spacingMultiplier;
  for (let index = 0; index < timeframeCount; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / timeframeCount;
    centers.push({
      x: CENTER_X + Math.cos(angle) * clusterRadius,
      y: CENTER_Y + Math.sin(angle) * (clusterRadius * 0.9),
    });
  }

  centers.push({
    x: CENTER_X,
    y: CENTER_Y + clusterRadius * 0.92,
  });

  return centers;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
