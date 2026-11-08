import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  Cloud,
  Code2,
  Database,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitFork,
  Loader2,
  MessageCircleQuestionMark,
  Network,
  Plug,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { FieldKey } from "@/components/field-key";
import { GraphCanvas } from "@/components/graph-canvas";
import { BranchSwitcher } from "@/components/branch-switcher";
import { ProjectActions } from "@/components/project-dialogs";
import { useShell } from "@/hooks/use-shell";
import {
  kindOf,
  layoutGraph,
  layoutView,
  nodeIcons,
  simplifyView,
  typeLabels,
  viewIcons,
  viewMeta,
  views,
  type View,
  type ViewMeta,
} from "@/lib/graph";
import {
  analysisSteps as stepIds,
  type Analysis,
  type ArchitectureGraph,
  type ComponentType,
  type FaqEntry,
  type FaqTopic,
  type GraphComponent,
  type Project,
  type ViewGraph,
  type ViewNode,
} from "@/lib/api";
import {
  isAnalysisActive,
  repoPath,
  setLastProjectId,
  useAnalysis,
  useGraph,
  useProjects,
  useStartAnalysis,
  useView,
} from "@/lib/projects";

const tabs = ["Graphs", "Documentation"] as const;
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
// Outline of an empty map behind the pre-analysis card.
const ghostPositions: [number, number][] = [
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
  const { data: analysis, status: analysisStatus } = useAnalysis(project?.projectId);
  const { showToast } = useShell();
  useEffect(() => {
    if (project) setLastProjectId(project.projectId);
  }, [project]);
  // Announce a run finishing while the page is open, not one that finished earlier.
  const previousAnalysis = useRef(analysis);
  useEffect(() => {
    const previous = previousAnalysis.current;
    previousAnalysis.current = analysis;
    if (!isAnalysisActive(previous) || previous?.analysisId !== analysis?.analysisId) return;
    if (analysis?.status === "COMPLETE") showToast(`Analysis complete for ${project?.name}.`);
  }, [analysis, project, showToast]);

  if (status === "pending" || (project && analysisStatus === "pending"))
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
  if (analysisStatus === "error")
    return (
      <main className="main-content">
        <div className="projects-empty">
          <p>Couldn't load this project's analysis.</p>
        </div>
      </main>
    );
  // Keyed so switching projects starts from a fresh selection and zoom.
  return analysis?.status === "COMPLETE" ? (
    <Workspace key={project.projectId} project={project} analysis={analysis} />
  ) : (
    <PreAnalysis key={project.projectId} project={project} analysis={analysis ?? null} />
  );
}

const analysisSteps = [
  { label: "Clone repository", detail: "Fetching the selected branch" },
  { label: "Detect stack", detail: "Languages, frameworks, and package managers" },
  { label: "Map components", detail: "Services, apps, data stores, and integrations" },
  { label: "Trace dependencies", detail: "Imports, API calls, and data access" },
  { label: "Answer key questions", detail: "Structure, critical endpoints, and risks" },
];

