import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  createProject,
  getAnalysis,
  getGraph,
  listProjects,
  startAnalysis,
  type Analysis,
  type CreateProjectInput,
  type Project,
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
