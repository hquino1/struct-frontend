import { useState } from "react";
import { ChevronDown, GitBranch, Sparkles } from "lucide-react";
import { BranchMenu } from "@/components/branch-menu";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { useShell } from "@/hooks/use-shell";
import type { Project } from "@/lib/api";
import { useProjectBranches, useUpdateProject } from "@/lib/projects";

// The branch chip in a project's repo bar. Opens a searchable list of the repository's branches
// and switches the branch the next analysis reads.
//
// `onAnalyze` is given when the page shows a map from an earlier run: after a switch, the chip
// offers to re-analyze, since the map still shows the old branch until then.
export function BranchSwitcher({
  project,
  disabled = false,
  onAnalyze,
}: {
  project: Project;
  disabled?: boolean;
  onAnalyze?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // The branch the current map was drawn from, once the user switches away from it.
  const [mappedBranch, setMappedBranch] = useState<string>();
  const { showToast } = useShell();
  const update = useUpdateProject(project.projectId);
  // Fetched only once the menu has been opened.
  const branches = useProjectBranches(project.projectId, open);

  const choose = (branch: string) => {
    if (branch === project.branch) {
      setOpen(false);
      return;
    }
    const previous = project.branch;
    update.mutate(
      { branch },
      {
        onSuccess: (updated) => {
          setOpen(false);
          if (onAnalyze) {
            // Switching back to the mapped branch clears the hint.
            setMappedBranch((mapped) => {
              const from = mapped ?? previous;
              return from === updated.branch ? undefined : from;
            });
            showToast(`Now tracking ${updated.branch}. Re-analyze to map it.`);
          } else {
            showToast(`Now tracking ${updated.branch}.`);
          }
        },
      },
    );
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) update.reset();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="branch branch-trigger"
            disabled={disabled}
            title={
              disabled ? "Wait for the analysis to finish to switch branches" : "Switch branch"
            }
            aria-label={`Branch: ${project.branch}. Switch branch`}
          >
            <GitBranch size={11} />
            {project.branch}
            <ChevronDown size={10} />
          </button>
        </PopoverTrigger>
        <BranchMenu
          value={project.branch}
          branches={branches}
          onSelect={choose}
          pending={update.isPending}
          error={update.error instanceof Error ? update.error.message : undefined}
        />
      </Popover>
      {onAnalyze && mappedBranch && (
        <button type="button" className="branch-stale" onClick={onAnalyze}>
          Map shows <span className="font-mono">{mappedBranch}</span>
          <span aria-hidden>·</span>
          <Sparkles size={10} />
          Re-analyze
        </button>
      )}
    </>
  );
}
