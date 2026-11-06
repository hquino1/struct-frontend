import type { UseQueryResult } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { BranchField } from "@/components/branch-field";
import type { RepositoryBranches } from "@/lib/api";

// cmdk and Radix use browser APIs jsdom doesn't have.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

// Only the fields BranchField and BranchMenu read.
const query = (
  state: Partial<UseQueryResult<RepositoryBranches>>,
): UseQueryResult<RepositoryBranches> =>
  ({
    data: undefined,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    fetchStatus: "idle",
    ...state,
  }) as UseQueryResult<RepositoryBranches>;

const listed = (branches: string[], truncated = false) =>
  query({ data: { defaultBranch: "main", branches, truncated } });

const openMenu = () => fireEvent.click(screen.getByRole("button"));
const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("Find a branch..."), { target: { value: text } });

describe("BranchField", () => {
  it("filters the listed branches and picks one", () => {
    const onChange = vi.fn();
    render(
      <BranchField
        value=""
        onChange={onChange}
        branches={listed(["main", "feature/map", "fix/login"])}
        allowDefault
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Default (main)");

    openMenu();
    search("map");
    expect(screen.queryByText("fix/login")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("feature/map"));
    expect(onChange).toHaveBeenCalledWith("feature/map");
  });

  it("only offers a typed name when the list is incomplete", () => {
    const { unmount } = render(
      <BranchField value="main" onChange={() => {}} branches={listed(["main"])} />,
    );
    openMenu();
    search("release/9");
    expect(screen.queryByText(/^Use/)).not.toBeInTheDocument();
    expect(screen.getByText("No branch matches.")).toBeInTheDocument();
    unmount();

    const onChange = vi.fn();
    render(<BranchField value="main" onChange={onChange} branches={listed(["main"], true)} />);
    openMenu();
    search("release/9");
    fireEvent.click(screen.getByText("release/9"));
    expect(onChange).toHaveBeenCalledWith("release/9");
  });

  it("takes a typed name when branches can't be listed", () => {
    const onChange = vi.fn();
    render(
      <BranchField
        value=""
        onChange={onChange}
        branches={query({ isError: true, error: new Error("Not Found.") })}
        allowDefault
      />,
    );
    openMenu();
    expect(screen.getByText(/Couldn't list branches: Not Found\./)).toBeInTheDocument();
    search("develop");
    fireEvent.click(screen.getByText("develop"));
    expect(onChange).toHaveBeenCalledWith("develop");
  });

  it("waits for a repository URL before opening", () => {
    render(
      <BranchField
        value=""
        onChange={() => {}}
        branches={query({ isPending: true })}
        allowDefault
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveTextContent("Enter the repository URL first");
  });
});
