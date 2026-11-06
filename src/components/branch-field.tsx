import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, GitBranch } from "lucide-react";
import { BranchMenu } from "@/components/branch-menu";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import type { RepositoryBranches } from "@/lib/api";

// Picks the branch a project tracks, in the import and edit forms: a searchable list of the
// repository's branches, which also takes a typed name when GitHub can't list them all.
// With `allowDefault`, "" stands for the repository's default branch.
export function BranchField({
  value,
  onChange,
  branches,
  allowDefault = false,
}: {
  value: string;
  onChange: (branch: string) => void;
  branches: UseQueryResult<RepositoryBranches>;
  allowDefault?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The import form doesn't look branches up until it has a full repository URL.
  const waiting = branches.isPending && branches.fetchStatus === "idle";
  const defaultBranch = branches.data?.defaultBranch;

  return (
    <label className="text-xs">
      Branch {allowDefault && <span className="text-muted-foreground">(optional)</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="branch-select" disabled={waiting}>
            <GitBranch size={13} className="text-muted-foreground" />
            <span className={`truncate ${value ? "font-mono" : "text-muted-foreground"}`}>
              {waiting
                ? "Enter the repository URL first"
                : value ||
                  (allowDefault
                    ? `Default${defaultBranch ? ` (${defaultBranch})` : ""}`
                    : "Pick a branch")}
            </span>
            <ChevronDown size={13} className="ml-auto text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <BranchMenu
          value={value}
          branches={branches}
          allowDefault={allowDefault}
          onSelect={(b) => {
            onChange(b);
            setOpen(false);
          }}
        />
      </Popover>
    </label>
  );
}
