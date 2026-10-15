import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { FileCode2, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NODE_HEIGHT, NODE_WIDTH, nodeIcons, typeLabels, type GraphLayout } from "@/lib/graph";

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.75;
const FIT_MARGIN = 28;
const CAPTION_SPACE = 36; // keeps the fitted graph clear of the caption
// Past this many edges, only the selected component's edges are labelled.
const MAX_LABELLED_EDGES = 14;

interface View {
  scale: number;
  x: number;
  y: number;
}

const clamp = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

// Draws a laid-out graph that can be dragged, zoomed, and fitted to the canvas.
export function GraphCanvas({
  layout,
  selected,
  onSelect,
  isDimmed,
  caption,
}: {
  layout: GraphLayout;
  selected: string | undefined;
  onSelect: (id: string) => void;
  isDimmed: (id: string) => boolean;
  caption: ReactNode;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  // Refit on resize until the user pans or zooms, then leave their view alone.
  const [fitted, setFitted] = useState(true);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!size.width || !size.height) return;
    const scale = clamp(
      Math.min(
        1,
        (size.width - FIT_MARGIN * 2) / layout.width,
        (size.height - FIT_MARGIN * 2 - CAPTION_SPACE) / layout.height,
      ),
    );
    setView({
      scale,
      x: (size.width - layout.width * scale) / 2,
      y: CAPTION_SPACE / 2 + (size.height - layout.height * scale) / 2,
    });
    setFitted(true);
  }, [layout, size]);

  useEffect(() => {
    if (fitted) fit();
  }, [fit, fitted]);

  // Zooms keeping the point (px, py) of the canvas still.
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const scale = clamp(v.scale * factor);
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
    setFitted(false);
  }, []);

  // Ctrl/Cmd + wheel zooms; a plain wheel keeps scrolling the page. Registered by hand
  // because React's wheel listener is passive and can't prevent the browser zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Nodes and controls keep their clicks; only the background drags.
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, view };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setView({
      ...start.view,
      x: start.view.x + e.clientX - start.x,
      y: start.view.y + e.clientY - start.y,
    });
    setFitted(false);
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const labelAll = layout.edges.length <= MAX_LABELLED_EDGES;
  // Visible area in graph coordinates, for the minimap.
  const visible = {
    x: -view.x / view.scale,
    y: -view.y / view.scale,
    width: size.width / view.scale,
    height: size.height / view.scale,
  };

  return (
    <div
      ref={canvasRef}
      className={`canvas ${dragging ? "dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="canvas-caption">{caption}</div>
      <div
        className="diagram"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        {layout.lanes.map((lane) => (
          <span key={lane.label} className="layer-label" style={{ left: lane.x, top: 40 }}>
            {lane.label}
          </span>
        ))}
        <svg
          className="edges"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" />
            </marker>
            <marker
              id="arrow-highlight"
              className="highlight"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" />
            </marker>
          </defs>
          {layout.edges.map((edge) => {
            const highlight = edge.from === selected || edge.to === selected;
            const dim = isDimmed(edge.from) && isDimmed(edge.to);
            return (
              <g key={`${edge.from}->${edge.to}`} className={dim ? "dimmed" : ""}>
                <path
                  className={highlight ? "highlight" : ""}
                  d={edge.path}
                  markerEnd={`url(#${highlight ? "arrow-highlight" : "arrow"})`}
                />
                {(labelAll || highlight) && (
                  <text x={edge.labelX} y={edge.labelY - 5} textAnchor="middle">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {layout.nodes.map(({ node, x, y }) => {
          const Icon = nodeIcons[node.type];
          return (
            <Button
              key={node.id}
              variant="ghost"
              className={`graph-node ${node.id === selected ? "chosen" : ""} ${isDimmed(node.id) ? "dimmed" : ""}`}
              style={{ left: x, top: y }}
              aria-label={`Select ${node.name}`}
              aria-pressed={node.id === selected}
              onClick={() => onSelect(node.id)}
            >
              <div className="node-top">
                <span className={`node-icon ${node.type}`}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0">
                  <div className="node-title truncate" title={node.name}>
                    {node.name}
                  </div>
                  <div className="node-technology truncate" title={node.tech}>
                    {node.tech}
                  </div>
                </div>
              </div>
              <div className="node-bottom">
                <span>
                  <FileCode2 size={9} className="inline mr-1" />
                  {node.paths.length ? `${node.files} files` : "No code here"}
                </span>
                <span>{typeLabels[node.type]}</span>
              </div>
            </Button>
          );
        })}
      </div>
      <div className="canvas-controls">
        <Button
          variant="ghost"
          size="icon"
          title="Zoom out"
          onClick={() => zoomAt(1 / 1.2, size.width / 2, size.height / 2)}
        >
          <ZoomOut />
        </Button>
        <span>{Math.round(view.scale * 100)}%</span>
        <Button
          variant="ghost"
          size="icon"
          title="Zoom in"
          onClick={() => zoomAt(1.2, size.width / 2, size.height / 2)}
        >
          <ZoomIn />
        </Button>
        <span className="border-l border-border h-4 p-0" />
        <Button variant="ghost" size="icon" title="Fit graph" onClick={fit}>
          <Maximize />
        </Button>
      </div>
      <div className="minimap" aria-hidden="true">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`}>
          {layout.nodes.map(({ node, x, y }) => (
            <rect
              key={node.id}
              className={node.id === selected ? "chosen" : ""}
              x={x}
              y={y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx="8"
            />
          ))}
          <rect className="focus" {...visible} rx="8" />
        </svg>
      </div>
    </div>
  );
}
