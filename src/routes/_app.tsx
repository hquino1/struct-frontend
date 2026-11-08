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
  Check,
  CheckCheck,
  ChevronRight,
  FolderGit2,
  HelpCircle,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { BranchField } from "@/components/branch-field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { ShellContext } from "@/hooks/use-shell";
import { useTheme } from "@/hooks/use-theme";
import {
  useAnalysis,
  useCreateProject,
  useRepositoryBranches,
  useGitHubConnection,
  useGraph,
  useProjects,
} from "@/lib/projects";

// beforeLoad runs on every navigation, even a search-param change, so the user's email is
// fetched from Cognito once per signed-in user rather than on each click.
let emailLookup: { userId: string; email: Promise<string | undefined> } | undefined;

// Pathless layout: every signed-in page renders inside this sidebar + top bar shell.
export const Route = createFileRoute("/_app")({
  // Cognito tokens live in browser storage, so the auth check has to run on the client.
  ssr: false,
  beforeLoad: async () => {
    try {
      // Reads the stored session, so signing out still redirects on the next navigation.
      const { userId, signInDetails } = await getCurrentUser();
      if (emailLookup?.userId !== userId) {
        emailLookup = {
          userId,
          email: fetchUserAttributes().then(
            (attributes) => attributes.email,
            () => undefined,
          ),
        };
      }
      return { userEmail: (await emailLookup.email) ?? signInDetails?.loginId ?? "" };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
});

const isMobile = () => window.matchMedia("(max-width: 700px)").matches;

type ShellModal = "import" | "guide" | "help" | "account" | "notifications";

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
  // Notifications only have something to say once the active project has been analyzed.
  const { data: analysis } = useAnalysis(active?.projectId);
  const analyzed = active && analysis?.status === "COMPLETE" ? active : undefined;
  // Shares the workspace's cached graph, so this costs no extra request there.
  const { data: graph } = useGraph(analyzed ? analysis : undefined);
  // Where the breadcrumb says you are inside a project.
  const section =
    search.tab === "Documentation" ? "Documentation" : (search.view ?? "System architecture");
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
          <div className="sidebar-bottom">
            <Button
              variant="ghost"
              className="sidebar-link"
              title="How Struct works"
              aria-label="How Struct works"
              onClick={() => setModal("guide")}
            >
              <BookOpen />
              <span className="sidebar-text">How Struct works</span>
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
                    <span className="crumb-secondary text-muted-foreground">{section}</span>
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
        {modal === "guide" && (
          <Modal title="How Struct works" onClose={closeModal}>
            <p>
              Each analyzed project opens with answers to key questions about the code, then its
              graphs: the system architecture, plus screens, dependencies, function calls, database
              schema, API interactions, cloud infrastructure, and CI/CD views. Switch between them
              above the graph.
            </p>
            <p>
              Select a component to inspect its entry point and connections, or open Documentation
              for the project's key files. Export a map as JSON to share your findings.
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
                    {graph.components.length} components mapped
                    {graph.faq && ` · ${graph.faq.length} key questions answered`}.
                  </p>
                )}
                <Button variant="outline" asChild>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: analyzed.projectId }}
                    onClick={closeModal}
                  >
                    View project
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
  // "" imports the repository's default branch.
  const [branch, setBranch] = useState("");
  const navigate = useNavigate();
  const create = useCreateProject();
  const branches = useRepositoryBranches(repo.trim());
  const { data: github } = useGitHubConnection();
  const repoName = /github\.com\/[^/]+\/([^/]+?)(?:\.git)?\/?$/.exec(repo.trim())?.[1];
  const error = create.error instanceof Error ? create.error.message : "";

  const submit = () => {
    create.mutate(
      {
        repoUrl: repo.trim(),
        ...(projectName.trim() && { name: projectName.trim() }),
        ...(branch.trim() && { branch: branch.trim() }),
      },
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
      <p>Import a GitHub repository. Struct reads its code and maps the architecture.</p>
      <label className="text-xs">
        Repository URL
        <input
          type="text"
          placeholder="https://github.com/your-team/project"
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            // A branch picked for one repository may not exist on the next.
            setBranch("");
            create.reset();
          }}
        />
      </label>
      {github?.enabled && github.installUrl && (
        <p className="text-xs">
          {github.login ? (
            <>
              Connected to GitHub as @{github.login}.{" "}
              <a className="text-primary underline" href={github.installUrl}>
                Choose which repositories Struct can read
              </a>
            </>
          ) : (
            <>
              Private repository?{" "}
              <a className="text-primary underline" href={github.installUrl}>
                Connect GitHub
              </a>{" "}
              and choose which repositories Struct can read.
            </>
          )}
        </p>
      )}
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
      <BranchField
        value={branch}
        onChange={(b) => {
          setBranch(b);
          create.reset();
        }}
        branches={branches}
        allowDefault
      />
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
