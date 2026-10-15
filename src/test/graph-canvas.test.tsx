import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { GraphCanvas } from "@/components/graph-canvas";
import type { ComponentType } from "@/lib/api";
import { layoutGraph, layoutView, viewMeta } from "@/lib/graph";

beforeAll(() => {
  // jsdom has no layout, so report a fixed canvas size.
  globalThis.ResizeObserver = class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
      this.callback(
        [{ contentRect: { width: 900, height: 540 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  };
});

const types: ComponentType[] = ["frontend", "service", "service", "data", "external"];
const components = Array.from({ length: 18 }, (_, i) => ({
  id: `c-${i}`,
  name: `Component ${i}`,
  type: types[i % types.length]!,
  tech: "TypeScript",
  description: "",
  paths: [],
  entryPoint: "",
  files: 0,
}));
const connections = components
  .slice(1)
  .map((c, i) => ({ from: `c-${i}`, to: c.id, label: `link ${i}` }));
const layout = layoutGraph({ components, connections });

describe("GraphCanvas", () => {
  it("draws every component and connection, and reports clicks", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <GraphCanvas
        layout={layout}
        selected="c-0"
        onSelect={onSelect}
        isDimmed={(id) => id === "c-5"}
        caption="System architecture"
      />,
    );

    expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(18);
    expect(container.querySelectorAll(".edges g")).toHaveLength(17);
    expect(screen.getByRole("button", { name: "Select Component 0" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Select Component 5" })).toHaveClass("dimmed");

    fireEvent.click(screen.getByRole("button", { name: "Select Component 7" }));
    expect(onSelect).toHaveBeenCalledWith("c-7");
  });

  it("zooms with the controls and fits back", () => {
    render(
      <GraphCanvas
        layout={layout}
        selected={undefined}
        onSelect={() => {}}
        isDimmed={() => false}
        caption=""
      />,
    );
    const fitted = screen.getByText(/^\d+%$/).textContent;

    fireEvent.click(screen.getByTitle("Zoom in"));
    expect(screen.getByText(/^\d+%$/).textContent).not.toBe(fitted);

    fireEvent.click(screen.getByTitle("Fit graph"));
    expect(screen.getByText(/^\d+%$/).textContent).toBe(fitted);
  });
});

describe("GraphCanvas field cards", () => {
  it("lists a table's fields with key markers, folding the overflow", () => {
    const fields = [
      { name: "id", type: "serial", key: "primary" as const },
      { name: "customer_id", type: "integer", key: "foreign" as const },
      { name: "email", type: "text", key: "unique" as const },
      ...Array.from({ length: 9 }, (_, i) => ({ name: `col_${i}`, type: "text" })),
    ];
    const tableLayout = layoutView(
      {
        nodes: [
          { id: "orders", name: "orders", kind: "table", detail: "", group: "PostgreSQL", fields },
        ],
        edges: [],
      },
      viewMeta["Database schema"]!,
      () => undefined,
    );
    render(
      <GraphCanvas
        layout={tableLayout}
        selected="orders"
        onSelect={() => {}}
        isDimmed={() => false}
        caption=""
      />,
    );
    const card = screen.getByRole("button", { name: "Select orders" });

    expect(card).toHaveStyle({ height: `${tableLayout.nodes[0]!.node.height}px` });
    expect(within(card).getByText("customer_id")).toBeInTheDocument();
    expect(within(card).getByLabelText("Primary key")).toBeInTheDocument();
    expect(within(card).getByLabelText("Foreign key")).toBeInTheDocument();
    expect(within(card).getByText("col_6")).toBeInTheDocument();
    expect(within(card).queryByText("col_7")).not.toBeInTheDocument();
    expect(within(card).getByText("+2 more")).toBeInTheDocument();
  });
});
