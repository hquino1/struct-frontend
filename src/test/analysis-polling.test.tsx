import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Analysis, Project } from "@/lib/api";

// The hooks call the backend through these; the tests script what it returns.
vi.mock("@/lib/api", () => ({
  getAnalysis: vi.fn(),
  startAnalysis: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
}));
const api = await import("@/lib/api");
const { projectsQuery, useAnalysis, useStartAnalysis } = await import("@/lib/projects");
const getAnalysis = vi.mocked(api.getAnalysis);
const startAnalysis = vi.mocked(api.startAnalysis);

const run = (status: Analysis["status"], step: Analysis["step"]): Analysis => ({
  analysisId: "a1",
  projectId: "p1",
  status,
  step,
  startedAt: "2026-10-15T12:00:00.000Z",
});

const project: Project = {
  projectId: "p1",
  name: "shop",
  repoUrl: "https://github.com/acme/shop",
  branch: "main",
  createdAt: "2026-10-15T11:00:00.000Z",
  analysisStatus: "NOT_STARTED",
  analysisStep: null,
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(projectsQuery.queryKey, [project]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("analysis polling", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getAnalysis.mockReset();
    startAnalysis.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every 3 seconds while running and stops when complete", async () => {
    getAnalysis
      .mockResolvedValueOnce(run("RUNNING", "clone"))
      .mockResolvedValueOnce(run("RUNNING", "map"))
      .mockResolvedValueOnce(run("COMPLETE", "insights"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useAnalysis("p1"), { wrapper });

    await waitFor(() => expect(result.current.data?.step).toBe("clone"));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await waitFor(() => expect(result.current.data?.step).toBe("map"));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await waitFor(() => expect(result.current.data?.status).toBe("COMPLETE"));

    // Finished: no more requests however long the page stays open.
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(getAnalysis).toHaveBeenCalledTimes(3);
  });

  it("does not poll a project that was never analyzed", async () => {
    getAnalysis.mockResolvedValue(null);
    const { wrapper } = setup();
    const { result } = renderHook(() => useAnalysis("p1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(getAnalysis).toHaveBeenCalledTimes(1);
  });

  it("starts polling as soon as an analysis is started", async () => {
    getAnalysis.mockResolvedValueOnce(null).mockResolvedValueOnce(run("RUNNING", "detect"));
    startAnalysis.mockResolvedValue(run("QUEUED", "clone"));
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({ analysis: useAnalysis("p1"), start: useStartAnalysis("p1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.analysis.isSuccess).toBe(true));

    await act(() => result.current.start.mutateAsync());
    await waitFor(() => expect(result.current.analysis.data?.status).toBe("QUEUED"));

    await act(() => vi.advanceTimersByTimeAsync(3000));
    await waitFor(() => expect(result.current.analysis.data?.step).toBe("detect"));
    expect(getAnalysis).toHaveBeenCalledTimes(2);
  });

  it("keeps the cached project list's status and step in sync", async () => {
    getAnalysis.mockResolvedValue(run("RUNNING", "trace"));
    const { queryClient, wrapper } = setup();
    renderHook(() => useAnalysis("p1"), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryData<Project[]>(projectsQuery.queryKey)?.[0]).toMatchObject({
        analysisStatus: "RUNNING",
        analysisStep: "trace",
      }),
    );
  });
});
