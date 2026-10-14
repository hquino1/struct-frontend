import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, listProjects, type CreateProjectInput, type Project } from "@/lib/api";

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
