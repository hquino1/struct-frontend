import {
  Box,
  Braces,
  CircleAlert,
  Cloud,
  Component,
  Cog,
  Container,
  Database,
  FileJson,
  Globe,
  Inbox,
  KeyRound,
  MonitorSmartphone,
  MoreHorizontal,
  Package,
  Play,
  Rocket,
  Route,
  Server,
  ShieldCheck,
  Table2,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  ArchitectureGraph,
  ComponentType,
  GraphComponent,
  ViewField,
  ViewGraph,
  ViewId,
  ViewNode,
} from "@/lib/api";

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

export const nodeIcons = { frontend: Globe, service: Box, data: Database, external: Zap };

export const typeLabels: Record<ComponentType, string> = {
  frontend: "Application",
  service: "Service",
  data: "Data store",
  external: "External",
};

// How each kind of node in an explore view is drawn. `tone` reuses the component colours.
export interface NodeKind {
  label: string;
  tone: ComponentType;
  icon: LucideIcon;
}

export interface ViewMeta {
  id: ViewId;
  // What a node's group is, e.g. "Workflow".
  groupLabel: string;
  // Columns in this order, one per group ("groups": one per group, in order of appearance);
  // without it, groups are bands of a flow.
  lanes?: string[] | "groups";
  // Shown when the repository has nothing this view draws.
  empty: string;
  kinds: Record<string, NodeKind>;
  // A one-line count for the canvas caption, e.g. "2 workflows · 9 jobs".
  summary: (nodes: ViewNode[]) => string;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The explore views the analyzer builds. Views missing here aren't generated yet.
export const viewMeta: Partial<Record<View, ViewMeta>> = {
  Dependencies: {
    id: "dependencies",
    groupLabel: "Section",
    lanes: ["Components", "Packages"],
    empty:
      "No packages or imports found. Struct reads JS/TS and Python imports, plus package.json, requirements.txt, pyproject.toml, go.mod, and Cargo.toml.",
    kinds: {
      component: { label: "Component", tone: "service", icon: Box },
      package: { label: "Package", tone: "data", icon: Package },
      dev: { label: "Dev package", tone: "external", icon: Wrench },
      more: { label: "More", tone: "frontend", icon: MoreHorizontal },
    },
    summary: (nodes) => {
      const components = nodes.filter((n) => n.kind === "component").length;
      return `${count(components, "component")} · ${count(nodes.length - components, "package")}`;
    },
  },
  "Function calls": {
    id: "calls",
    groupLabel: "Component",
    lanes: "groups",
    empty:
      "No function calls found. Struct reads JavaScript and TypeScript, following imports, re-exports, class methods, and injected services.",
    kinds: {
      function: { label: "Function", tone: "service", icon: Braces },
      method: { label: "Method", tone: "service", icon: Box },
      component: { label: "UI component", tone: "frontend", icon: Component },
      handler: { label: "Route handler", tone: "data", icon: Route },
    },
    summary: (nodes) => {
      const groups = new Set(nodes.map((n) => n.group)).size;
      return `${count(nodes.length, "function")} · ${count(groups, "component")}`;
    },
  },
  "Database schema": {
    id: "schema",
    groupLabel: "Database",
    lanes: "groups",
    empty:
      "No database schema found. Struct reads Prisma schemas and SQL migrations, and asks the AI model about ORM classes and DynamoDB key designs in your code.",
    kinds: {
      table: { label: "Table", tone: "data", icon: Table2 },
      collection: { label: "Collection", tone: "service", icon: FileJson },
      item: { label: "Item type", tone: "external", icon: KeyRound },
    },
    summary: (nodes) => {
      const databases = new Set(nodes.map((n) => n.group)).size;
      return `${count(nodes.length, "entity", "entities")} · ${count(databases, "database")}`;
    },
  },
  "API interactions": {
    id: "api",
    groupLabel: "Section",
    lanes: ["Callers"],
    empty:
      "No HTTP routes or calls found. Struct reads NestJS, Express-style servers, Next.js, FastAPI, Flask, Django, Spring, Go, and OpenAPI specs, and calls made with fetch, axios, or API client wrappers.",
    kinds: {
      client: { label: "Caller", tone: "frontend", icon: MonitorSmartphone },
      endpoint: { label: "Endpoint", tone: "service", icon: Route },
      missing: { label: "No matching route", tone: "data", icon: CircleAlert },
      remote: { label: "External API", tone: "external", icon: Cloud },
    },
    summary: (nodes) => {
      const endpoints = nodes.filter((n) => n.kind === "endpoint").length;
      const callers = nodes.filter((n) => n.kind === "client").length;
      return `${count(endpoints, "endpoint")} · ${count(callers, "caller")}`;
    },
  },
  "Cloud infrastructure": {
    id: "infrastructure",
    groupLabel: "Layer",
    lanes: ["Network", "Compute", "Data & messaging", "Security & other"],
    empty:
      "No infrastructure config found. Struct reads Terraform, CloudFormation and SAM, Serverless, Docker Compose, Dockerfiles, Kubernetes manifests, and wrangler config.",
    kinds: {
      network: { label: "Network", tone: "frontend", icon: Globe },
      compute: { label: "Compute", tone: "service", icon: Server },
      image: { label: "Container image", tone: "service", icon: Container },
      data: { label: "Data store", tone: "data", icon: Database },
      messaging: { label: "Messaging", tone: "external", icon: Inbox },
      security: { label: "Security", tone: "external", icon: ShieldCheck },
      other: { label: "Other", tone: "external", icon: Box },
    },
    summary: (nodes) => {
      const layers = new Set(nodes.map((n) => n.group)).size;
      return `${count(nodes.length, "resource")} · ${count(layers, "layer")}`;
    },
  },
  "CI/CD workflows": {
    id: "ci-cd",
    groupLabel: "Workflow",
    empty:
      "No CI/CD configuration found. Struct reads GitHub Actions workflows (.github/workflows) and .gitlab-ci.yml.",
    kinds: {
      trigger: { label: "Trigger", tone: "frontend", icon: Play },
      job: { label: "Job", tone: "service", icon: Cog },
      deploy: { label: "Deploy", tone: "data", icon: Rocket },
      workflow: { label: "Reusable workflow", tone: "external", icon: Workflow },
    },
    summary: (nodes) => {
      const triggers = nodes.filter((n) => n.kind === "trigger").length;
      const workflows = new Set(nodes.map((n) => n.group)).size;
      return `${count(workflows, "workflow")} · ${count(nodes.length - triggers, "job")}`;
    },
  },
};

const fallbackKind: NodeKind = { label: "Node", tone: "service", icon: Box };
export const kindOf = (meta: ViewMeta, kind: string) => meta.kinds[kind] ?? fallbackKind;

// What the canvas draws for one node, whatever graph it comes from.
export interface CanvasNode {
  id: string;
  name: string;
  subtitle: string;
  tone: ComponentType;
  icon: LucideIcon;
  footLeft: string;
  footRight: string;
  // Rows listed on the card, e.g. a table's columns; such cards grow to fit them.
  fields?: ViewField[];
  height: number;
}

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 91;
export const MAX_CARD_FIELDS = 10;
export const FIELD_ROW = 15;
const CARD_HEADER = 62;

// A card's height: the header, its fields, and a "+N more" row when they don't all fit.
export const cardHeight = (fields: ViewField[] | undefined) =>
  fields
    ? CARD_HEADER +
      (Math.min(fields.length, MAX_CARD_FIELDS) + (fields.length > MAX_CARD_FIELDS ? 1 : 0)) *
        FIELD_ROW +
      10
    : NODE_HEIGHT;
const ROW_GAP = 36;
const COLUMN_GAP = 44; // between columns inside one lane
const LANE_GAP = 130; // between lanes, leaving room for edge labels
const FLOW_COLUMN_GAP = 84; // between steps of a flow
const BAND_GAP = 44; // between the bands of a flow
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
  node: CanvasNode;
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
  lanes: { label: string; x: number; y: number }[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

const componentNode = (c: GraphComponent): CanvasNode => ({
  id: c.id,
  name: c.name,
  subtitle: c.tech,
  tone: c.type,
  icon: nodeIcons[c.type],
  footLeft: c.paths.length ? `${c.files} files` : "No code here",
  footRight: typeLabels[c.type],
  height: NODE_HEIGHT,
});

// The architecture map: components in type lanes, clients to the left.
export function layoutGraph(graph: Pick<ArchitectureGraph, "components" | "connections">) {
  return layoutLanes(
    lanes.map((lane) => ({
      label: lane.label,
      nodes: graph.components
        .filter((c) => lane.types.includes(c.type))
        .sort(
          (a, b) =>
            lane.types.indexOf(a.type) - lane.types.indexOf(b.type) || a.name.localeCompare(b.name),
        )
        .map(componentNode),
    })),
    graph.connections,
  );
}

// Places nodes in labelled columns, wrapping a long column into a block of several, and
// orders each block by where its neighbours sit so edges cross less.
function layoutLanes(
  laneList: { label: string; nodes: CanvasNode[] }[],
  links: { from: string; to: string; label: string }[],
) {
  const neighbours = new Map<string, string[]>();
  for (const { from, to } of links) {
    neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
    neighbours.set(to, [...(neighbours.get(to) ?? []), from]);
  }
  const groups = laneList
    .filter((lane) => lane.nodes.length > 0)
    .map((lane) => ({ ...lane, nodes: [...lane.nodes] }));

  // Row-major placement keeps list order top to bottom, so ordering a lane orders its rows.
  // Large lanes grow towards a square rather than one very wide strip.
  const shape = groups.map(({ nodes }) => {
    const maxRows = Math.max(MAX_ROWS, Math.ceil(Math.sqrt(nodes.length)));
    const columns = Math.ceil(nodes.length / maxRows);
    return { columns, rows: Math.ceil(nodes.length / columns) };
  });
  // Barycentre sweeps: each node's relative height is where it sits in its lane.
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

  // Each row is as tall as its tallest card, once the sweeps have settled the order.
  const rowHeights = groups.map(({ nodes }, l) => {
    const { columns, rows } = shape[l]!;
    return Array.from({ length: rows }, (_, r) =>
      Math.max(...nodes.slice(r * columns, (r + 1) * columns).map((n) => n.height)),
    );
  });
  const laneHeights = rowHeights.map(
    (rows) => rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * ROW_GAP,
  );
  const height = Math.max(...laneHeights, 0) + PADDING * 2 + LABEL_SPACE;

  const placed: PlacedNode[] = [];
  const laneLabels: GraphLayout["lanes"] = [];
  let x = PADDING;
  groups.forEach(({ label, nodes }, l) => {
    const { columns, rows } = shape[l]!;
    const top = PADDING + LABEL_SPACE + (height - PADDING * 2 - LABEL_SPACE - laneHeights[l]!) / 2;
    const rowTops = rowHeights[l]!.map(
      (_, r) => top + rowHeights[l]!.slice(0, r).reduce((a, b) => a + b, 0) + r * ROW_GAP,
    );
    laneLabels.push({ label, x: x + 6, y: PADDING });
    nodes.forEach((node, i) => {
      const lastRowSize = nodes.length - (rows - 1) * columns;
      const row = Math.floor(i / columns);
      // Centre a short last row under the ones above it.
      const indent =
        row === rows - 1 ? ((columns - lastRowSize) * (NODE_WIDTH + COLUMN_GAP)) / 2 : 0;
      placed.push({
        node,
        x: x + indent + (i % columns) * (NODE_WIDTH + COLUMN_GAP),
        y: rowTops[row]!,
      });
    });
    x += columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP + LANE_GAP;
  });
  const width = placed.length ? x - LANE_GAP + PADDING : PADDING * 2;

  return {
    width,
    height,
    lanes: laneLabels,
    nodes: placed,
    edges: routeEdges(placed, links),
  } satisfies GraphLayout;
}

// Draws an explore view node with its kind's icon and colour, naming the component it
// belongs to when there is one.
const viewNode =
  (meta: ViewMeta, componentName: (id: string) => string | undefined) =>
  (n: ViewNode): CanvasNode => {
    const kind = kindOf(meta, n.kind);
    return {
      id: n.id,
      name: n.name,
      subtitle: n.detail,
      tone: kind.tone,
      icon: kind.icon,
      footLeft: (n.componentId && componentName(n.componentId)) || n.path?.split("/").pop() || "",
      footRight: kind.label,
      ...(n.fields && { fields: n.fields }),
      height: cardHeight(n.fields),
    };
  };

// Lays out an explore view the way its meta says: columns per group, or a flow.
export function layoutView(
  graph: Pick<ViewGraph, "nodes" | "edges">,
  meta: ViewMeta,
  componentName: (id: string) => string | undefined,
) {
  if (!meta.lanes) return layoutFlow(graph, meta, componentName);
  const toCanvas = viewNode(meta, componentName);
  // Groups the meta doesn't list go last, so nothing is dropped.
  const listed = meta.lanes === "groups" ? [] : meta.lanes;
  const order = [...new Set([...listed, ...graph.nodes.map((n) => n.group)])];
  return layoutLanes(
    order.map((label) => ({
      label,
      nodes: graph.nodes.filter((n) => n.group === label).map(toCanvas),
    })),
    graph.edges,
  );
}

// Lays out a flow such as a CI pipeline: one horizontal band per group (e.g. workflow),
// with each node one column right of the furthest node it waits for.
export function layoutFlow(
  graph: Pick<ViewGraph, "nodes" | "edges">,
  meta: ViewMeta,
  componentName: (id: string) => string | undefined,
) {
  const groupOf = new Map(graph.nodes.map((n) => [n.id, n.group]));
  const groups = [...new Set(graph.nodes.map((n) => n.group))];
  // Only edges inside a band set columns; links between bands are just drawn.
  const inner = graph.edges.filter(
    (e) => groupOf.get(e.from) === groupOf.get(e.to) && groupOf.has(e.from),
  );

  // Longest path from the band's starts. Bounded passes, so a cycle can't loop forever.
  const column = new Map(graph.nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let changed = false;
    for (const { from, to } of inner) {
      const next = column.get(from)! + 1;
      if (next > column.get(to)! && next < graph.nodes.length) {
        column.set(to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const predecessors = new Map<string, string[]>();
  for (const { from, to } of inner) predecessors.set(to, [...(predecessors.get(to) ?? []), from]);

  const toCanvas = viewNode(meta, componentName);

  const placed: PlacedNode[] = [];
  const bandLabels: GraphLayout["lanes"] = [];
  const row = new Map<string, number>();
  let top = PADDING;
  let maxColumn = 0;
  for (const group of groups) {
    const members = graph.nodes.filter((n) => n.group === group);
    const columns = new Map<number, ViewNode[]>();
    for (const n of members) {
      const c = column.get(n.id)!;
      columns.set(c, [...(columns.get(c) ?? []), n]);
      maxColumn = Math.max(maxColumn, c);
    }
    // Left to right, each column sorted by where the nodes it waits for sit.
    for (const c of [...columns.keys()].sort((a, b) => a - b)) {
      const nodes = columns.get(c)!;
      const score = (n: ViewNode) => {
        const rows = (predecessors.get(n.id) ?? []).map((p) => row.get(p) ?? 0);
        return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : 0;
      };
      const scores = new Map(nodes.map((n) => [n.id, score(n)]));
      nodes.sort((a, b) => scores.get(a.id)! - scores.get(b.id)!);
      nodes.forEach((n, i) => row.set(n.id, i));
    }
    const rows = Math.max(...[...columns.values()].map((nodes) => nodes.length));
    bandLabels.push({ label: group, x: PADDING + 6, y: top });
    for (const n of members) {
      placed.push({
        node: toCanvas(n),
        x: PADDING + column.get(n.id)! * (NODE_WIDTH + FLOW_COLUMN_GAP),
        y: top + LABEL_SPACE + row.get(n.id)! * (NODE_HEIGHT + ROW_GAP),
      });
    }
    top += LABEL_SPACE + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP + BAND_GAP;
  }

  return {
    width: placed.length
      ? PADDING * 2 + (maxColumn + 1) * NODE_WIDTH + maxColumn * FLOW_COLUMN_GAP
      : PADDING * 2,
    height: placed.length ? top - BAND_GAP + PADDING : PADDING * 2,
    lanes: bandLabels,
    nodes: placed,
    edges: routeEdges(placed, graph.edges),
  } satisfies GraphLayout;
}

function routeEdges(placed: PlacedNode[], links: { from: string; to: string; label: string }[]) {
  const at = new Map(placed.map((p) => [p.node.id, p]));
  const pairs = new Set(links.map((c) => `${c.from}->${c.to}`));
  return links.flatMap((c): PlacedEdge[] => {
    const a = at.get(c.from);
    const b = at.get(c.to);
    if (!a || !b) return [];
    // Links in both directions would draw on top of each other, so nudge them apart.
    const nudge = pairs.has(`${c.to}->${c.from}`) ? (c.from < c.to ? -9 : 9) : 0;
    return [{ from: c.from, to: c.to, label: c.label, ...route(a, b, nudge) }];
  });
}

// A cubic curve between the facing sides of two nodes.
function route(a: PlacedNode, b: PlacedNode, nudge: number) {
  const stacked = Math.abs(a.x - b.x) < NODE_WIDTH;
  let p0: [number, number], p3: [number, number], c1: [number, number], c2: [number, number];
  if (stacked) {
    const down = b.y > a.y;
    p0 = [a.x + NODE_WIDTH / 2 + nudge, down ? a.y + a.node.height : a.y];
    p3 = [b.x + NODE_WIDTH / 2 + nudge, down ? b.y : b.y + b.node.height];
    const bend = Math.max(24, Math.abs(p3[1] - p0[1]) / 2) * (down ? 1 : -1);
    c1 = [p0[0], p0[1] + bend];
    c2 = [p3[0], p3[1] - bend];
  } else {
    const right = b.x > a.x;
    p0 = [right ? a.x + NODE_WIDTH : a.x, a.y + a.node.height / 2 + nudge];
    p3 = [right ? b.x : b.x + NODE_WIDTH, b.y + b.node.height / 2 + nudge];
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
