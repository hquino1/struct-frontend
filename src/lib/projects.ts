import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  connectGitHub,
  createProject,
  deleteProject,
  getAnalysis,
  getDocs,
  getGitHubConnection,
  getGraph,
  getRepoFiles,
  getView,
  listProjectBranches,
  listProjects,
  listRepositoryBranches,
  startAnalysis,
  updateDocs,
  updateProject,
  type Analysis,
  type CreateProjectInput,
  type DocsMode,
  type DocsState,
  type GitHubConnection,
  type Project,
  type UpdateProjectInput,
  type ViewId,
} from "@/lib/api";

// Shared by every page so the sidebar, the projects page, and the workspace read one cached list.
export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: listProjects,
  staleTime: 30_000,
});

export function useProjects() {
  return useQuery(projectsQuery);
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (list = []) => [
        created,
        ...list,
      ]);
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(projectId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (list) =>
        list?.map((p) => (p.projectId === projectId ? updated : p)),
      );
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: (_, projectId) => {
      queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (list) =>
        list?.filter((p) => p.projectId !== projectId),
      );
      // Stops analysis polling and drops the project's cached graph and views.
      for (const key of ["analysis", "graph", "view", "branches", "docs", "files"]) {
        queryClient.removeQueries({ queryKey: [key, projectId] });
      }
      if (getLastProjectId() === projectId) clearLastProjectId();
    },
  });
}

export const githubConnectionQuery = queryOptions({
  queryKey: ["github"],
  queryFn: getGitHubConnection,
  // The links it returns carry a signed state that expires after an hour.
  staleTime: 10 * 60_000,
});

export function useGitHubConnection() {
  return useQuery(githubConnectionQuery);
}

export function useConnectGitHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectGitHub,
    onSuccess: (connection) => {
      queryClient.setQueryData<GitHubConnection>(githubConnectionQuery.queryKey, connection);
    },
  });
}

// The same check the backend makes, so the import form only asks GitHub about a full URL.
const GITHUB_REPO_URL = /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+?(?:\.git)?\/?$/;

// Not retried: a failure is usually a missing or unreadable repository, which won't change.
// `enabled` lets the branch menu wait until it's opened.
export function useProjectBranches(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["branches", projectId],
    queryFn: () => listProjectBranches(projectId),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

// Waits for typing to pause, so each keystroke of the repository name isn't a GitHub lookup.
export function useRepositoryBranches(repoUrl: string) {
  const [settled, setSettled] = useState(repoUrl);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(repoUrl), 400);
    return () => clearTimeout(timer);
  }, [repoUrl]);
  return useQuery({
    queryKey: ["github-branches", settled],
    queryFn: () => listRepositoryBranches(settled),
    enabled: settled === repoUrl && GITHUB_REPO_URL.test(settled),
    staleTime: 60_000,
    retry: false,
  });
}

export const repoPath = (project: Project) => project.repoUrl.replace("https://github.com/", "");

// Remembered so `/` can reopen the project the user was last looking at.
const LAST_PROJECT_KEY = "struct-last-project";

export function getLastProjectId() {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setLastProjectId(projectId: string) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch {
    // Storage can be blocked; `/` then falls back to the newest project.
  }
}

function clearLastProjectId() {
  try {
    localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

export const isAnalysisActive = (analysis: Analysis | null | undefined) =>
  analysis?.status === "QUEUED" || analysis?.status === "RUNNING";

const analysisQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["analysis", projectId],
    queryFn: () => getAnalysis(projectId),
    // Poll while the worker runs so the progress steps advance on their own.
    refetchInterval: (query) => (isAnalysisActive(query.state.data) ? 3000 : false),
  });

export function useAnalysis(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const result = useQuery({ ...analysisQuery(projectId ?? ""), enabled: !!projectId });
  const analysis = result.data;
  // Mirror each poll onto the cached project list, so its status and step stay current
  // without refetching every project.
  useEffect(() => {
    if (!projectId || analysis === undefined) return;
    queryClient.setQueryData<Project[]>(projectsQuery.queryKey, (list) =>
      list?.map((p) =>
        p.projectId === projectId
          ? {
              ...p,
              analysisStatus: analysis?.status ?? "NOT_STARTED",
              analysisStep: analysis?.step ?? null,
            }
          : p,
      ),
    );
  }, [analysis, projectId, queryClient]);
  return result;
}

export function useStartAnalysis(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startAnalysis(projectId),
    onSuccess: (analysis) => {
      queryClient.setQueryData(analysisQuery(projectId).queryKey, analysis);
    },
  });
}

// Keyed by run so a re-analysis fetches the new graph; a saved graph never changes.
export function useGraph(analysis: Analysis | null | undefined) {
  return useQuery({
    queryKey: ["graph", analysis?.projectId, analysis?.analysisId],
    queryFn: () => getGraph(analysis!.projectId),
    enabled: analysis?.status === "COMPLETE",
    staleTime: Infinity,
  });
}

// One explore view, fetched only when the run built it and the user opens it.
export function useView(analysis: Analysis | null | undefined, view: ViewId | undefined) {
  return useQuery({
    queryKey: ["view", analysis?.projectId, analysis?.analysisId, view],
    queryFn: () => getView(analysis!.projectId, view!),
    enabled: analysis?.status === "COMPLETE" && !!view && analysis.views?.[view] === "COMPLETE",
    staleTime: Infinity,
  });
}

export const isDocsActive = (docs: DocsState | undefined) =>
  docs?.status === "QUEUED" || docs?.status === "RUNNING";

// How long after an analysis finishes to keep checking for the docs run it starts.
const DOCS_START_WINDOW_MS = 2 * 60_000;

// Polls while docs are being written, and just after an analysis completes, whose docs run
// starts a moment later.
export function useDocs(analysis: Analysis | null | undefined) {
  const projectId = analysis?.projectId;
  return useQuery({
    queryKey: ["docs", projectId],
    queryFn: () => getDocs(projectId!),
    enabled: analysis?.status === "COMPLETE",
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (isDocsActive(docs)) return 3000;
      const finished = Date.parse(analysis?.finishedAt ?? "");
      const awaitingRun =
        !!analysis?.commit &&
        docs?.commit !== analysis.commit &&
        Date.now() - finished < DOCS_START_WINDOW_MS;
      return awaitingRun ? 3000 : false;
    },
  });
}

// The picker's file list; fetched only once it is opened.
export function useRepoFiles(analysis: Analysis | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["files", analysis?.projectId, analysis?.analysisId],
    queryFn: () => getRepoFiles(analysis!.projectId),
    enabled: enabled && analysis?.status === "COMPLETE",
    staleTime: Infinity,
  });
}

export function useUpdateDocs(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { mode: DocsMode; paths?: string[] }) => updateDocs(projectId, input),
    onSuccess: (docs) => {
      queryClient.setQueryData(["docs", projectId], docs);
    },
  });
}
