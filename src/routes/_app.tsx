import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useParams,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { fetchUserAttributes, getCurrentUser, signOut } from "aws-amplify/auth";
import "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Braces,
  Check,
  CheckCheck,
  ChevronRight,
  Database,
  FolderGit2,
  GitFork,
  Globe,
  HelpCircle,
  Moon,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Sun,
  Upload,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { ShellContext } from "@/hooks/use-shell";
import { useTheme } from "@/hooks/use-theme";
import { views } from "@/lib/graph";
import { useAnalysis, useCreateProject, useGraph, useProjects } from "@/lib/projects";

// Pathless layout: every signed-in page renders inside this sidebar + top bar shell.
export const Route = createFileRoute("/_app")({
  // Cognito tokens live in browser storage, so the auth check has to run on the client.
  ssr: false,
  beforeLoad: async () => {
    try {
      const { signInDetails } = await getCurrentUser();
      const attributes = await fetchUserAttributes().catch(() => undefined);
      return { userEmail: attributes?.email ?? signInDetails?.loginId ?? "" };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
});

const viewIcons = [Network, GitFork, Braces, Database, ArrowRight, Globe, Workflow];
const isMobile = () => window.matchMedia("(max-width: 700px)").matches;

type ShellModal = "import" | "documentation" | "help" | "account" | "notifications";

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modal, setModal] = useState<ShellModal | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const { dark, toggleTheme } = useTheme();
  const { userEmail } = Route.useRouteContext();
  const initials = userEmail.slice(0, 2).toUpperCase() || "?";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: projects = [], status, refetch } = useProjects();
  const { projectId } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const location = useRouterState({ select: (s) => s.location });
  const active = projectId ? projects.find((p) => p.projectId === projectId) : undefined;
  // Insights and the explore views only exist once the active project has been analyzed.
  const { data: analysis } = useAnalysis(active?.projectId);
  const analyzed = active && analysis?.status === "COMPLETE" ? active : undefined;
  // Shares the workspace's cached graph, so this costs no extra request there.
  const { data: graph } = useGraph(analyzed ? analysis : undefined);
  const activeView = search.view ?? views[0];
  const onProjectsPage = location.pathname === "/projects" || location.pathname === "/projects/";

  useEffect(() => {
    if (isMobile()) setSidebarOpen(false);
  }, []);
  // Each page has its own search scope, and on mobile the sidebar closes once a link is followed.
  useEffect(() => {
    setQuery("");
  }, [location.pathname]);
  useEffect(() => {
    if (isMobile()) setSidebarOpen(false);
  }, [location.href]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && isMobile()) setSidebarOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const shell = {
    query,
    setQuery,
    showToast: setToast,
    openImport: () => setModal("import"),
  };
  const closeModal = () => setModal(null);

  return (
    <ShellContext.Provider value={shell}>
      <div className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        {sidebarOpen && (
          <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <aside className="sidebar" id="workspace-sidebar" aria-label="Workspace navigation">
          <div className="brand">
            <div className="brand-mark">
              <span />
              <span />
              <span />
            </div>
            <span className="sidebar-text">
              struct<span className="text-primary">.</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-collapse"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={sidebarOpen}
              aria-controls="workspace-sidebar"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          </div>
          <Button
            asChild
            variant="ghost"
            className={`sidebar-link ${onProjectsPage ? "active" : ""}`}
          >
            <Link to="/projects" title="All projects" aria-label="All projects">
              <FolderGit2 />
              <span className="sidebar-text">All projects</span>
              <span className="count sidebar-text">{projects.length}</span>
            </Link>
          </Button>
          {analyzed && (
            <Button
              asChild
              variant="ghost"
              className={`sidebar-link ${search.tab === "Insights" ? "active" : ""}`}
            >
              <Link
                to="/projects/$projectId"
                params={{ projectId: analyzed.projectId }}
                search={{ ...(search.view && { view: search.view }), tab: "Insights" }}
                title="Insights"
                aria-label="Insights"
              >
                <Sparkles />
                <span className="sidebar-text">Insights</span>
                <span className="count sidebar-text">3</span>
              </Link>
            </Button>
          )}
          <div className="nav-label sidebar-text flex justify-between items-center">
            Projects
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              title="New project"
              onClick={() => setModal("import")}
            >
              <Plus />
            </Button>
          </div>
          {status === "pending" ? (
            <p className="sidebar-text px-3 py-1 text-[11px] text-muted-foreground">
              Loading projects...
            </p>
          ) : status === "error" ? (
            <Button
              variant="ghost"
              className="sidebar-link sidebar-text text-[11px] text-muted-foreground"
              onClick={() => void refetch()}
            >
              Couldn't load projects. Retry
            </Button>
          ) : projects.length === 0 ? (
            <p className="sidebar-text px-3 py-1 text-[11px] text-muted-foreground">
              No projects yet
            </p>
          ) : (
            projects.map((p, i) => (
              <Button
                key={p.projectId}
                asChild
                variant="ghost"
                className={`sidebar-link project-link ${p.projectId === projectId ? "active" : ""}`}
              >
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: p.projectId }}
                  title={p.name}
                  aria-label={p.name}
                >
                  <span
                    className={`project-dot ${i % 3 === 1 ? "blue" : i % 3 === 2 ? "violet" : ""}`}
                  />
                  <span className="sidebar-text truncate">{p.name}</span>
                </Link>
              </Button>
            ))
          )}
          {analyzed && (
            <>
              <div className="nav-label sidebar-text">Explore</div>
              <div className="visualization-nav">
                {views.map((v, i) => {
                  const Icon = viewIcons[i] ?? Network;
                  return (
                    <Button
                      key={v}
                      asChild
                      variant="ghost"
                      className={`sidebar-link ${activeView === v ? "active" : ""}`}
                    >
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: analyzed.projectId }}
                        search={{ view: v }}
                        title={v}
                        aria-label={v}
                      >
                        <Icon />
                        <span className="sidebar-text">{v}</span>
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </>
          )}
          <div className="sidebar-bottom">
            <Button
              variant="ghost"
              className="sidebar-link"
              title="Documentation"
              aria-label="Documentation"
              onClick={() => setModal("documentation")}
            >
              <BookOpen />
              <span className="sidebar-text">Documentation</span>
            </Button>
            <Button
              variant="ghost"
              className="sidebar-link"
              title="Help & feedback"
              aria-label="Help & feedback"
              onClick={() => setModal("help")}
            >
              <HelpCircle />
              <span className="sidebar-text">Help & feedback</span>
            </Button>
            <Button
              variant="ghost"
              className="user-row"
              title="Account settings"
              aria-label="Account settings"
              onClick={() => setModal("account")}
            >
              <div className="avatar">{initials}</div>
              <div className="sidebar-text text-left">
                <div className="text-[11px] font-semibold truncate max-w-32" title={userEmail}>
                  {userEmail}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Free plan</div>
              </div>
              <MoreHorizontal className="sidebar-text ml-auto" />
            </Button>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="topbar">
            <div className="topbar-start">
              <Button
                variant="ghost"
                size="icon"
                className="sidebar-toggle"
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-expanded={sidebarOpen}
                aria-controls="workspace-sidebar"
                onClick={() => setSidebarOpen((open) => !open)}
              >
                {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
              </Button>
              <nav className="breadcrumb" aria-label="Breadcrumb">
                {projectId ? (
                  <>
                    <Link to="/projects" className="crumb-secondary crumb-link">
                      Projects
                    </Link>
                    <ChevronRight size={12} className="crumb-secondary text-muted-foreground" />
                    <span className="font-medium">{active?.name ?? "Project"}</span>
                    <ChevronRight size={12} className="crumb-secondary text-muted-foreground" />
                    <span className="crumb-secondary text-muted-foreground">Overview</span>
                  </>
                ) : (
                  <span className="font-medium">Projects</span>
                )}
              </nav>
            </div>
            <div className="topbar-actions">
              <label className="search-box">
                <Search size={13} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={projectId ? "Search components..." : "Search projects..."}
                  aria-label={projectId ? "Search components" : "Search projects"}
                />
                <span className="key">⌘ K</span>
              </label>
              <Button
                variant="ghost"
                size="icon"
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                onClick={toggleTheme}
                className="text-muted-foreground h-8 w-8"
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Notifications"
                onClick={() => setModal("notifications")}
                className="text-muted-foreground h-8 w-8"
              >
                <Bell />
              </Button>
              <div className="avatar">{initials}</div>
            </div>
          </header>
          <Outlet />
        </div>
        {modal === "import" && <ImportModal onClose={closeModal} onToast={setToast} />}
        {modal === "documentation" && (
          <Modal title="Documentation" onClose={closeModal}>
            <p>
              Explore a project through architecture, dependencies, function calls, database
              relationships, API interactions, cloud infrastructure, and CI/CD views.
            </p>
            <p>
              Select a component to inspect its entry point and connections. Export a map as JSON to
              share your findings.
            </p>
          </Modal>
        )}
        {modal === "notifications" && (
          <Modal title="Notifications" onClose={closeModal}>
            {analyzed ? (
              <>
                <p className="flex items-center gap-2">
                  <CheckCheck className="text-primary" size={16} />
                  Analysis completed for {analyzed.name}.
                </p>
                {graph && (
                  <p>
                    {graph.components.length} components mapped · {graph.insights.length}{" "}
                    architecture insights available.
                  </p>
                )}
                <Button variant="outline" asChild>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: analyzed.projectId }}
                    search={{ ...(search.view && { view: search.view }), tab: "Insights" }}
                    onClick={closeModal}
                  >
                    View insights
                    <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <p>No notifications yet.</p>
            )}
          </Modal>
        )}
        {modal === "account" && (
          <Modal title="Your account" onClose={closeModal}>
            <div className="flex items-center gap-3 mt-6">
              <div className="avatar">{initials}</div>
              <div>
                <div>{userEmail}</div>
                <div className="text-muted-foreground text-xs mt-1">Free plan</div>
              </div>
            </div>
            <p>Signed in with Cognito. Profile editing isn't available yet.</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Drop cached projects so the next account never sees this one's data.
                void signOut().finally(() => {
                  queryClient.clear();
                  void navigate({ to: "/login" });
                });
              }}
            >
              Sign out
              <ArrowRight />
            </Button>
          </Modal>
        )}
        {modal === "help" && (
          <Modal title="Help & feedback" onClose={closeModal}>
            <p>Have an idea for making your codebase easier to understand?</p>
            <textarea
              aria-label="Feedback"
              placeholder="Share your feedback..."
              className="w-full min-h-28 rounded-md border border-border bg-background p-3 outline-none"
            />
            <Button
              className="mt-4"
              onClick={() => {
                closeModal();
                setToast("Thanks! Feedback noted in this preview session.");
              }}
            >
              Submit feedback
              <ArrowRight />
            </Button>
          </Modal>
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={16} className="text-primary" />
            {toast}
          </div>
        )}
      </div>
    </ShellContext.Provider>
  );
}

