"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Node,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Logo } from "@/components/logo";
import { Globe, Database } from "lucide-react";

function Box({
  children,
  className = "",
  dashed = false,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  dashed?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-lg p-3 ${dashed ? "border border-dashed border-muted-foreground/30" : "border border-border bg-background"} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function BrowserNode() {
  return (
    <div style={{ width: 300, height: 72 }}>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Box style={{ height: 72 }}>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
          <Globe className="size-3" />
          Browser
        </div>
        <div className="space-y-1">
          <div className="h-1 bg-muted-foreground/15 rounded w-full" />
          <div className="h-1 bg-muted-foreground/15 rounded w-3/4" />
          <div className="h-1 bg-muted-foreground/15 rounded w-5/6" />
        </div>
      </Box>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

function ServerGroupNode() {
  return (
    <div style={{ width: 220, height: 190 }}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="text-[10px] text-muted-foreground italic mb-2">Next.js Server</div>
      <Box dashed className="rounded-none w-full h-full" />
    </div>
  );
}

function MiddlewareNode() {
  return (
    <div style={{ width: 200, height: 64 }}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Box style={{ height: 64 }}>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Middleware
        </div>
        <div className="flex items-center gap-1.5">
          <Logo variant="symbol" size="sm" className="size-4" />
          <span className="text-xs font-medium">Nextlytics</span>
        </div>
      </Box>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Right} id="backends" className="opacity-0" />
    </div>
  );
}

function ServerComponentNode() {
  return (
    <div style={{ width: 200, height: 64 }}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Box style={{ height: 64 }}>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Server Page
        </div>
        <div className="text-sm">
          <code className="font-mono">&lt;ServerComponent /&gt;</code>
        </div>
      </Box>
      <Handle type="source" position={Position.Left} id="return" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="backends" className="opacity-0" />
    </div>
  );
}

function RotatedLabelEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) rotate(-90deg)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan text-xs bg-background px-1.5 py-px  border border-border"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function NextlyticsBackendsNode() {
  return (
    <div style={{ width: 200, height: 64 }}>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="opacity-0" />
      <Box style={{ height: 64 }}>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
          <Database className="size-3" />
          Backends
        </div>
        <div className="text-[10px] text-muted-foreground">Segment, DB, etc</div>
      </Box>
    </div>
  );
}

const nodeTypes = {
  browser: BrowserNode,
  serverGroup: ServerGroupNode,
  middleware: MiddlewareNode,
  serverComponent: ServerComponentNode,
  backends: NextlyticsBackendsNode,
};

const edgeTypes = {
  rotatedLabel: RotatedLabelEdge,
};

const nodes: Node[] = [
  { id: "browser", type: "browser", position: { x: 90, y: 0 }, data: {} },
  { id: "serverGroup", type: "serverGroup", position: { x: 10, y: 90 }, data: {} },
  { id: "middleware", type: "middleware", position: { x: 20, y: 130 }, data: {} },
  { id: "serverComponent", type: "serverComponent", position: { x: 20, y: 230 }, data: {} },
  { id: "backends", type: "backends", position: { x: 320, y: 130 }, data: {} },
];

const edges: Edge[] = [
  {
    id: "browser-middleware",
    label: "GET",
    labelStyle: { fontSize: 12 },
    labelBgStyle: { fill: "var(--background)", strokeWidth: 1, stroke: "var(--border)" },
    labelBgPadding: [6, 2] as [number, number],
    source: "browser",
    target: "middleware",
    type: "smoothstep",
    style: { stroke: "#9ca3af", strokeWidth: 1 },
    markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
  },
  {
    id: "middleware-serverComponent",
    source: "middleware",
    target: "serverComponent",
    type: "smoothstep",
    style: { stroke: "#9ca3af", strokeWidth: 1 },
    markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
  },
  {
    id: "middleware-backends",
    source: "middleware",
    label: "page view",
    labelStyle: { fontSize: 12 },
    labelBgStyle: { fill: "var(--background)", strokeWidth: 1, stroke: "var(--border)" },
    labelBgPadding: [6, 2] as [number, number],
    sourceHandle: "backends",
    target: "backends",
    type: "smoothstep",
    style: { stroke: "#9ca3af", strokeWidth: 1, strokeDasharray: "4 2" },
    markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
  },
  {
    id: "serverComponent-browser",
    source: "serverComponent",
    sourceHandle: "return",
    label: "client",
    target: "browser",
    type: "rotatedLabel",
    style: { stroke: "#9ca3af", strokeWidth: 1, strokeDasharray: "4 2" },
    markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
  },
  {
    id: "serverComponent-backends",
    source: "serverComponent",
    sourceHandle: "backends",
    label: "other events",
    labelStyle: { fontSize: 12 },
    labelBgStyle: { fill: "var(--background)", strokeWidth: 1, stroke: "var(--border)" },
    labelBgPadding: [6, 2] as [number, number],
    target: "backends",
    targetHandle: "bottom",
    type: "smoothstep",
    style: { stroke: "#9ca3af", strokeWidth: 1, strokeDasharray: "4 2" },
    markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
  },
];

const CHART_WIDTH = 580; // natural width of the chart content

export function ServerFlowDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const updateZoom = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const newZoom = Math.min(1, containerWidth / CHART_WIDTH);
      setZoom(newZoom);
    };

    updateZoom();
    window.addEventListener("resize", updateZoom);
    return () => window.removeEventListener("resize", updateZoom);
  }, []);

  const fitViewOptions = useMemo(() => ({ padding: 0.1, minZoom: zoom, maxZoom: zoom }), [zoom]);

  return (
    <div ref={containerRef} className="w-full max-w-5xl" style={{ aspectRatio: "5 / 3" }}>
      <ReactFlow
        key={zoom}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={fitViewOptions}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}
