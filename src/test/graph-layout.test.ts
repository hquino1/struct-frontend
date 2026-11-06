import { describe, expect, it } from "vitest";

import type { ArchitectureGraph, ComponentType } from "@/lib/api";
import {
  cardHeight,
  FIELD_ROW,
  layoutFlow,
  layoutGraph,
  layoutView,
  NODE_HEIGHT,
  PILL_HEIGHT,
  simplifyView,
  NODE_WIDTH,
  viewMeta,
  views,
} from "@/lib/graph";

const component = (id: string, type: ComponentType) => ({
  id,
  name: id,
  type,
  tech: "TypeScript",
  description: "",
  paths: [],
  entryPoint: "",
  files: 0,
});

const graph = (
  counts: Partial<Record<ComponentType, number>>,
  connections: ArchitectureGraph["connections"] = [],
) => ({
  components: Object.entries(counts).flatMap(([type, n]) =>
    Array.from({ length: n }, (_, i) => component(`${type}-${i}`, type as ComponentType)),
  ),
  connections,
});

// Nodes without a placed height (layoutGraph's cards) are NODE_HEIGHT tall.
type Box = { x: number; y: number; node?: { height: number } };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + NODE_WIDTH &&
  b.x < a.x + NODE_WIDTH &&
  a.y < b.y + (b.node?.height ?? NODE_HEIGHT) &&
  b.y < a.y + (a.node?.height ?? NODE_HEIGHT);

