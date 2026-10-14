import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitFork,
  Globe,
  Maximize,
  MoreHorizontal,
  Network,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { useShell } from "@/hooks/use-shell";
import {
  nodesForView,
  edges,
  views,
  insights,
  type View,
  type GraphNode,
} from "@/lib/architecture-data";
import type { Project } from "@/lib/api";
import { repoPath, setLastProjectId, useProjects } from "@/lib/projects";

const tabs = ["Graph", "Files", "Insights"] as const;
type Tab = (typeof tabs)[number];

export const Route = createFileRoute("/_app/projects/$projectId")({
  // The view and tab live in the URL so the sidebar can link to them and reloads keep them.
  validateSearch: (search: Record<string, unknown>): { view?: View; tab?: Tab } => ({
    ...(views.includes(search["view"] as View) && { view: search["view"] as View }),
    ...(tabs.includes(search["tab"] as Tab) && { tab: search["tab"] as Tab }),
  }),
  head: () => ({
    meta: [
      { title: "Struct — Codebase Intelligence" },
      {
        name: "description",
        content:
          "Explore architecture, dependencies, and workflows in an interactive codebase visualization workspace.",
      },
      { property: "og:title", content: "Struct — Codebase Intelligence" },
      {
        property: "og:description",
        content:
          "Turn complex code into a clear picture. Explore your system architecture with Struct.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectPage,
});
const nodeIcons = { frontend: Globe, service: Box, data: Database, external: Zap };
const positions: [number, number][] = [
  [40, 95],
  [40, 287],
  [312, 95],
  [312, 250],
  [312, 401],
  [582, 95],
  [582, 250],
  [582, 401],
];

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { data: projects, status, refetch } = useProjects();
  const project = projects?.find((p) => p.projectId === projectId);
  useEffect(() => {
    if (project) setLastProjectId(project.projectId);
  }, [project]);

  if (status === "pending")
    return (
      <main className="main-content">
        <p className="projects-empty">Loading project...</p>
      </main>
    );
  if (status === "error")
    return (
      <main className="main-content">
        <div className="projects-empty">
          <p>Couldn't load this project.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </main>
    );
  if (!project)
    return (
      <main className="main-content">
        <div className="projects-empty">
          <FolderGit2 size={28} className="text-primary" />
          <h2>Project not found</h2>
          <p>It may have been removed, or it belongs to another account.</p>
          <Button asChild size="sm">
            <Link to="/projects">
              View all projects
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </main>
    );
  // Keyed so switching projects starts from a fresh selection and zoom.
  return <Workspace key={project.projectId} project={project} />;
}

function Workspace({ project }: { project: Project }) {
  const { view = "System architecture", tab = "Graph" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setView = (v: View) => void navigate({ search: { view: v } });
  const setTab = (t: Tab) => void navigate({ search: (prev) => ({ ...prev, tab: t }) });
  const { query, showToast, openImport } = useShell();
  const [selected, setSelected] = useState("api");
  const [zoom, setZoom] = useState(100);
  const [modal, setModal] = useState<"filter" | "code" | "insight" | null>(null);
  const [filter, setFilter] = useState("All components");
  const [analyzing, setAnalyzing] = useState(false);
  const [updated, setUpdated] = useState(false);
  const nodes = nodesForView(view);
  const current = nodes.find((n) => n.id === selected) ?? nodes[2];
  if (!current) return null;
  const closeModal = () => setModal(null);
  const analyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setUpdated(true);
      showToast("Sample analysis refreshed. 8 components and 9 connections mapped.");
    }, 1500);
  };
  const exportGraph = () => {
    const content = JSON.stringify(
      {
        project: project.name,
        view,
        components: nodes,
        connections: edges.map(([a, b, label]) => ({
          from: nodes[a]?.id,
          to: nodes[b]?.id,
          label,
        })),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}-architecture.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Architecture exported as JSON");
  };
  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-3">
            <h1>{project.name}</h1>
            <span className="pill">Analyzed</span>
          </div>
          <p>
            Project overview <span className="mx-2">/</span> {view}
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" size="sm" onClick={openImport}>
            <Plus />
            Import project
          </Button>
          <Button size="sm" disabled={analyzing} onClick={analyze}>
            <Sparkles />
            {analyzing ? "Analyzing..." : "Re-analyze"}
          </Button>
        </div>
      </div>
      <div className="repo-bar">
        <a
          className="flex gap-1.5 items-center hover:text-foreground"
          href={project.repoUrl}
          target="_blank"
          rel="noreferrer"
        >
          <FolderGit2 size={13} />
          {repoPath(project)}
        </a>
        <span className="branch">
          <GitBranch size={11} />
          {project.branch}
          <ChevronDown size={10} />
        </span>
        <span className="font-mono text-[10px]">a7f3c2e</span>
        <span className="ml-auto">
          <span className="status-dot" />
          Last analyzed {updated ? "just now" : "2 minutes ago"}
        </span>
      </div>
      <div className="stats-row">
        {[
          { label: "Files analyzed", value: "248", foot: "Across 12 directories", icon: FileCode2 },
          {
            label: "Components",
            value: "8",
            foot: "3 services · 2 apps · 3 integrations",
            icon: Box,
          },
          { label: "Dependencies", value: "32", foot: "9 internal · 23 external", icon: GitFork },
          { label: "Architecture health", value: "92", foot: "Well structured", icon: ShieldCheck },
        ].map((s, i) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">
              {s.label}
              <s.icon size={14} />
            </div>
            <div className="stat-value">
              {s.value}
              {i === 3 && <span className="text-sm text-muted-foreground font-normal"> / 100</span>}
            </div>
            <div className={`stat-foot ${i === 3 ? "text-primary" : ""}`}>
              {i === 3 && <span className="status-dot" />}
              {s.foot}
            </div>
          </div>
        ))}
      </div>
      <section className="graph-section" aria-label="Architecture visualization">
        <div className="graph-toolbar">
          <div className="graph-tabs">
            {tabs.map((t) => (
              <Button
                key={t}
                variant="ghost"
                className={`graph-tab ${tab === t ? "selected" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "Graph" ? (
                  <Network size={13} />
                ) : t === "Files" ? (
                  <FileCode2 size={13} />
                ) : (
                  <Sparkles size={13} />
                )}{" "}
                {t}
                {t === "Insights" && <span className="key">3</span>}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              title="Filter components"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setModal("filter")}
            >
              <Settings2 />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={exportGraph}>
              <ArrowDownToLine size={12} />
              Export
            </Button>
          </div>
        </div>
        {tab === "Graph" ? (
          <div className="graph-body">
            <div className="canvas">
              <div className="canvas-caption">
                <Network size={12} />
                {view}
                <span className="text-muted-foreground/50">/</span>8 nodes · 9 connections
              </div>
              <div className="diagram" style={{ "--zoom": zoom / 100 } as CSSProperties}>
                <span className="layer-label layer-frontend">
                  {view === "Database schema" ? "Entities" : "Client layer"}
                </span>
                <span className="layer-label layer-service">
                  {view === "Database schema" ? "Relationships" : "Service layer"}
                </span>
                <span className="layer-label layer-data">
                  {view === "Database schema" ? "Records" : "Data & integrations"}
                </span>
                <svg className="edges" viewBox="0 0 800 500">
                  <defs>
                    <marker
                      id="arrow"
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0,0 L6,3 L0,6 Z" />
                    </marker>
                  </defs>
                  {edges.map(([a, b, label], i) => {
                    const start = positions[a];
                    const end = positions[b];
                    if (!start || !end) return null;
                    const [ax, ay] = start;
                    const [bx, by] = end;
                    const vertical = ax === bx;
                    const sx = vertical ? ax + 88 : ax + 176;
                    const sy = vertical ? ay + 91 : ay + 45;
                    const ex = vertical ? bx + 88 : bx;
                    const ey = vertical ? by : by + 45;
                    return (
                      <g key={i}>
                        <path
                          className={
                            nodes[a]?.id === selected || nodes[b]?.id === selected
                              ? "highlight"
                              : ""
                          }
                          d={
                            vertical
                              ? `M${sx},${sy} L${ex},${ey}`
                              : `M${sx},${sy} C${sx + 55},${sy} ${ex - 55},${ey} ${ex},${ey}`
                          }
                          markerEnd="url(#arrow)"
                        />
                        <text
                          x={vertical ? sx + 8 : (sx + ex) / 2 - 12}
                          y={vertical ? (sy + ey) / 2 : (sy + ey) / 2 - 8}
                        >
                          {view === "Database schema"
                            ? "1 : N"
                            : view === "Function calls"
                              ? "calls"
                              : label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                {nodes.map((n, i) => {
                  const Icon = nodeIcons[n.type];
                  const dim =
                    (query && !`${n.name} ${n.tech}`.toLowerCase().includes(query.toLowerCase())) ||
                    (filter !== "All components" && n.type !== filter);
                  return (
                    <Button
                      key={n.id}
                      variant="ghost"
                      className={`graph-node node-${i} ${n.id === selected ? "chosen" : ""} ${dim ? "dimmed" : ""}`}
                      aria-label={`Select ${n.name}`}
                      onClick={() => setSelected(n.id)}
                    >
                      <div className="node-top">
                        <span className={`node-icon ${n.type}`}>
                          <Icon size={15} />
                        </span>
                        <div>
                          <div className="node-title">{n.name}</div>
                          <div className="node-technology">{n.tech}</div>
                        </div>
                      </div>
                      <div className="node-bottom">
                        <span>
                          <FileCode2 size={9} className="inline mr-1" />
                          {n.files} files
                        </span>
                        <span>
                          {n.type === "external"
                            ? "External"
                            : n.type === "data"
                              ? "Data store"
                              : n.type === "service"
                                ? "Service"
                                : "Application"}
                        </span>
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
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                >
                  <ZoomOut />
                </Button>
                <span>{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Zoom in"
                  onClick={() => setZoom((z) => Math.min(150, z + 10))}
                >
                  <ZoomIn />
                </Button>
                <span className="border-l border-border h-4 p-0" />
                <Button variant="ghost" size="icon" title="Fit graph" onClick={() => setZoom(100)}>
                  <Maximize />
                </Button>
              </div>
              <div className="minimap" aria-hidden="true">
                <svg viewBox="0 0 100 65">
                  {positions.map(([x, y], i) => (
                    <rect key={i} x={x / 8} y={y / 8} width="21" height="9" rx="1" />
                  ))}
                  <rect className="focus" x="1" y="1" width="96" height="62" rx="2" />
                </svg>
              </div>
            </div>
            <DetailPanel
              node={current}
              nodes={nodes}
              onCode={() => setModal("code")}
              onSelect={setSelected}
            />
          </div>
        ) : tab === "Files" ? (
          <div className="insights-expanded">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold">Project files</h2>
              <span className="text-muted-foreground text-xs">8 component entry points</span>
            </div>
            {nodes
              .filter((n) => `${n.name} ${n.path}`.toLowerCase().includes(query.toLowerCase()))
              .map((n) => (
                <Button
                  key={n.id}
                  variant="ghost"
                  className="flex w-full justify-start h-14 border-b border-border rounded-none"
                  onClick={() => {
                    setSelected(n.id);
                    setModal("code");
                  }}
                >
                  <FileCode2 className="text-primary" />
                  <span className="font-mono text-xs">{n.path}</span>
                  <span className="ml-auto text-muted-foreground text-[10px]">{n.files} files</span>
                  <ChevronRight />
                </Button>
              ))}
          </div>
        ) : (
          <div className="insights-expanded">
            <h2 className="text-sm font-semibold mb-5">Architecture insights</h2>
            <Insights onOpen={() => setModal("insight")} />
          </div>
        )}
        <div className="legend">
          {["Frontend", "Service", "Data store", "External"].map((l, i) => (
            <span className="legend-item" key={l}>
              <span className={`legend-dot ${["", "service", "data", "external"][i]}`} />
              {l}
            </span>
          ))}
          <span className="ml-auto hidden sm:block font-mono">Sample project</span>
        </div>
      </section>
      <div className="insights-heading">
        <h2>
          <Sparkles size={14} className="text-primary" />
          Architecture insights<span className="pill">3 insights</span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] text-muted-foreground"
          onClick={() => setTab("Insights")}
        >
          View all
          <ArrowRight size={12} />
        </Button>
      </div>
      <Insights onOpen={() => setModal("insight")} />
      <footer className="footer">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={11} />
          Your code stays yours. Always.
        </span>
        <span>Built for human understanding.</span>
      </footer>
      {modal === "filter" && (
        <Modal title="Component filters" onClose={closeModal}>
          <div className="grid gap-2 mt-5">
            {["All components", "frontend", "service", "data", "external"].map((f) => (
              <Button
                key={f}
                variant={filter === f ? "secondary" : "ghost"}
                className="justify-between capitalize"
                onClick={() => {
                  setFilter(f);
                  closeModal();
                }}
              >
                {f}
                {filter === f && <Check />}
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "code" && (
        <Modal title={current.name} onClose={closeModal}>
          <p className="font-mono">{current.path}</p>
          <pre className="code-block">{`// ${current.name} — sample entry point\nimport { router } from './routes';\nimport { authenticate } from './middleware';\n\napp.use(authenticate);\napp.use('/api/v1', router);\n\nexport default app;`}</pre>
          <p>Source preview from the sample commerce project.</p>
        </Modal>
      )}
      {modal === "insight" && (
        <Modal title="Architecture insights" onClose={closeModal}>
          <p>
            The API Gateway is a central coordination point. Its authentication dependency can be
            simplified.
          </p>
          <div className="code-block">
            API Gateway → Auth Service
            <br />
            Auth Service → API Gateway
          </div>
          <p>
            Extract token validation and shared types into an independent package. Both services can
            consume it without depending on each other.
          </p>
          <Button
            onClick={() => {
              setSelected("auth");
              setTab("Graph");
              closeModal();
            }}
          >
            Inspect Auth Service
            <ArrowRight />
          </Button>
        </Modal>
      )}
    </main>
  );
}
function DetailPanel({
  node,
  nodes,
  onCode,
  onSelect,
}: {
  node: GraphNode;
  nodes: GraphNode[];
  onCode: () => void;
  onSelect: (id: string) => void;
}) {
  const Icon = nodeIcons[node.type];
  const index = nodes.findIndex((n) => n.id === node.id);
  const related = edges
    .filter(([a, b]) => a === index || b === index)
    .map(([a, b]) => nodes[a === index ? b : a])
    .filter((n): n is GraphNode => n !== undefined);
  return (
    <aside className="detail-panel">
      <div className="detail-label">
        Component details
        <MoreHorizontal size={14} />
      </div>
      <span className={`node-icon ${node.type}`}>
        <Icon size={17} />
      </span>
      <h2>{node.name}</h2>
      <span className="pill capitalize">
        {node.type === "service" ? "Backend service" : node.type}
      </span>
      <p>{node.description}</p>
      <div className="detail-divider" />
      <div className="detail-kv">
        <span>Technology</span>
        <span>{node.tech.split(" · ")[0]}</span>
      </div>
      <div className="detail-kv">
        <span>Language</span>
        <span>TypeScript</span>
      </div>
      <div className="detail-kv">
        <span>Files</span>
        <span>{node.files}</span>
      </div>
      <div className="detail-kv">
        <span>Connections</span>
        <span>{related.length}</span>
      </div>
      <div className="detail-divider" />
      <div className="text-[10px] font-medium">Entry point</div>
      <div className="file-path">
        <FileCode2 size={12} />
        <span className="truncate" title={node.path}>
          {node.path}
        </span>
      </div>
      <Button variant="outline" className="w-full h-7 text-[10px]" onClick={onCode}>
        <Code2 size={12} />
        View source
        <ExternalLink size={11} className="ml-auto" />
      </Button>
      <div className="detail-divider" />
      <div className="flex justify-between text-[10px]">
        <span>Connected to</span>
        <span className="text-muted-foreground">{related.length}</span>
      </div>
      {related.slice(0, 4).map((n) => (
        <Button
          key={n.id}
          variant="ghost"
          className="w-full justify-start h-7 p-0 text-[10px]"
          onClick={() => onSelect(n.id)}
        >
          <span className={`legend-dot ${n.type}`} />
          {n.name}
          <ChevronRight size={11} className="ml-auto text-muted-foreground" />
        </Button>
      ))}
    </aside>
  );
}
function Insights({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="insights-grid">
      {insights.map((s, i) => {
        const Icon = [Network, TriangleAlert, ShieldCheck][i] ?? Network;
        return (
          <div className="insight" key={s.title}>
            <div className="insight-top">
              <Icon
                size={16}
                className={i === 1 ? "text-amber" : i === 0 ? "text-blue" : "text-primary"}
              />
              <span className="insight-tag">{s.kind}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            {i === 1 && (
              <Button
                variant="link"
                className="p-0 h-5 text-[10px] mt-2 text-amber"
                onClick={onOpen}
              >
                Inspect dependency
                <ArrowRight size={11} />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
