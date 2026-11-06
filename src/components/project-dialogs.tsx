import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { BranchField } from "@/components/branch-field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { useShell } from "@/hooks/use-shell";
import type { Project } from "@/lib/api";
import { repoPath, useDeleteProject, useProjectBranches, useUpdateProject } from "@/lib/projects";

// Edit and delete buttons for a project's page heading.
export function ProjectActions({ project }: { project: Project }) {
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const navigate = useNavigate();
  const closeModal = () => setModal(null);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        title="Edit project"
        aria-label="Edit project"
        onClick={() => setModal("edit")}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        title="Delete project"
        aria-label="Delete project"
        onClick={() => setModal("delete")}
      >
        <Trash2 />
      </Button>
      {modal === "edit" && <EditProjectModal project={project} onClose={closeModal} />}
      {modal === "delete" && (
        <DeleteProjectModal
          project={project}
          onClose={closeModal}
          onDeleted={() => void navigate({ to: "/projects" })}
        />
      )}
    </>
  );
}

export function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [branch, setBranch] = useState(project.branch);
  const { showToast } = useShell();
  const update = useUpdateProject(project.projectId);
  const branches = useProjectBranches(project.projectId);
  const error = update.error instanceof Error ? update.error.message : "";
  // Only send what changed, so an unchanged form is a no-op.
  const changes = {
    ...(name.trim() !== project.name && { name: name.trim() }),
    ...(branch.trim() !== project.branch && { branch: branch.trim() }),
  };
  const valid = !!name.trim() && !!branch.trim();

  const submit = () =>
    update.mutate(changes, {
      onSuccess: (updated) => {
        onClose();
        showToast(
          changes.branch
            ? `Saved. Re-analyze to map the ${updated.branch} branch.`
            : `Project renamed to ${updated.name}.`,
        );
      },
    });

  return (
    <Modal title="Edit project" onClose={onClose}>
      <p>
        Tracking <span className="font-mono">{repoPath(project)}</span>. To track a different
        repository, import it as a new project.
      </p>
      <label className="text-xs">
        Project name
        <input
          type="text"
          maxLength={100}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            update.reset();
          }}
        />
      </label>
      <BranchField
        value={branch}
        onChange={(b) => {
          setBranch(b);
          update.reset();
        }}
        branches={branches}
      />
      {changes.branch && (
        <p className="text-[10px]">
          The current map stays until you run a new analysis on this branch.
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!valid || Object.keys(changes).length === 0 || update.isPending}
          onClick={submit}
        >
          {update.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}

export function DeleteProjectModal({
  project,
  onClose,
  onDeleted,
}: {
  project: Project;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { showToast } = useShell();
  const remove = useDeleteProject();
  const error = remove.error instanceof Error ? remove.error.message : "";
  const running = project.analysisStatus === "QUEUED" || project.analysisStatus === "RUNNING";

  const submit = () =>
    remove.mutate(project.projectId, {
      onSuccess: () => {
        onClose();
        onDeleted?.();
        showToast(`Project ${project.name} deleted.`);
      },
    });

  return (
    <Modal title="Delete project" onClose={onClose}>
      <p>
        Delete <strong className="text-foreground">{project.name}</strong>? Its architecture map,
        explore views, and insights are removed too. This can't be undone.
      </p>
      <p>The GitHub repository itself isn't affected.</p>
      {running && <p className="text-xs">The analysis in progress will be stopped.</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" disabled={remove.isPending} onClick={submit}>
          <Trash2 />
          {remove.isPending ? "Deleting..." : "Delete project"}
        </Button>
      </div>
    </Modal>
  );
}