describe("layoutGraph", () => {
  it("places every component of a large graph without overlaps, inside the bounds", () => {
    const layout = layoutGraph(graph({ frontend: 3, service: 11, data: 4, external: 2 }));

    expect(layout.nodes).toHaveLength(20);
    for (const [i, a] of layout.nodes.entries()) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + NODE_WIDTH).toBeLessThanOrEqual(layout.width);
      expect(a.y + NODE_HEIGHT).toBeLessThanOrEqual(layout.height);
      for (const b of layout.nodes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    }
  });

  it("orders lanes left to right: clients, services, then data and integrations", () => {
    const layout = layoutGraph(graph({ external: 1, data: 1, service: 1, frontend: 1 }));
    const x = (id: string) => layout.nodes.find((n) => n.node.id === id)!.x;

    expect(x("frontend-0")).toBeLessThan(x("service-0"));
    expect(x("service-0")).toBeLessThan(x("data-0"));
    expect(x("data-0")).toBe(x("external-0"));
    expect(layout.lanes.map((l) => l.label)).toEqual([
      "Client layer",
      "Service layer",
      "Data & integrations",
    ]);
  });

  it("skips empty lanes", () => {
    const layout = layoutGraph(graph({ service: 2 }));
    expect(layout.lanes.map((l) => l.label)).toEqual(["Service layer"]);
  });

  it("orders a lane so connected components sit level with each other", () => {
    // Without reordering, data-0 (alphabetically first) would sit on top.
    const layout = layoutGraph(
      graph({ service: 2, data: 2 }, [
        { from: "service-0", to: "data-1", label: "SQL" },
        { from: "service-1", to: "data-0", label: "SQL" },
      ]),
    );
    const y = (id: string) => layout.nodes.find((n) => n.node.id === id)!.y;

    expect(Math.sign(y("service-0") - y("service-1"))).toBe(Math.sign(y("data-1") - y("data-0")));
  });

  it("routes an edge per connection and drops ones to unknown components", () => {
    const layout = layoutGraph(
      graph({ frontend: 1, service: 1 }, [
        { from: "frontend-0", to: "service-0", label: "REST" },
        { from: "service-0", to: "missing", label: "?" },
      ]),
    );

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({ from: "frontend-0", to: "service-0", label: "REST" });
    expect(layout.edges[0]!.path).toMatch(/^M[\d.]+,[\d.]+ C/);
  });

  it("handles an empty graph", () => {
    const layout = layoutGraph(graph({}));
    expect(layout.nodes).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("layoutFlow", () => {
  const meta = viewMeta["CI/CD workflows"]!;
  const node = (id: string, group: string, kind = "job") => ({
    id,
    name: id,
    kind,
    detail: "",
    group,
  });
  const edge = (from: string, to: string) => ({ from, to, label: "" });

  it("puts each node one column past the furthest node it waits for", () => {
    const layout = layoutFlow(
      {
        nodes: [
          node("on", "CI", "trigger"),
          node("build", "CI"),
          node("lint", "CI"),
          node("test", "CI"),
          node("deploy", "CI", "deploy"),
        ],
        edges: [
          edge("on", "build"),
          edge("on", "lint"),
          edge("build", "test"),
          edge("test", "deploy"),
          edge("lint", "deploy"),
        ],
      },
      meta,
      () => undefined,
    );
    const x = (id: string) => layout.nodes.find((n) => n.node.id === id)!.x;

    expect(x("build")).toBe(x("lint"));
    expect(x("on")).toBeLessThan(x("build"));
    expect(x("build")).toBeLessThan(x("test"));
    // Waits for both test and lint, so it sits past the later one.
    expect(x("test")).toBeLessThan(x("deploy"));
    expect(layout.nodes.find((n) => n.node.id === "deploy")!.node.footRight).toBe("Deploy");
  });

  it("stacks one band per group without overlaps, and labels each band", () => {
    const layout = layoutFlow(
      {
        nodes: [
          node("a-on", "CI", "trigger"),
          ...["a1", "a2", "a3"].map((id) => node(id, "CI")),
          node("b-on", "Release", "trigger"),
          node("b1", "Release"),
        ],
        edges: [
          ...["a1", "a2", "a3"].map((id) => edge("a-on", id)),
          edge("b-on", "b1"),
          // Links between bands don't move columns.
          edge("a3", "b-on"),
        ],
      },
      meta,
      () => undefined,
    );

    expect(layout.lanes.map((l) => l.label)).toEqual(["CI", "Release"]);
    const y = (id: string) => layout.nodes.find((n) => n.node.id === id)!.y;
    expect(Math.min(y("b-on"), y("b1"))).toBeGreaterThan(Math.max(y("a1"), y("a2"), y("a3")));
    for (const [i, a] of layout.nodes.entries()) {
      expect(a.x + NODE_WIDTH).toBeLessThanOrEqual(layout.width);
      expect(a.y + NODE_HEIGHT).toBeLessThanOrEqual(layout.height);
      for (const b of layout.nodes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    }
    expect(layout.edges).toHaveLength(5);
  });

  it("survives a cycle", () => {
    const layout = layoutFlow(
      { nodes: [node("a", "CI"), node("b", "CI")], edges: [edge("a", "b"), edge("b", "a")] },
      meta,
      () => undefined,
    );
    expect(layout.nodes).toHaveLength(2);
  });

  it("names the linked component on the node", () => {
    const layout = layoutFlow(
      { nodes: [{ ...node("build", "CI"), componentId: "api" }], edges: [] },
      meta,
      (id) => (id === "api" ? "API Gateway" : undefined),
    );
    expect(layout.nodes[0]!.node.footLeft).toBe("API Gateway");
  });
});

describe("layoutView with lanes (Dependencies)", () => {
  const meta = viewMeta["Dependencies"]!;
  const component = (id: string) => ({
    id: `component:${id}`,
    name: id,
    kind: "component",
    detail: "",
    group: "Components",
    componentId: id,
  });
  const pkg = (id: string) => ({
    id: `package:${id}`,
    name: id,
    kind: "package",
    detail: "",
    group: "Packages",
  });

  it("puts components left of packages and wraps a long package column", () => {
    const packages = Array.from({ length: 60 }, (_, i) => pkg(`p${i}`));
    const layout = layoutView(
      {
        // Packages first in the data; the meta's lane order still wins.
        nodes: [...packages, component("web"), component("api")],
        edges: packages.map((p, i) => ({
          from: `component:${i % 2 ? "web" : "api"}`,
          to: p.id,
          label: "×1",
        })),
      },
      meta,
      (id) => (id === "web" ? "Web App" : undefined),
    );

    expect(layout.lanes.map((l) => l.label)).toEqual(["Components", "Packages"]);
    const at = (id: string) => layout.nodes.find((n) => n.node.id === id)!;
    const packageXs = new Set(packages.map((p) => at(p.id).x));
    expect(Math.min(...packageXs)).toBeGreaterThan(at("component:web").x);
    // Packages are pills, so 60 of them wrap into 5 columns of up to 14 rather than a
    // block of 8 card columns.
    expect(packageXs.size).toBe(5);
    expect(at("package:p0").node).toMatchObject({ compact: true, height: PILL_HEIGHT });
    expect(at("component:web").node.compact).toBeUndefined();
    for (const [i, a] of layout.nodes.entries()) {
      for (const b of layout.nodes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    }
    expect(at("component:web").node).toMatchObject({
      footLeft: "Web App",
      footRight: "Component",
    });
    expect(at("package:p0").node.footRight).toBe("Package");
    expect(layout.edges).toHaveLength(60);
  });

  const uses = (from: string, ...to: string[]) =>
    to.map((t) => ({ from: `component:${from}`, to: `package:${t}`, label: "×1" }));

  it("merges packages with the same users into one node listing them", () => {
    const view = simplifyView(
      {
        nodes: [
          component("web"),
          component("api"),
          pkg("@radix-ui/react-tabs"),
          pkg("@radix-ui/react-slot"),
          pkg("zod"),
        ],
        edges: [
          ...uses("web", "@radix-ui/react-tabs", "@radix-ui/react-slot", "zod"),
          ...uses("api", "zod"),
        ],
      },
      meta,
    );

    const merged = view.nodes.find((n) => n.id.startsWith("merged:"))!;
    expect(merged).toMatchObject({ name: "@radix-ui/*", kind: "package", group: "Packages" });
    expect(merged.fields!.map((f) => f.name)).toEqual([
      "@radix-ui/react-tabs",
      "@radix-ui/react-slot",
    ]);
    // Two edges from web became one that carries both; zod is still drawn on its own.
    expect(view.edges).toContainEqual(
      expect.objectContaining({
        from: "component:web",
        to: merged.id,
        weight: 2,
        label: "2 packages",
      }),
    );
    expect(view.edges).toHaveLength(3);
    // A merged node is a field card, not a pill.
    const layout = layoutView(view, meta, () => undefined);
    expect(layout.nodes.find((n) => n.node.id === merged.id)!.node.compact).toBeUndefined();
  });

  it("lists packages most components use on one node, without edges", () => {
    const names = ["a", "b", "c", "d", "e"];
    const view = simplifyView(
      {
        nodes: [...names.map(component), pkg("react"), pkg("lodash"), pkg("zod")],
        edges: [
          ...names.flatMap((c) => uses(c, "react")),
          ...names.slice(0, 3).flatMap((c) => uses(c, "lodash")),
          // Only one user: stays drawn.
          ...uses("a", "zod"),
        ],
      },
      meta,
    );

    const common = view.nodes.find((n) => n.kind === "common")!;
    expect(common.fields).toEqual([
      { name: "react", type: "5 of 5" },
      { name: "lodash", type: "3 of 5" },
    ]);
    expect(view.edges).toEqual(uses("a", "zod"));
    expect(view.nodes.map((n) => n.id)).not.toContain("package:react");
  });

  it("hides dev packages until asked", () => {
    const graph = {
      nodes: [component("web"), { ...pkg("vitest"), kind: "dev" }],
      edges: uses("web", "vitest"),
    };
    const hidden = simplifyView(graph, meta);
    expect(hidden).toMatchObject({ hidden: 1, edges: [] });
    expect(hidden.nodes.map((n) => n.id)).toEqual(["component:web"]);
    expect(simplifyView(graph, meta, { showOptional: true }).nodes).toHaveLength(2);
  });

  it("summarises the view for the caption", () => {
    expect(meta.summary([component("web"), pkg("react"), pkg("zod")])).toBe(
      "1 component · 2 packages",
    );
  });
});

describe("layoutView with lanes (Cloud infrastructure)", () => {
  const meta = viewMeta["Cloud infrastructure"]!;
  const resource = (id: string, kind: string, group: string) => ({
    id,
    name: id,
    kind,
    detail: "",
    group,
  });

  it("orders layers from the network edge to data, skipping empty ones", () => {
    const layout = layoutView(
      {
        // Out of order, and nothing in "Security & other".
        nodes: [
          resource("table", "data", "Data & messaging"),
          resource("fn", "compute", "Compute"),
          resource("api", "network", "Network"),
          resource("queue", "messaging", "Data & messaging"),
        ],
        edges: [
          { from: "api", to: "fn", label: "routes to" },
          { from: "fn", to: "table", label: "uses" },
          { from: "queue", to: "fn", label: "triggers" },
        ],
      },
      meta,
      () => undefined,
    );
    const x = (id: string) => layout.nodes.find((n) => n.node.id === id)!.x;

    expect(layout.lanes.map((l) => l.label)).toEqual(["Network", "Compute", "Data & messaging"]);
    expect(x("api")).toBeLessThan(x("fn"));
    expect(x("fn")).toBeLessThan(x("table"));
    expect(layout.nodes.find((n) => n.node.id === "queue")!.node).toMatchObject({
      footRight: "Messaging",
      tone: "external",
    });
    expect(meta.summary(layout.nodes.map((n) => resource(n.node.id, "", "x")))).toBe(
      "4 resources · 1 layer",
    );
  });
});

describe("layoutView with field cards (Database schema)", () => {
  const meta = viewMeta["Database schema"]!;
  const table = (id: string, fieldCount: number, group = "PostgreSQL") => ({
    id,
    name: id,
    kind: "table",
    detail: "",
    group,
    fields: Array.from({ length: fieldCount }, (_, i) => ({
      name: `f${i}`,
      type: "text",
      ...(i === 0 && { key: "primary" as const }),
    })),
  });

  it("sizes cards to their fields and keeps rows of different heights apart", () => {
    const tables = [
      table("a", 2),
      table("b", 14),
      table("c", 1),
      table("d", 6),
      table("e", 3),
      table("f", 9),
      table("g", 12),
    ];
    const layout = layoutView(
      {
        nodes: [...tables, table("events", 4, "MongoDB")],
        edges: [{ from: "b", to: "a", label: "N:1" }],
      },
      meta,
      () => undefined,
    );
    const at = (id: string) => layout.nodes.find((n) => n.node.id === id)!;

    // One lane per database, in order of appearance.
    expect(layout.lanes.map((l) => l.label)).toEqual(["PostgreSQL", "MongoDB"]);
    expect(at("c").node.height).toBe(cardHeight(tables[2]!.fields));
    // 14 fields show 10 plus a "+4 more" row.
    expect(at("b").node.height).toBe(cardHeight(tables[0]!.fields) + 9 * FIELD_ROW);
    for (const [i, a] of layout.nodes.entries()) {
      expect(a.y + a.node.height).toBeLessThanOrEqual(layout.height);
      for (const b of layout.nodes.slice(i + 1)) {
        const apart =
          a.x + NODE_WIDTH <= b.x ||
          b.x + NODE_WIDTH <= a.x ||
          a.y + a.node.height <= b.y ||
          b.y + b.node.height <= a.y;
        expect(apart).toBe(true);
      }
    }
    // Edges attach to the middle of each card's own height.
    const edge = layout.edges[0]!;
    const start = edge.path.match(/^M([\d.]+),([\d.]+)/)!;
    const b = at("b");
    expect(Number(start[2])).toBeCloseTo(
      b.x === at("a").x ? b.y + (b.y < at("a").y ? b.node.height : 0) : b.y + b.node.height / 2,
    );
  });

  it("summarises entities and databases", () => {
    expect(meta.summary([table("a", 1), table("b", 1), table("c", 1, "MongoDB")])).toBe(
      "3 entities · 2 databases",
    );
  });
});

describe("simplifyView (Screen flows)", () => {
  const meta = viewMeta["Screen flows"]!;
  const screen = (id: string) => ({ id, name: id, kind: "page", detail: "", group: "App" });
  const endpoint = (name: string, group = "API") => ({
    id: name,
    name,
    kind: "endpoint",
    detail: `Express · handler() · used by 1 screen`,
    group,
  });

  it("merges a screen's own endpoints by shared path, keeping their timing label", () => {
    const view = simplifyView(
      {
        nodes: [
          screen("/settings"),
          screen("/home"),
          endpoint("GET /api/users/me"),
          endpoint("PATCH /api/users/me"),
          // Same callers, other server: not merged with the ones above.
          endpoint("GET /billing", "Payments"),
          endpoint("GET /api/feed"),
        ],
        edges: [
          { from: "/settings", to: "GET /api/users/me", label: "on load" },
          { from: "/settings", to: "PATCH /api/users/me", label: "on load" },
          { from: "/settings", to: "GET /billing", label: "on action" },
          { from: "/home", to: "GET /api/feed", label: "on load" },
        ],
      },
      meta,
    );

    expect(view.nodes.map((n) => n.name)).toEqual([
      "/settings",
      "/home",
      "/api/users/me",
      "GET /billing",
      "GET /api/feed",
    ]);
    const merged = view.nodes[2]!;
    expect(merged.fields![0]).toEqual({ name: "GET /api/users/me", type: "Express · handler()" });
    expect(view.edges).toContainEqual(
      expect.objectContaining({ from: "/settings", to: merged.id, label: "on load", weight: 2 }),
    );
    expect(view.edges).toHaveLength(3);
  });

  it("leaves a view with nothing to merge as it is", () => {
    const graph = {
      nodes: [screen("/a"), endpoint("GET /x")],
      edges: [{ from: "/a", to: "GET /x", label: "" }],
    };
    expect(simplifyView(graph, meta)).toEqual({ ...graph, hidden: 0 });
  });
});

describe("explore views", () => {
  it("has a built view behind every sidebar entry", () => {
    expect(views.filter((v) => v !== "System architecture" && !viewMeta[v])).toEqual([]);
  });

  it("puts API callers first, then each server, then unmatched calls", () => {
    const node = (id: string, kind: string, group: string) => ({
      id,
      name: id,
      kind,
      detail: "",
      group,
    });
    const nodes = [
      node("caller:web", "client", "Callers"),
      node("GET /orders", "endpoint", "API"),
      node("POST /pay", "endpoint", "Payments"),
      node("GET /legacy", "missing", "Not found on server"),
      node("POST api.stripe.com/v1/charges", "remote", "External APIs"),
    ];
    const layout = layoutView(
      { nodes, edges: [{ from: "caller:web", to: "GET /orders", label: "" }] },
      viewMeta["API interactions"]!,
      () => undefined,
    );

    expect(layout.lanes.map((l) => l.label)).toEqual([
      "Callers",
      "API",
      "Payments",
      "Not found on server",
      "External APIs",
    ]);
    expect(viewMeta["API interactions"]!.summary(nodes)).toBe("2 endpoints · 1 caller");
  });
});
