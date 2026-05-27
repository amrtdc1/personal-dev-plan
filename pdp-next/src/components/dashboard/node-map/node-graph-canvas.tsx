"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { type GraphNodeData } from "@/components/dashboard/node-map/graph-adapter";

type NodeGraphCanvasProps = {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  onOpenItem?: (kind: "goal" | "task", id: string) => void;
};

const nodeTypes: NodeTypes = {
  entity: EntityNode,
};

export function NodeGraphCanvas({ nodes, edges, onOpenItem }: NodeGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <NodeGraphCanvasInner nodes={nodes} edges={edges} onOpenItem={onOpenItem} />
    </ReactFlowProvider>
  );
}

function NodeGraphCanvasInner({ nodes, edges, onOpenItem }: NodeGraphCanvasProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges] = useEdgesState(edges);
  const dragSessionRef = useRef<{
    rootId: string;
    rootStartPosition: { x: number; y: number };
    descendantDepthById: Map<string, number>;
    initialPositions: Map<string, { x: number; y: number }>;
  } | null>(null);
  const settleFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);

  useEffect(() => {
    return () => {
      if (settleFrameRef.current !== null) {
        cancelAnimationFrame(settleFrameRef.current);
      }
    };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const relatedNodeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const ids = new Set<string>([selectedNodeId]);

    for (const edge of flowEdges) {
      if (edge.source === selectedNodeId) {
        ids.add(edge.target);
      }

      if (edge.target === selectedNodeId) {
        ids.add(edge.source);
      }
    }

    return ids;
  }, [flowEdges, selectedNodeId]);

  const displayedNodes = useMemo(() => {
    return flowNodes.map((node) => {
      const titleMatches = normalizedQuery.length === 0 || node.data.title.toLowerCase().includes(normalizedQuery);
      const isSelected = selectedNodeId === node.id;
      const isRelated = relatedNodeIds.has(node.id);

      return {
        ...node,
        data: {
          ...node.data,
          isSelected,
          isRelated,
          isDimmed: !titleMatches || (selectedNodeId ? !isRelated : false),
        },
      };
    });
  }, [flowNodes, normalizedQuery, relatedNodeIds, selectedNodeId]);

  const displayedEdges = useMemo(() => {
    return flowEdges.map((edge) => {
      const relationshipType = edge.data && typeof edge.data === "object" && "relationship" in edge.data
        ? String((edge.data as { relationship?: string }).relationship ?? "")
        : "";
      const isPathEdge = selectedNodeId
        ? edge.source === selectedNodeId || edge.target === selectedNodeId
        : false;
      const isTaskEdge = relationshipType === "goal-task";

      return {
        ...edge,
        type: "simplebezier",
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        animated: isPathEdge,
        style: {
          strokeWidth: isPathEdge ? 2.6 : isTaskEdge ? 1.25 : 1.65,
          stroke: isPathEdge ? "#0f172a" : isTaskEdge ? "#7c3aed" : "#334155",
          strokeDasharray: isTaskEdge ? "3 5" : undefined,
          opacity: selectedNodeId ? (isPathEdge ? 1 : 0.18) : 0.6,
        },
      };
    });
  }, [flowEdges, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }

    return displayedNodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [displayedNodes, selectedNodeId]);

  function openSelectedNode() {
    if (!selectedNode) {
      return;
    }

    onOpenItem?.(selectedNode.data.kind, selectedNode.data.entityId);
  }

  function beginDrag(rootId: string, position: { x: number; y: number }) {
    const descendantDepthById = collectDescendantDepths(rootId, flowEdges);
    if (descendantDepthById.size === 0) {
      dragSessionRef.current = null;
      return;
    }

    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const node of flowNodes) {
      if (node.id === rootId || descendantDepthById.has(node.id)) {
        initialPositions.set(node.id, { ...node.position });
      }
    }

    dragSessionRef.current = {
      rootId,
      rootStartPosition: position,
      descendantDepthById,
      initialPositions,
    };
  }

  function syncDraggedFamily(
    rootId: string,
    position: { x: number; y: number },
    phase: "drag" | "overshoot" | "settle" = "drag",
  ) {
    const session = dragSessionRef.current;
    if (!session || session.rootId !== rootId) {
      return;
    }

    const deltaX = position.x - session.rootStartPosition.x;
    const deltaY = position.y - session.rootStartPosition.y;

    setFlowNodes((currentNodes) =>
      currentNodes.map((currentNode) => {
        if (!session.descendantDepthById.has(currentNode.id) || currentNode.id === rootId) {
          return currentNode;
        }

        const initialPosition = session.initialPositions.get(currentNode.id);
        if (!initialPosition) {
          return currentNode;
        }

        const depth = session.descendantDepthById.get(currentNode.id) ?? 1;
        const targetPosition = {
          x: initialPosition.x + deltaX,
          y: initialPosition.y + deltaY,
        };

        if (phase === "settle") {
          return {
            ...currentNode,
            position: targetPosition,
          };
        }

        if (phase === "overshoot") {
          const overshoot = getOvershootMultiplierForDepth(depth);
          return {
            ...currentNode,
            position: {
              x: initialPosition.x + deltaX * overshoot,
              y: initialPosition.y + deltaY * overshoot,
            },
          };
        }

        const blend = getElasticBlendForDepth(depth);

        return {
          ...currentNode,
          position: {
            x: currentNode.position.x + (targetPosition.x - currentNode.position.x) * blend,
            y: currentNode.position.y + (targetPosition.y - currentNode.position.y) * blend,
          },
        };
      }),
    );
  }

  function endDrag(rootId: string, position: { x: number; y: number }) {
    syncDraggedFamily(rootId, position, "overshoot");

    if (settleFrameRef.current !== null) {
      cancelAnimationFrame(settleFrameRef.current);
    }

    settleFrameRef.current = requestAnimationFrame(() => {
      settleFrameRef.current = requestAnimationFrame(() => {
        syncDraggedFamily(rootId, position, "settle");
        settleFrameRef.current = null;
      });
    });

    dragSessionRef.current = null;
  }

  return (
    <div className="bg-transparent p-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                openSelectedNode();
              }
            }}
            placeholder="Search nodes..."
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
            aria-label="Search graph nodes"
          />
          <button
            type="button"
            onClick={openSelectedNode}
            disabled={!selectedNode}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open selected
          </button>
        </div>
      </div>

      <div className="h-[560px] rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_center,_#f8fafc_10%,_#e2e8f0_80%)]">
        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.2}
          maxZoom={2.2}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onNodeDragStart={(_, node) => beginDrag(node.id, node.position)}
          onNodeDrag={(_, node) => syncDraggedFamily(node.id, node.position)}
          onNodeDragStop={(_, node) => endDrag(node.id, node.position)}
          onNodeDoubleClick={(_, node) => onOpenItem?.(node.data.kind, node.data.entityId)}
          onPaneClick={() => setSelectedNodeId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              const data = node.data as GraphNodeData | undefined;
              if (!data) {
                return "#94a3b8";
              }
              return data.kind === "goal" ? "#0284c7" : "#a855f7";
            }}
            maskColor="rgba(148, 163, 184, 0.2)"
          />
          <Controls showInteractive={false} />
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#cbd5e1" />
        </ReactFlow>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Force-directed view clusters by timeframe anchors while physics spacing reduces node collisions and keeps cross-timeframe links visible.
      </p>
    </div>
  );
}