const analysisOutputs = [
  {
    icon: Network,
    title: "Interactive architecture map",
    text: "See every service, app, and data store, and how requests move between them.",
  },
  {
    icon: GitFork,
    title: "Seven ways to explore",
    text: "Switch between dependencies, function calls, database schema, APIs, cloud, and CI/CD.",
  },
  {
    icon: MessageCircleQuestionMark,
    title: "Answers to key questions",
    text: "How it's structured, which endpoints matter most, and what to watch out for, linked to the code.",
  },
];

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// Shown until the project has a completed analysis: idle, in progress, or failed.
function PreAnalysis({ project, analysis }: { project: Project; analysis: Analysis | null }) {
  const start = useStartAnalysis(project.projectId);
  const running = start.isPending || isAnalysisActive(analysis);
  const failed = !running && analysis?.status === "FAILED";
  // Index of the step that is running (or that failed); null before any run.
  const step = running || failed ? stepIds.indexOf(analysis?.step ?? "clone") : null;
  const startError = start.error instanceof Error ? start.error.message : "";

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-3">
            <h1>{project.name}</h1>
            <span className={`pill ${running ? "" : failed ? "pill-failed" : "pill-muted"}`}>
              {running ? "Analyzing" : failed ? "Analysis failed" : "Not analyzed"}
            </span>
          </div>
          <p>Imported {dateFormat.format(new Date(project.createdAt))}</p>
        </div>
        <div className="heading-actions">
          <ProjectActions project={project} />
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
        <BranchSwitcher project={project} disabled={running} />
        <span className="ml-auto">
          <span className={`status-dot ${running ? "animate-pulse" : "idle"}`} />
          {running
            ? "Analysis in progress"
            : failed
              ? "Last analysis failed"
              : "Waiting for first analysis"}
        </span>
      </div>
      <div className="stats-row">
        {["Files analyzed", "Components", "Dependencies", "Architecture health"].map((label) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value text-muted-foreground/50">—</div>
            <div className="stat-foot">
              {running ? "Calculating..." : "Available after analysis"}
            </div>
          </div>
        ))}
      </div>
      <section className="graph-section" aria-label="Analysis">
        <div className="pre-analysis">
          <div className="ghost-diagram" aria-hidden="true">
            {ghostPositions.map(([x, y], i) => (
              <span key={i} className="ghost-node" style={{ left: x, top: y }} />
            ))}
          </div>
          <div className="analysis-card">
            <span className={`node-icon ${failed ? "failed" : "service"}`}>
              {running ? (
                <Loader2 size={17} className="animate-spin" />
              ) : failed ? (
                <TriangleAlert size={17} />
              ) : (
                <Network size={17} />
              )}
            </span>
            <h2>
              {running
                ? `Analyzing ${project.name}`
                : failed
                  ? "The analysis didn't finish"
                  : "Ready to map this repository"}
            </h2>
            <p>
              {running
                ? "Struct is reading the code on this branch. This page updates when the map is ready."
                : failed
                  ? analysis?.error
                  : `Struct will read ${repoPath(project)} on ${project.branch} and map its components, connections, and risks.`}
            </p>
            <ol className="analysis-steps">
              {analysisSteps.map((s, i) => {
                const state =
                  step === null || i > step
                    ? "todo"
                    : i < step
                      ? "done"
                      : failed
                        ? "failed"
                        : "active";
                return (
                  <li key={s.label} className={state}>
                    <span className="step-mark">
                      {state === "done" ? (
                        <Check size={11} />
                      ) : state === "failed" ? (
                        <TriangleAlert size={11} />
                      ) : state === "active" ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <div>
                      <div className="step-label">{s.label}</div>
                      <div className="step-detail">{s.detail}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {startError && (
              <p className="analysis-error" role="alert">
                {startError}
              </p>
            )}
            {running && step !== null ? (
              <div
                className="analysis-progress"
                role="progressbar"
                aria-label="Analysis progress"
                aria-valuemin={0}
                aria-valuemax={analysisSteps.length}
                aria-valuenow={step}
              >
                <span style={{ width: `${((step + 0.5) / analysisSteps.length) * 100}%` }} />
              </div>
            ) : (
              <Button className="w-full" onClick={() => start.mutate()}>
                <Sparkles />
                {failed ? "Try again" : "Analyze repository"}
              </Button>
            )}
          </div>
        </div>
      </section>
      <div className="insights-heading">
        <h2>
          <Sparkles size={14} className="text-primary" />
          What you'll get
        </h2>
      </div>
      <div className="insights-grid">
        {analysisOutputs.map((o) => (
          <div className="insight" key={o.title}>
            <o.icon size={16} className="text-primary" />
            <h3>{o.title}</h3>
            <p>{o.text}</p>
          </div>
        ))}
      </div>
      <footer className="footer">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={11} />
          Your code stays yours. Always.
        </span>
        <span>Built for human understanding.</span>
      </footer>
    </main>
  );
}

const filters = ["All components", "frontend", "service", "data", "external"] as const;
type Filter = (typeof filters)[number];

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
const typeCounts: Record<ComponentType, [string, string]> = {
  frontend: ["app", "apps"],
  service: ["service", "services"],
  data: ["data store", "data stores"],
  external: ["integration", "integrations"],
};

// Links into the analyzed commit, so paths match what the map was built from.
const githubUrl = (project: Project, analysis: Analysis, path: string, kind: "blob" | "tree") =>
  `${project.repoUrl}/${kind}/${analysis.commit ?? encodeURIComponent(project.branch)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

function Workspace({ project, analysis }: { project: Project; analysis: Analysis }) {
  const { view = "System architecture", tab = "Graphs" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // Switching graphs or sections only swaps the panel, so keep the scroll position.
  const setView = (v: View) => void navigate({ search: { view: v }, resetScroll: false });
  const setTab = (t: Tab) =>
    void navigate({ search: (prev) => ({ ...prev, tab: t }), resetScroll: false });
  const { query, showToast } = useShell();
  // Starting a run replaces this page with the progress view until it completes.
  const start = useStartAnalysis(project.projectId);
  const { data: graph, status: graphStatus, error: graphError, refetch } = useGraph(analysis);
  const layout = useMemo(() => (graph ? layoutGraph(graph) : undefined), [graph]);
  // The open explore view, when it is one the analyzer builds.
  const meta = view === "System architecture" ? undefined : viewMeta[view];
  const viewQuery = useView(analysis, meta?.id);
  const byId = useMemo(() => new Map(graph?.components.map((c) => [c.id, c])), [graph]);
  // Until the user picks one, show the most connected component.
  const hub = useMemo(() => {
    if (!graph) return undefined;
    const degree = (id: string) =>
      graph.connections.filter((c) => c.from === id || c.to === id).length;
    return [...graph.components].sort((a, b) => degree(b.id) - degree(a.id))[0];
  }, [graph]);
  const [selectedId, setSelectedId] = useState<string>();
  const current = (selectedId ? byId.get(selectedId) : undefined) ?? hub;
  const [modal, setModal] = useState<"filter" | null>(null);
  const [filter, setFilter] = useState<Filter>("All components");
  const closeModal = () => setModal(null);
  const graphRef = useRef<HTMLElement>(null);
  // Selects a component on the architecture map and brings the map into view.
  const inspect = (id: string) => {
    setSelectedId(id);
    void navigate({ search: {}, resetScroll: false });
    graphRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const sourceUrl = (path: string, kind: "blob" | "tree") =>
    githubUrl(project, analysis, path, kind);
  const analyze = () =>
    start.mutate(undefined, {
      onError: (err) => showToast(err.message),
    });
  const languages = Object.entries(analysis.stats?.languages ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([language]) => language);
  const isDimmed = (id: string) => {
    const c = byId.get(id);
    if (!c) return false;
    return (
      (!!query && !`${c.name} ${c.tech}`.toLowerCase().includes(query.toLowerCase())) ||
      (filter !== "All components" && c.type !== filter)
    );
  };

  const components = graph?.components ?? [];
  const connections = graph?.connections ?? [];
  const faq = graph?.faq;
  const externalLinks = connections.filter((c) => byId.get(c.to)?.type === "external").length;
  const pending = graphStatus === "pending" ? "…" : "—";
  const stats = [
    {
      label: "Files analyzed",
      value: String(analysis.stats?.files ?? "—"),
      foot: languages.join(" · ") || "No source files found",
      icon: FileCode2,
    },
    {
      label: "Components",
      value: graph ? String(components.length) : pending,
      foot: graph
        ? (Object.keys(typeCounts) as ComponentType[])
            .map((type) => [type, components.filter((c) => c.type === type).length] as const)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => plural(count, ...typeCounts[type]))
            .join(" · ")
        : "Loading map...",
      icon: Box,
    },
    {
      label: "Connections",
      value: graph ? String(connections.length) : pending,
      foot: graph
        ? `${connections.length - externalLinks} internal · ${externalLinks} external`
        : "Loading map...",
      icon: GitFork,
    },
    {
      label: "Questions answered",
      value: faq ? String(faq.length) : pending,
      foot: !graph
        ? "Loading map..."
        : !faq
          ? "Re-analyze to answer"
          : faq.some((e) => e.topic === "risks")
            ? "Including risks to watch"
            : "From this commit",
      icon: MessageCircleQuestionMark,
    },
  ];

  const exportGraph = () => {
    if (!graph) return;
    const { components, connections, faq } = graph;
    const source = { project: project.name, repository: project.repoUrl, commit: analysis.commit };
    // An open explore view exports itself; otherwise the architecture map.
    const content = JSON.stringify(
      viewQuery.data
        ? { ...source, view, nodes: viewQuery.data.nodes, edges: viewQuery.data.edges }
        : { ...source, components, connections, faq },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}-${viewQuery.data ? viewQuery.data.view : "architecture"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${viewQuery.data ? view : "Architecture"} exported as JSON`);
  };

  // Shown in place of the graph or files while the map can't be drawn.
  const blocked =
    graphStatus === "pending" ? (
      <CanvasMessage icon={<Loader2 size={17} className="animate-spin" />}>
        <p>Loading the architecture map...</p>
      </CanvasMessage>
    ) : graphStatus === "error" ? (
      <CanvasMessage icon={<TriangleAlert size={17} />} failed>
        <h2>Couldn't load the architecture map</h2>
        <p>{graphError.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
          <Button size="sm" disabled={start.isPending} onClick={analyze}>
            <Sparkles />
            Re-analyze
          </Button>
        </div>
      </CanvasMessage>
    ) : !components.length ? (
      <CanvasMessage icon={<Network size={17} />}>
        <h2>No components found</h2>
        <p>The analysis didn't find any components in this repository.</p>
      </CanvasMessage>
    ) : null;

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-3">
            <h1>{project.name}</h1>
            <span className="pill">Analyzed</span>
          </div>
          <p>
            Project overview <span className="mx-2">/</span>{" "}
            {tab === "Documentation" ? "Documentation" : view}
          </p>
        </div>
        <div className="heading-actions">
          <ProjectActions project={project} />
          <Button size="sm" disabled={start.isPending} onClick={analyze}>
            <Sparkles />
            {start.isPending ? "Starting..." : "Re-analyze"}
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
        <BranchSwitcher project={project} disabled={start.isPending} onAnalyze={analyze} />
        {analysis.commit && (
          <span className="font-mono text-[10px]" title={analysis.commit}>
            {analysis.commit.slice(0, 7)}
          </span>
        )}
        <span className="ml-auto">
          <span className="status-dot" />
          Last analyzed{" "}
          {formatDistanceToNow(new Date(analysis.finishedAt ?? analysis.startedAt), {
            addSuffix: true,
          })}
        </span>
      </div>
      <div className="stats-row">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">
              {s.label}
              <s.icon size={14} />
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>
      {graph && (
        <Faq
          key={analysis.analysisId}
          faq={faq}
          byId={byId}
          sourceUrl={sourceUrl}
          onInspect={inspect}
          analyzing={start.isPending}
          onAnalyze={analyze}
        />
      )}
      <section
        ref={graphRef}
        className="graph-section"
        aria-label="Project graphs and documentation"
      >
        <div className="graph-toolbar">
          <div className="graph-tabs" role="tablist">
            {tabs.map((t) => (
              <Button
                key={t}
                variant="ghost"
                role="tab"
                aria-selected={tab === t}
                className={`graph-tab ${tab === t ? "selected" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "Graphs" ? <Network size={13} /> : <BookOpen size={13} />} {t}
              </Button>
            ))}
          </div>
          <div className={`flex items-center gap-2 ${tab === "Graphs" ? "" : "invisible"}`}>
            <Button
              variant="ghost"
              size="icon"
              title="Filter components"
              className={`h-7 w-7 ${filter === "All components" ? "text-muted-foreground" : "text-primary"}`}
              onClick={() => setModal("filter")}
            >
              <Settings2 />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              disabled={!graph}
              onClick={exportGraph}
            >
              <ArrowDownToLine size={12} />
              Export
            </Button>
          </div>
        </div>
        {tab === "Graphs" && <ViewSwitcher view={view} analysis={analysis} onChange={setView} />}
        {blocked ??
          (tab === "Graphs" ? (
            view !== "System architecture" ? (
              <ExploreView
                key={view}
                view={view}
                meta={meta}
                analysis={analysis}
                result={viewQuery}
                byId={byId}
                query={query}
                sourceUrl={(path, kind) => githubUrl(project, analysis, path, kind)}
                analyzing={start.isPending}
                onAnalyze={analyze}
                onBack={() => setView("System architecture")}
                onOpenComponent={(id) => {
                  setSelectedId(id);
                  setView("System architecture");
                }}
              />
            ) : (
              graph &&
              layout &&
              current && (
                <div className="graph-body">
                  <GraphCanvas
                    layout={layout}
                    selected={current.id}
                    onSelect={setSelectedId}
                    isDimmed={isDimmed}
                    caption={
                      <>
                        <Network size={12} />
                        {view}
                        <span className="text-muted-foreground/50">/</span>
                        {plural(components.length, "component")} ·{" "}
                        {plural(connections.length, "connection")}
                      </>
                    }
                  />
                  <DetailPanel
                    node={current}
                    graph={graph}
                    byId={byId}
                    sourceUrl={(path, kind) => githubUrl(project, analysis, path, kind)}
                    onSelect={setSelectedId}
                  />
                </div>
              )
            )
          ) : (
            <div className="insights-expanded">
              <div className="flex items-center justify-between gap-4 mb-1">
                <h2 className="text-sm font-semibold">Key files</h2>
                <span className="text-muted-foreground text-xs">
                  {plural(components.filter((c) => c.entryPoint).length, "component entry point")}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] mb-6">
                The file to open first for each component. Select one to see it on the map.
              </p>
              {components
                .filter((c) => c.entryPoint)
                .filter((c) =>
                  `${c.name} ${c.entryPoint} ${c.paths.join(" ")}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((c) => (
                  <Button
                    key={c.id}
                    variant="ghost"
                    className="flex w-full justify-start h-14 border-b border-border rounded-none"
                    onClick={() => inspect(c.id)}
                  >
                    <FileCode2 className="text-primary" />
                    <span className="flex flex-col items-start min-w-0">
                      <span className="font-mono text-xs truncate max-w-full">{c.entryPoint}</span>
                      <span className="text-muted-foreground text-[10px]">{c.name}</span>
                    </span>
                    <span className="ml-auto text-muted-foreground text-[10px]">
                      {plural(c.files, "file")}
                    </span>
                    <ChevronRight />
                  </Button>
                ))}
            </div>
          ))}
        <div className="legend">
          {(meta && tab === "Graphs"
            ? Object.values(meta.kinds).map((k) => [k.tone, k.label] as const)
            : (["frontend", "service", "data", "external"] as const).map(
                (type) => [type, type === "frontend" ? "Frontend" : typeLabels[type]] as const,
              )
          ).map(([tone, label]) => (
            <span className="legend-item" key={label}>
              <span className={`legend-dot ${tone === "frontend" ? "" : tone}`} />
              {label}
            </span>
          ))}
          {tab === "Graphs" && (
            <span className="ml-auto hidden sm:block font-mono">
              Drag to pan · Ctrl + scroll to zoom
            </span>
          )}
        </div>
      </section>
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
            {filters.map((f) => (
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
    </main>
  );
}

function CanvasMessage({
  icon,
  failed = false,
  children,
}: {
  icon: ReactNode;
  failed?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="canvas-empty">
      <div>
        <span className={`node-icon ${failed ? "failed" : "service"}`}>{icon}</span>
        {children}
      </div>
    </div>
  );
}

function DetailPanel({
  node,
  graph,
  byId,
  sourceUrl,
  onSelect,
}: {
  node: GraphComponent;
  graph: ArchitectureGraph;
  byId: Map<string, GraphComponent>;
  sourceUrl: (path: string, kind: "blob" | "tree") => string;
  onSelect: (id: string) => void;
}) {
  const Icon = nodeIcons[node.type];
  const related = graph.connections.flatMap((c) => {
    const outgoing = c.from === node.id;
    if (!outgoing && c.to !== node.id) return [];
    const other = byId.get(outgoing ? c.to : c.from);
    return other ? [{ other, outgoing, label: c.label }] : [];
  });
  return (
    <aside className="detail-panel">
      <div className="detail-label">Component details</div>
      <span className={`node-icon ${node.type}`}>
        <Icon size={17} />
      </span>
      <h2>{node.name}</h2>
      <span className="pill">
        {node.type === "service" ? "Backend service" : typeLabels[node.type]}
      </span>
      <p>{node.description}</p>
      <div className="detail-divider" />
      <div className="detail-kv">
        <span>Technology</span>
        <span>{node.tech}</span>
      </div>
      {node.paths.length > 0 && (
        <div className="detail-kv">
          <span>Files</span>
          <span>{node.files}</span>
        </div>
      )}
      <div className="detail-kv">
        <span>Connections</span>
        <span>{related.length}</span>
      </div>
      <div className="detail-divider" />
      {node.entryPoint ? (
        <>
          <div className="text-[10px] font-medium">Entry point</div>
          <div className="file-path">
            <FileCode2 size={12} className="shrink-0" />
            <span className="truncate" title={node.entryPoint}>
              {node.entryPoint}
            </span>
          </div>
          <Button variant="outline" className="w-full h-7 text-[10px]" asChild>
            <a href={sourceUrl(node.entryPoint, "blob")} target="_blank" rel="noreferrer">
              <Code2 size={12} />
              View source
              <ExternalLink size={11} className="ml-auto" />
            </a>
          </Button>
          {node.paths.length > 0 && (
            <>
              <div className="text-[10px] font-medium mt-4">Code in</div>
              {node.paths.slice(0, 5).map((path) => (
                <a
                  key={path}
                  className="file-path hover:text-foreground my-2"
                  href={sourceUrl(path, "tree")}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FolderGit2 size={12} className="shrink-0" />
                  <span className="truncate" title={path}>
                    {path}
                  </span>
                </a>
              ))}
            </>
          )}
        </>
      ) : (
        <p>
          {node.type === "external"
            ? "A third-party service. Its code lives outside this repository."
            : "No code for this component in the repository."}
        </p>
      )}
      <div className="detail-divider" />
      <div className="flex justify-between text-[10px]">
        <span>Connected to</span>
        <span className="text-muted-foreground">{related.length}</span>
      </div>
      {related.map(({ other, outgoing, label }) => (
        <Button
          key={`${outgoing ? "out" : "in"}-${other.id}`}
          variant="ghost"
          className="w-full justify-start h-8 p-0 text-[10px]"
          title={`${outgoing ? node.name : other.name} → ${outgoing ? other.name : node.name}: ${label}`}
          onClick={() => onSelect(other.id)}
        >
          <span className={`legend-dot ${other.type}`} />
          <span className="truncate">{other.name}</span>
          <span className="connection-label ml-auto truncate">
            {outgoing ? "→" : "←"} {label}
          </span>
          <ChevronRight size={11} className="text-muted-foreground shrink-0" />
        </Button>
      ))}
    </aside>
  );
}

// Picks which graph the Graphs section shows. Views this run didn't build stay selectable,
// so their page can say why, but are dimmed.
function ViewSwitcher({
  view,
  analysis,
  onChange,
}: {
  view: View;
  analysis: Analysis;
  onChange: (view: View) => void;
}) {
  const unbuilt = (v: View) => {
    const id = viewMeta[v]?.id;
    const status = id && analysis.views?.[id];
    return status === "NOT_APPLICABLE"
      ? "Nothing to show in this repository"
      : status === "FAILED"
        ? "Couldn't be built in the last analysis"
        : undefined;
  };
  return (
    <div className="view-bar" role="tablist" aria-label="Graphs">
      {views.map((v) => {
        const Icon = viewIcons[v];
        const reason = unbuilt(v);
        return (
          <Button
            key={v}
            variant="ghost"
            role="tab"
            aria-selected={view === v}
            title={reason ?? v}
            className={`view-chip ${view === v ? "selected" : ""} ${reason ? "unbuilt" : ""}`}
            onClick={() => onChange(v)}
          >
            <Icon size={12} />
            {v}
          </Button>
        );
      })}
    </div>
  );
}

const faqStyles: Record<FaqTopic, { icon: LucideIcon; color: string }> = {
  overview: { icon: Network, color: "text-primary" },
  connections: { icon: GitFork, color: "text-blue" },
  endpoints: { icon: Plug, color: "text-blue" },
  data: { icon: Database, color: "text-amber" },
  deployment: { icon: Cloud, color: "text-violet" },
  risks: { icon: TriangleAlert, color: "text-amber" },
  onboarding: { icon: BookOpen, color: "text-primary" },
  other: { icon: CircleQuestionMark, color: "text-muted-foreground" },
};

// Questions shown before "Show all", so the map stays near the top of the page.
const FAQ_PREVIEW = 4;

// Answers to the questions a newcomer asks first, written by the analysis.
function Faq({
  faq,
  byId,
  sourceUrl,
  onInspect,
  analyzing,
  onAnalyze,
}: {
  faq: FaqEntry[] | undefined;
  byId: Map<string, GraphComponent>;
  sourceUrl: (path: string, kind: "blob" | "tree") => string;
  onInspect: (id: string) => void;
  analyzing: boolean;
  onAnalyze: () => void;
}) {
  const [open, setOpen] = useState(() => new Set([0]));
  const [showAll, setShowAll] = useState(false);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  const heading = (
    <div className="faq-header">
      <h2>
        <MessageCircleQuestionMark size={14} className="text-primary" />
        Key questions
        {faq && <span className="pill">{plural(faq.length, "answer")}</span>}
      </h2>
    </div>
  );

  // Runs from before the FAQ existed saved none.
  if (!faq)
    return (
      <section className="faq" aria-label="Key questions">
        {heading}
        <div className="faq-empty">
          <p>
            Re-analyze to see how this system is structured, which endpoints matter most, and what
            to watch out for.
          </p>
          <Button size="sm" variant="outline" disabled={analyzing} onClick={onAnalyze}>
            <Sparkles />
            Re-analyze
          </Button>
        </div>
      </section>
    );
  if (!faq.length) return null;

  const shown = showAll ? faq : faq.slice(0, FAQ_PREVIEW);
  return (
    <section className="faq" aria-label="Key questions">
      {heading}
      <ul className="faq-list">
        {shown.map((entry, i) => {
          const { icon: Icon, color } = faqStyles[entry.topic] ?? faqStyles.other;
          const expanded = open.has(i);
          const involved = entry.componentIds.flatMap((id) => byId.get(id) ?? []);
          return (
            <li key={entry.question} className={expanded ? "open" : undefined}>
              <Button
                variant="ghost"
                className="faq-question"
                aria-expanded={expanded}
                aria-controls={`faq-${i}`}
                onClick={() => toggle(i)}
              >
                <Icon size={14} className={color} />
                <span>{entry.question}</span>
                <ChevronDown size={14} className="faq-chevron" />
              </Button>
              {expanded && (
                <div className="faq-answer" id={`faq-${i}`}>
                  <AnswerText text={entry.answer} />
                  {(involved.length > 0 || entry.paths.length > 0) && (
                    <div className="faq-refs">
                      {involved.slice(0, 4).map((c) => (
                        <Button
                          key={c.id}
                          variant="link"
                          className="p-0 h-5 text-[10px] text-primary"
                          title={`Show ${c.name} on the map`}
                          onClick={() => onInspect(c.id)}
                        >
                          <span className={`legend-dot ${c.type}`} />
                          {c.name}
                          <ArrowRight size={11} />
                        </Button>
                      ))}
                      {entry.paths.map((path) => (
                        <a
                          key={path}
                          className="faq-path"
                          href={sourceUrl(
                            path.replace(/\/$/, ""),
                            path.endsWith("/") ? "tree" : "blob",
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {path.endsWith("/") ? <FolderGit2 size={11} /> : <FileCode2 size={11} />}
                          {path}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {faq.length > FAQ_PREVIEW && (
        <Button
          variant="ghost"
          size="sm"
          className="faq-more"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer" : `Show all ${faq.length} questions`}
          <ChevronDown size={12} className={showAll ? "rotate-180" : undefined} />
        </Button>
      )}
    </section>
  );
}

// Paragraphs and "- " lists, with `backticked` names set in code type.
function AnswerText({ text }: { text: string }) {
  const inline = (line: string) =>
    line
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .split(/`([^`]+)`/)
      .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (!items.length) return;
    blocks.push(
      <ul key={blocks.length}>
        {items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    items = [];
  };
  for (const line of text.split("\n").map((l) => l.trim())) {
    if (!line) continue;
    const item = /^[-*•]\s+(.*)$/.exec(line);
    if (item) {
      items.push(item[1]!);
    } else {
      flush();
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

// One explore view: its graph once built, or why there isn't one.
function ExploreView({
  view,
  meta,
  analysis,
  result,
  byId,
  query,
  sourceUrl,
  analyzing,
  onAnalyze,
  onBack,
  onOpenComponent,
}: {
  view: View;
  meta: ViewMeta | undefined;
  analysis: Analysis;
  result: ReturnType<typeof useView>;
  byId: Map<string, GraphComponent>;
  query: string;
  sourceUrl: (path: string, kind: "blob" | "tree") => string;
  analyzing: boolean;
  onAnalyze: () => void;
  onBack: () => void;
  onOpenComponent: (id: string) => void;
}) {
  const [showOptional, setShowOptional] = useState(false);
  // What's drawn: hub leaves folded into one node, leaves with the same callers merged.
  // The caption still counts the full view.
  const simplified = useMemo(
    () => (result.data && meta ? simplifyView(result.data, meta, { showOptional }) : undefined),
    [result.data, meta, showOptional],
  );
  const data = simplified;
  const layout = useMemo(
    () => (data && meta ? layoutView(data, meta, (id) => byId.get(id)?.name) : undefined),
    [data, meta, byId],
  );
  const nodesById = useMemo(() => new Map(data?.nodes.map((n) => [n.id, n])), [data]);
  const [selectedId, setSelectedId] = useState<string>();
  const current = (selectedId ? nodesById.get(selectedId) : undefined) ?? data?.nodes[0];
  const status = meta && analysis.views?.[meta.id];

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeft />
      System architecture
    </Button>
  );
  const reanalyze = (
    <Button size="sm" disabled={analyzing} onClick={onAnalyze}>
      <Sparkles />
      Re-analyze
    </Button>
  );

  if (!meta)
    return (
      <CanvasMessage icon={<Network size={17} />}>
        <h2>{view} isn't mapped yet</h2>
        <p>
          Struct builds {["System architecture", ...Object.keys(viewMeta)].join(", ")} so far. This
          view will be built from the same analysis.
        </p>
        {back}
      </CanvasMessage>
    );
  if (!status)
    return (
      <CanvasMessage icon={<Network size={17} />}>
        <h2>{view} needs a fresh analysis</h2>
        <p>This project was analyzed before Struct could build this view. Re-analyze to add it.</p>
        <div className="flex gap-2">
          {back}
          {reanalyze}
        </div>
      </CanvasMessage>
    );
  if (status === "NOT_APPLICABLE")
    return (
      <CanvasMessage icon={<Network size={17} />}>
        <h2>Nothing to show for {view}</h2>
        <p>{meta.empty}</p>
        {back}
      </CanvasMessage>
    );
  if (status === "FAILED")
    return (
      <CanvasMessage icon={<TriangleAlert size={17} />} failed>
        <h2>Couldn't build {view}</h2>
        <p>The rest of the analysis finished. Re-analyze to try this view again.</p>
        <div className="flex gap-2">
          {back}
          {reanalyze}
        </div>
      </CanvasMessage>
    );
  if (result.status === "pending")
    return (
      <CanvasMessage icon={<Loader2 size={17} className="animate-spin" />}>
        <p>Loading {view}...</p>
      </CanvasMessage>
    );
  if (result.status === "error")
    return (
      <CanvasMessage icon={<TriangleAlert size={17} />} failed>
        <h2>Couldn't load {view}</h2>
        <p>{result.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void result.refetch()}>
          Try again
        </Button>
      </CanvasMessage>
    );
  if (!data || !layout || !current) return null;

  // In a focus view, a node the user picks fades everything it isn't linked to.
  const focused = meta.focus && selectedId ? current.id : undefined;
  const linked = new Set(
    focused
      ? data.edges.flatMap((e) => (e.from === focused ? [e.to] : e.to === focused ? [e.from] : []))
      : [],
  );
  const isDimmed = (id: string) => {
    if (focused && id !== focused && !linked.has(id)) return true;
    const n = nodesById.get(id);
    // Merged nodes match on what they stand for, too.
    const text = `${n?.name} ${n?.detail} ${n?.fields?.map((f) => f.name).join(" ") ?? ""}`;
    return !!query && !!n && !text.toLowerCase().includes(query.toLowerCase());
  };
  const optional = meta.optional;
  const optionalCount = optional
    ? (result.data?.nodes.filter((n) => n.kind === optional.kind).length ?? 0)
    : 0;
  // Picking the focused node again shows the whole view.
  const select = (id: string) => setSelectedId(meta.focus && id === selectedId ? undefined : id);
  return (
    <div className="graph-body">
      <GraphCanvas
        layout={layout}
        selected={current.id}
        onSelect={select}
        isDimmed={isDimmed}
        caption={
          <>
            <Network size={12} />
            {view}
            <span className="text-muted-foreground/50">/</span>
            {meta.summary(result.data?.nodes ?? data.nodes)}
            {optional && optionalCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground"
                aria-pressed={showOptional}
                onClick={() => setShowOptional((v) => !v)}
              >
                {showOptional ? "Hide" : "Show"} {optionalCount} {optional.label}
              </Button>
            )}
          </>
        }
      />
      <ViewDetailPanel
        node={current}
        graph={data}
        nodesById={nodesById}
        meta={meta}
        component={current.componentId ? byId.get(current.componentId) : undefined}
        sourceUrl={sourceUrl}
        onSelect={setSelectedId}
        onOpenComponent={onOpenComponent}
      />
    </div>
  );
}

function ViewDetailPanel({
  node,
  graph,
  nodesById,
  meta,
  component,
  sourceUrl,
  onSelect,
  onOpenComponent,
}: {
  node: ViewNode;
  graph: Pick<ViewGraph, "nodes" | "edges">;
  nodesById: Map<string, ViewNode>;
  meta: ViewMeta;
  component: GraphComponent | undefined;
  sourceUrl: (path: string, kind: "blob" | "tree") => string;
  onSelect: (id: string) => void;
  onOpenComponent: (id: string) => void;
}) {
  const kind = kindOf(meta, node.kind);
  const related = graph.edges.flatMap((e) => {
    const outgoing = e.from === node.id;
    if (!outgoing && e.to !== node.id) return [];
    const other = nodesById.get(outgoing ? e.to : e.from);
    return other ? [{ other, outgoing, label: e.label }] : [];
  });
  return (
    <aside className="detail-panel">
      <div className="detail-label">Details</div>
      <span className={`node-icon ${kind.tone}`}>
        <kind.icon size={17} />
      </span>
      <h2>{node.name}</h2>
      <span className="pill">{kind.label}</span>
      <p>{node.detail}</p>
      {node.fields && node.fields.length > 0 && (
        <>
          <div className="detail-divider" />
          <div className="flex justify-between text-[10px]">
            <span>{meta.fieldsLabel ?? "Fields"}</span>
            <span className="text-muted-foreground">{node.fields.length}</span>
          </div>
          <ul className="detail-fields">
            {node.fields.map((f) => (
              <li key={f.name}>
                <FieldKey field={f} />
                <span className="truncate" title={f.name}>
                  {f.name}
                </span>
                <span className="field-type truncate" title={f.type}>
                  {f.type}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="detail-divider" />
      <div className="detail-kv">
        <span>{meta.groupLabel}</span>
        <span>{node.group}</span>
      </div>
      <div className="detail-kv">
        <span>Connections</span>
        <span>{related.length}</span>
      </div>
      {component && (
        <div className="detail-kv">
          <span>Component</span>
          <Button
            variant="link"
            className="p-0 h-auto text-[10px]"
            onClick={() => onOpenComponent(component.id)}
          >
            {component.name}
            <ArrowRight size={11} />
          </Button>
        </div>
      )}
      {node.path && (
        <>
          <div className="detail-divider" />
          <div className="text-[10px] font-medium">Defined in</div>
          <div className="file-path">
            <FileCode2 size={12} className="shrink-0" />
            <span className="truncate" title={node.path}>
              {node.path}
            </span>
          </div>
          <Button variant="outline" className="w-full h-7 text-[10px]" asChild>
            <a href={sourceUrl(node.path, "blob")} target="_blank" rel="noreferrer">
              <Code2 size={12} />
              View source
              <ExternalLink size={11} className="ml-auto" />
            </a>
          </Button>
        </>
      )}
      <div className="detail-divider" />
      <div className="flex justify-between text-[10px]">
        <span>Connected to</span>
        <span className="text-muted-foreground">{related.length}</span>
      </div>
      {related.map(({ other, outgoing, label }) => {
        const otherKind = kindOf(meta, other.kind);
        return (
          <Button
            key={`${outgoing ? "out" : "in"}-${other.id}`}
            variant="ghost"
            className="w-full justify-start h-8 p-0 text-[10px]"
            onClick={() => onSelect(other.id)}
          >
            <span className={`legend-dot ${otherKind.tone === "frontend" ? "" : otherKind.tone}`} />
            <span className="truncate">{other.name}</span>
            <span className="connection-label ml-auto truncate">
              {outgoing ? "→" : "←"} {label}
            </span>
            <ChevronRight size={11} className="text-muted-foreground shrink-0" />
          </Button>
        );
      })}
    </aside>
  );
}