function ImportModal({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [repo, setRepo] = useState("");
  const [projectName, setProjectName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const create = useCreateProject();
  const repoName = /github\.com\/[^/]+\/([^/]+?)(?:\.git)?\/?$/.exec(repo.trim())?.[1];
  const error = create.error instanceof Error ? create.error.message : "";

  const submit = () => {
    create.mutate(
      { repoUrl: repo.trim(), ...(projectName.trim() && { name: projectName.trim() }) },
      {
        onSuccess: (created) => {
          onClose();
          onToast(`Project ${created.name} created. Run an analysis to map its architecture.`);
          void navigate({ to: "/projects/$projectId", params: { projectId: created.projectId } });
        },
      },
    );
  };

  return (
    <Modal title="Import a project" label="Import project" onClose={onClose}>
      <p>Start with a repository or upload project files.</p>
      <label className="text-xs">
        Repository URL
        <input
          type="text"
          placeholder="https://github.com/your-team/project"
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            create.reset();
          }}
        />
      </label>
      <label className="text-xs">
        Project name <span className="text-muted-foreground">(optional)</span>
        <input
          type="text"
          maxLength={100}
          placeholder={repoName ?? "Defaults to the repository name"}
          value={projectName}
          onChange={(e) => {
            setProjectName(e.target.value);
            create.reset();
          }}
        />
      </label>
      <div className="upload-zone">
        <Upload size={25} />
        <div className="text-xs mb-3">Choose source files from your codebase</div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".ts,.tsx,.js,.jsx,.py,.json,.go,.java,.rs"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setRepo(f.name.split(".")[0] ?? f.name);
              onToast(`${e.target.files?.length} source file(s) selected`);
            }
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Choose files
        </Button>
      </div>
      <p className="text-[10px]">
        Projects are saved to your account. Diagrams use sample data until automated code analysis
        is connected.
      </p>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={!repo.trim() || create.isPending} onClick={submit}>
        {create.isPending ? "Creating project..." : "Create project"}
        <ArrowRight />
      </Button>
    </Modal>
  );
}
