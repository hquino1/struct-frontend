import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FolderGit2, GitBranch, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteProjectModal } from "@/components/project-dialogs";
import { useShell } from "@/hooks/use-shell";
import type { Project } from "@/lib/api";
import { repoPath, useProjects } from "@/lib/projects";

export const Route = createFileRoute("/_app/projects/")({
  head: () => ({ meta: [{ title: "Projects — Struct" }] }),
  component: ProjectsPage,
});

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function ProjectsPage() {
  const { query, openImport } = useShell();
  const { data: projects = [], status, refetch } = useProjects();
  const [deleting, setDeleting] = useState<Project | null>(null);
  const term = query.trim().toLowerCase();
  const visible = term
    ? projects.filter((p) => `${p.name} ${repoPath(p)}`.toLowerCase().includes(term))
    : projects;

  return (
    <main className="main-content">
      <div className="page-heading">
        <div>
          <h1>Projects</h1>
          <p>
            {status === "success"
              ? `${projects.length} ${projects.length === 1 ? "repository" : "repositories"} in your account`
              : "Your GitHub repositories in Struct"}
          </p>
        </div>
        <div className="heading-actions">
          <Button size="sm" onClick={openImport}>
            <Plus />
            Import project
          </Button>
        </div>
      </div>

      <section className="projects-list" aria-label="Your projects">
        {status === "pending" ? (
          <p className="projects-empty">Loading projects...</p>
        ) : status === "error" ? (
          <div className="projects-empty">
            <p>Couldn't load your projects.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="projects-empty">
            <FolderGit2 size={28} className="text-primary" />
            <h2>Import your first repository</h2>
            <p>Paste a public GitHub URL to map its architecture.</p>
            <Button size="sm" onClick={openImport}>
              <Plus />
              Import project
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="projects-empty">No projects match "{query.trim()}".</p>
        ) : (
          <>
            <div className="projects-row projects-header" aria-hidden="true">
              <span>Name</span>
              <span>Repository</span>
              <span>Branch</span>
              <span>Created</span>
              <span />
            </div>
            {visible.map((p) => (
              <div key={p.projectId} className="projects-row">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: p.projectId }}
                  className="projects-row-link font-medium truncate"
                >
                  {p.name}
                </Link>
                <span className="projects-repo truncate">
                  <FolderGit2 size={12} />
                  {repoPath(p)}
                </span>
                <span className="projects-branch">
                  <GitBranch size={11} />
                  {p.branch}
                </span>
                <span className="text-muted-foreground">
                  {dateFormat.format(new Date(p.createdAt))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="projects-row-action h-7 w-7 text-muted-foreground hover:text-destructive"
                  title={`Delete ${p.name}`}
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </>
        )}
      </section>

      {deleting && <DeleteProjectModal project={deleting} onClose={() => setDeleting(null)} />}

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
