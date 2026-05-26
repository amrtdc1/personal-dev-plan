"use client";

import { memo, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { type GraphNodeData } from "@/components/dashboard/node-map/graph-adapter";

type NodeGraphCanvasProps = {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  onOpenItem?: (kind: "goal" | "task", id: string) => void;
};

const nodeTypes = {
  entity: memo(EntityNode),
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

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const relatedNodeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const ids = new Set<string>([selectedNodeId]);

    for (const edge of edges) {
      if (edge.source === selectedNodeId) {
        ids.add(edge.target);
      }

      if (edge.target === selectedNodeId) {
        ids.add(edge.source);
      }
    }

    return ids;
  }, [edges, selectedNodeId]);

  const displayedNodes = useMemo(() => {
    return nodes.map((node) => {
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
  }, [nodes, normalizedQuery, relatedNodeIds, selectedNodeId]);

  const displayedEdges = useMemo(() => {
    return edges.map((edge) => {
      const relationshipType = edge.data && typeof edge.data === "object" && "relationship" in edge.data
        ? String((edge.data as { relationship?: string }).relationship ?? "")
        : "";
      const isPathEdge = selectedNodeId
        ? edge.source === selectedNodeId || edge.target === selectedNodeId
        : false;
      const isTaskEdge = relationshipType === "goal-task";

      return {
        ...edge,
        type: isTaskEdge ? "bezier" : "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        animated: isPathEdge,
        style: {
          strokeWidth: isPathEdge ? 2.6 : isTaskEdge ? 1.4 : 1.8,
          stroke: isPathEdge ? "#0f172a" : isTaskEdge ? "#a78bfa" : "#64748b",
          strokeDasharray: isTaskEdge ? "4 5" : undefined,
          opacity: selectedNodeId ? (isPathEdge ? 1 : 0.25) : 0.7,
        },
      };
    });
  }, [edges, selectedNodeId]);

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

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
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

      <div className="h-[560px] rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50">
        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.3}
          maxZoom={2.2}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
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
        Single-click selects and highlights nearby paths. Use the button (or Enter) to open the selected item in Planning.
      </p>
    </div>
  );
}

function EntityNode({ data }: NodeProps<GraphNodeData & { isSelected?: boolean; isRelated?: boolean; isDimmed?: boolean }>) {
  const isGoal = data.kind === "goal";
  const borderColor = isGoal ? "border-sky-300" : "border-violet-300";
  const badgeColor = isGoal ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700";

  return (
    <div
      className={`w-[176px] rounded-xl border bg-white/95 px-3 py-2 shadow-sm transition ${borderColor} ${
        data.isSelected ? "ring-2 ring-slate-900" : ""
      } ${data.isDimmed ? "opacity-35" : "opacity-100"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-semibold text-slate-900">{data.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeColor}`}>
          {data.kind}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 text-[10px] uppercase tracking-wide text-slate-500">{data.status.replace("_", " ")}</p>
      <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{data.subtitle}</p>
    </div>
  );
}
