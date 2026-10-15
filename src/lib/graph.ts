import { Box, Database, Globe, Zap } from "lucide-react";
import type { ArchitectureGraph, ComponentType, GraphComponent } from "@/lib/api";

export type View =
  | "System architecture"
  | "Dependencies"
  | "Function calls"
  | "Database schema"
  | "API interactions"
  | "Cloud infrastructure"
  | "CI/CD workflows";
export const views: View[] = [
  "System architecture",
  "Dependencies",
  "Function calls",
  "Database schema",
  "API interactions",
  "Cloud infrastructure",
  "CI/CD workflows",
];
// The analyzer maps system architecture only; the other views are placeholders for now.
export const generatedViews: View[] = ["System architecture"];

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 91;
const ROW_GAP = 36;
const COLUMN_GAP = 44; // between columns inside one lane
const LANE_GAP = 130; // between lanes, leaving room for edge labels
const PADDING = 40;
const LABEL_SPACE = 34; // above the first row, for the lane label
const MAX_ROWS = 5;

// Left to right: clients call services, services reach data stores and third parties.
const lanes: { label: string; types: ComponentType[] }[] = [
  { label: "Client layer", types: ["frontend"] },
  { label: "Service layer", types: ["service"] },
  { label: "Data & integrations", types: ["data", "external"] },
];

export interface PlacedNode {
  node: GraphComponent;
  x: number;
  y: number;
}

export interface PlacedEdge {
  from: string;
  to: string;
  label: string;
  path: string;
  // Where the label sits: the curve's midpoint.
  labelX: number;
  labelY: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  lanes: { label: string; x: number }[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

// Places any number of components in type lanes, wrapping a long lane into extra columns,
// and orders each lane by where its neighbours sit so edges cross less.
export function layoutGraph(graph: Pick<ArchitectureGraph, "components" | "connections">) {
  const neighbours = new Map<string, string[]>(graph.components.map((c) => [c.id, []]));
  for (const { from, to } of graph.connections) {
    neighbours.get(from)?.push(to);
    neighbours.get(to)?.push(from);
  }

  const groups = lanes
    .map((lane) => ({
      label: lane.label,
      nodes: graph.components
        .filter((c) => lane.types.includes(c.type))
        .sort(
          (a, b) =>
            lane.types.indexOf(a.type) - lane.types.indexOf(b.type) || a.name.localeCompare(b.name),
        ),
    }))
    .filter((lane) => lane.nodes.length > 0);

  // Row-major placement keeps list order top to bottom, so ordering a lane orders its rows.
  const shape = groups.map(({ nodes }) => {
    const columns = Math.ceil(nodes.length / MAX_ROWS);
    return { columns, rows: Math.ceil(nodes.length / columns) };
  });
  const height =
    Math.max(...shape.map(({ rows }) => rows * NODE_HEIGHT + (rows - 1) * ROW_GAP), 0) +
    PADDING * 2 +
    LABEL_SPACE;

  // Barycentre sweeps: each component's relative height is where it sits in its lane.
  const relativeY = new Map<string, number>();
  const measure = () =>
    groups.forEach(({ nodes }, l) => {
      const { columns, rows } = shape[l]!;
      nodes.forEach((n, i) => relativeY.set(n.id, (Math.floor(i / columns) + 0.5) / rows));
    });
  measure();
  for (let sweep = 0; sweep < 4; sweep++) {
    for (const lane of groups) {
      const score = (id: string) => {
        const ys = (neighbours.get(id) ?? []).map((n) => relativeY.get(n) ?? 0.5);
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : (relativeY.get(id) ?? 0.5);
      };
      const scores = new Map(lane.nodes.map((n) => [n.id, score(n.id)]));
      lane.nodes.sort((a, b) => scores.get(a.id)! - scores.get(b.id)!);
      measure();
    }
  }

  const placed: PlacedNode[] = [];
  const laneLabels: GraphLayout["lanes"] = [];
  let x = PADDING;
  groups.forEach(({ label, nodes }, l) => {
    const { columns, rows } = shape[l]!;
    const laneHeight = rows * NODE_HEIGHT + (rows - 1) * ROW_GAP;
    const top = PADDING + LABEL_SPACE + (height - PADDING * 2 - LABEL_SPACE - laneHeight) / 2;
    laneLabels.push({ label, x: x + 6 });
    nodes.forEach((node, i) => {
      const lastRowSize = nodes.length - (rows - 1) * columns;
      const row = Math.floor(i / columns);
      // Centre a short last row under the ones above it.
      const indent =
        row === rows - 1 ? ((columns - lastRowSize) * (NODE_WIDTH + COLUMN_GAP)) / 2 : 0;
      placed.push({
        node,
        x: x + indent + (i % columns) * (NODE_WIDTH + COLUMN_GAP),
        y: top + row * (NODE_HEIGHT + ROW_GAP),
      });
    });
    x += columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP + LANE_GAP;
  });
  const width = placed.length ? x - LANE_GAP + PADDING : PADDING * 2;

  const at = new Map(placed.map((p) => [p.node.id, p]));
  const pairs = new Set(graph.connections.map((c) => `${c.from}->${c.to}`));
  const edges = graph.connections.flatMap((c): PlacedEdge[] => {
    const a = at.get(c.from);
    const b = at.get(c.to);
    if (!a || !b) return [];
    // Calls in both directions would draw on top of each other, so nudge them apart.
    const nudge = pairs.has(`${c.to}->${c.from}`) ? (c.from < c.to ? -9 : 9) : 0;
    return [{ ...c, ...route(a, b, nudge) }];
  });

  return { width, height, lanes: laneLabels, nodes: placed, edges } satisfies GraphLayout;
}

// A cubic curve between the facing sides of two nodes.
function route(a: PlacedNode, b: PlacedNode, nudge: number) {
  const stacked = Math.abs(a.x - b.x) < NODE_WIDTH;
  let p0: [number, number], p3: [number, number], c1: [number, number], c2: [number, number];
  if (stacked) {
    const down = b.y > a.y;
    p0 = [a.x + NODE_WIDTH / 2 + nudge, down ? a.y + NODE_HEIGHT : a.y];
    p3 = [b.x + NODE_WIDTH / 2 + nudge, down ? b.y : b.y + NODE_HEIGHT];
    const bend = Math.max(24, Math.abs(p3[1] - p0[1]) / 2) * (down ? 1 : -1);
    c1 = [p0[0], p0[1] + bend];
    c2 = [p3[0], p3[1] - bend];
  } else {
    const right = b.x > a.x;
    p0 = [right ? a.x + NODE_WIDTH : a.x, a.y + NODE_HEIGHT / 2 + nudge];
    p3 = [right ? b.x : b.x + NODE_WIDTH, b.y + NODE_HEIGHT / 2 + nudge];
    const bend = Math.max(40, Math.abs(p3[0] - p0[0]) / 2) * (right ? 1 : -1);
    c1 = [p0[0] + bend, p0[1]];
    c2 = [p3[0] - bend, p3[1]];
  }
  return {
    path: `M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}`,
    labelX: (p0[0] + 3 * c1[0] + 3 * c2[0] + p3[0]) / 8,
    labelY: (p0[1] + 3 * c1[1] + 3 * c2[1] + p3[1]) / 8,
  };
}

export const nodeIcons = { frontend: Globe, service: Box, data: Database, external: Zap };

export const typeLabels: Record<ComponentType, string> = {
  frontend: "Application",
  service: "Service",
  data: "Data store",
  external: "External",
};
