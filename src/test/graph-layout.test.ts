import { describe, expect, it } from "vitest";

import type { ArchitectureGraph, ComponentType } from "@/lib/api";
import { layoutGraph, NODE_HEIGHT, NODE_WIDTH } from "@/lib/graph";

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

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x < b.x + NODE_WIDTH &&
  b.x < a.x + NODE_WIDTH &&
  a.y < b.y + NODE_HEIGHT &&
  b.y < a.y + NODE_HEIGHT;

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
