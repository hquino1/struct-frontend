import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Check, GitBranch, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PopoverContent } from "@/components/ui/popover";
import type { RepositoryBranches } from "@/lib/api";

// The searchable branch list inside a branch popover, shared by the header chip and the project
// forms. When the list can't be trusted to be complete (GitHub returned too many branches, or
// couldn't list them), the search text is offered as a branch name; the backend checks it exists.
// With `allowDefault`, a "Default" item selects "" (the repository's default branch).
interface BranchMenuProps {
  value: string;
  onSelect: (branch: string) => void;
  branches: UseQueryResult<RepositoryBranches>;
  allowDefault?: boolean;
  pending?: boolean;
  error?: string | undefined;
}

export function BranchMenu(props: BranchMenuProps) {
  return (
    <PopoverContent
      align="start"
      className="w-(--radix-popover-trigger-width) min-w-64 p-0"
      // Escape closes the menu only, not a dialog it's open in.
      onEscapeKeyDown={(e) => e.stopPropagation()}
    >
      {/* Mounted only while open, so the search starts empty each time. */}
      <MenuBody {...props} />
    </PopoverContent>
  );
}

function MenuBody({
  value,
  onSelect,
  branches,
  allowDefault = false,
  pending = false,
  error,
}: BranchMenuProps) {
  const [search, setSearch] = useState("");
  const data = branches.data;
  const typed = search.trim();
  // Keep a saved branch that's no longer on GitHub selectable, so the list shows what's saved.
  const listed =
    data && value && !data.truncated && !data.branches.includes(value)
      ? [value, ...data.branches]
      : (data?.branches ?? []);
  const incomplete = !data || data.truncated || branches.isError;
  const offerTyped = !!typed && incomplete && !branches.isLoading && !listed.includes(typed);
  const note = pending
    ? "Saving..."
    : branches.error instanceof Error
      ? `Couldn't list branches: ${branches.error.message} Type a branch name.`
      : data?.truncated
        ? "Not every branch is listed. Type a name to use another branch."
        : "";

  return (
    <Command loop>
      <CommandInput
        placeholder="Find a branch..."
        value={search}
        onValueChange={setSearch}
        className="h-9 text-xs"
      />
      <CommandList>
        {branches.isLoading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            Loading branches...
          </div>
        ) : (
          <>
            {!offerTyped && (
              <CommandEmpty className="px-3 py-4 text-center text-xs text-muted-foreground">
                {data ? "No branch matches." : "Type a branch name."}
              </CommandEmpty>
            )}
            {(allowDefault || listed.length > 0) && (
              <CommandGroup>
                {allowDefault && (
                  <CommandItem
                    value={`default ${data?.defaultBranch ?? ""}`}
                    disabled={pending}
                    onSelect={() => onSelect("")}
                    className="text-xs"
                  >
                    <Check size={12} className={value === "" ? "opacity-100" : "opacity-0"} />
                    <span className="truncate">
                      Default
                      {data && <span className="font-mono"> ({data.defaultBranch})</span>}
                    </span>
                  </CommandItem>
                )}
                {listed.map((b) => (
                  <CommandItem
                    key={b}
                    value={b}
                    disabled={pending}
                    onSelect={() => onSelect(b)}
                    className="text-xs"
                  >
                    <Check size={12} className={b === value ? "opacity-100" : "opacity-0"} />
                    <span className="truncate font-mono">{b}</span>
                    {b === data?.defaultBranch && (
                      <span className="ml-auto text-[10px] text-muted-foreground">default</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {offerTyped && (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`use-typed:${typed}`}
                  disabled={pending}
                  onSelect={() => onSelect(typed)}
                  className="text-xs"
                >
                  <GitBranch size={12} />
                  <span className="truncate">
                    Use <span className="font-mono">{typed}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
      {(error || note) && (
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          {error ? (
            <span className="text-destructive" role="alert">
              {error}
            </span>
          ) : (
            note
          )}
        </div>
      )}
    </Command>
  );
}