function collectDescendantDepths(rootId: string, edges: Edge[]) {
  const descendantDepthById = new Map<string, number>();
  const pendingNodes: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

  while (pendingNodes.length > 0) {
    const currentNode = pendingNodes.shift();
    if (!currentNode) {
      continue;
    }

    for (const edge of edges) {
      if (edge.source !== currentNode.id || descendantDepthById.has(edge.target)) {
        continue;
      }

      const nextDepth = currentNode.depth + 1;
      descendantDepthById.set(edge.target, nextDepth);
      pendingNodes.push({ id: edge.target, depth: nextDepth });
    }
  }

  return descendantDepthById;
}

function getElasticBlendForDepth(depth: number) {
  const normalizedDepth = Math.max(1, depth);
  return Math.max(0.04, 0.17 - normalizedDepth * 0.024);
}

function getOvershootMultiplierForDepth(depth: number) {
  const normalizedDepth = Math.max(1, depth);
  return Math.max(1.04, 1.14 - normalizedDepth * 0.015);
}

function EntityNode({ data }: NodeProps) {
  const typedData = data as GraphNodeData & { isSelected?: boolean; isRelated?: boolean; isDimmed?: boolean };
  const isGoal = typedData.kind === "goal";
  const borderColor = isGoal ? "border-sky-300" : "border-violet-300";
  const badgeColor = isGoal ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700";

  return (
    <div
      className={`w-[176px] rounded-xl border bg-white/95 px-3 py-2 shadow-sm transition ${borderColor} ${
        typedData.isSelected ? "ring-2 ring-slate-900" : ""
      } ${typedData.isDimmed ? "opacity-35" : "opacity-100"}`}
    >
      <Handle type="target" id="target" position={Position.Left} className="!h-2 !w-2 !border !border-white !bg-slate-400" />
      <Handle type="source" id="source" position={Position.Right} className="!h-2 !w-2 !border !border-white !bg-slate-400" />
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-semibold text-slate-900">{typedData.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeColor}`}>
          {typedData.kind}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 text-[10px] uppercase tracking-wide text-slate-500">{typedData.status.replace("_", " ")}</p>
      <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{typedData.subtitle}</p>
    </div>
  );
}
