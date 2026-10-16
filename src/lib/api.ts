import { fetchAuthSession } from "aws-amplify/auth";
import "@/lib/auth";

const API_URL = (import.meta.env["VITE_API_URL"] ?? "http://localhost:3000").replace(/\/$/, "");

export interface Project {
  projectId: string;
  name: string;
  repoUrl: string;
  branch: string;
  createdAt: string;
  analysisStatus: "NOT_STARTED" | Analysis["status"];
  // The step the latest analysis is on (or stopped at); null before the first run.
  analysisStep: AnalysisStep | null;
}

export interface CreateProjectInput {
  repoUrl: string;
  name?: string;
  branch?: string;
}

// Calls the backend with the signed-in user's Cognito access token.
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await fetchAuthSession()).tokens?.accessToken?.toString();
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new Error("Can't reach the Struct API. Check that the backend is running.");
  }

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    // Nest returns validation errors as a string array.
    const message = body?.message;
    throw new Error(
      (Array.isArray(message) ? message[0] : message) ?? `Request failed (${res.status})`,
    );
  }
  return body as T;
}

export function listProjects() {
  return apiFetch<Project[]>("/projects");
}

export function createProject(input: CreateProjectInput) {
  return apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(input) });
}

export const analysisSteps = ["clone", "detect", "map", "trace", "insights"] as const;
export type AnalysisStep = (typeof analysisSteps)[number];

export interface Analysis {
  analysisId: string;
  projectId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";
  step: AnalysisStep;
  startedAt: string;
  finishedAt?: string;
  commit?: string;
  stats?: { files: number; languages: Record<string, number> };
  error?: string;
  // Which explore views the run built; missing on runs from before views existed.
  views?: Partial<Record<ViewId, ViewStatus>>;
}

export async function getAnalysis(projectId: string) {
  const { analysis } = await apiFetch<{ analysis: Analysis | null }>(
    `/projects/${encodeURIComponent(projectId)}/analysis`,
  );
  return analysis;
}

export function startAnalysis(projectId: string) {
  return apiFetch<Analysis>(`/projects/${encodeURIComponent(projectId)}/analysis`, {
    method: "POST",
  });
}

export type ComponentType = "frontend" | "service" | "data" | "external";

// The architecture map saved by the latest completed analysis.
export interface ArchitectureGraph {
  projectId: string;
  analysisId: string;
  components: {
    id: string;
    name: string;
    type: ComponentType;
    tech: string;
    description: string;
    // Directories or files holding the component's code; empty for data stores and externals.
    paths: string[];
    // The file to open first; empty when the component has no code in the repository.
    entryPoint: string;
    files: number;
  }[];
  connections: { from: string; to: string; label: string }[];
  insights: {
    title: string;
    text: string;
    kind: "Architecture" | "Attention" | "Best practice";
    componentIds: string[];
  }[];
}

export type GraphComponent = ArchitectureGraph["components"][number];

export function getGraph(projectId: string) {
  return apiFetch<ArchitectureGraph>(`/projects/${encodeURIComponent(projectId)}/graph`);
}

export type ViewId =
  "screens" | "dependencies" | "calls" | "schema" | "api" | "infrastructure" | "ci-cd";
// NOT_APPLICABLE: the repository has nothing the view draws, e.g. no CI configuration.
export type ViewStatus = "COMPLETE" | "NOT_APPLICABLE" | "FAILED";

// An explore view built from files with a known structure, e.g. CI/CD workflows.
export interface ViewGraph {
  projectId: string;
  analysisId: string;
  view: ViewId;
  nodes: {
    id: string;
    name: string;
    kind: string;
    detail: string;
    // The band it is drawn in, e.g. its workflow.
    group: string;
    path?: string;
    componentId?: string;
    // Columns or attributes, for views of data such as the database schema.
    fields?: ViewField[];
  }[];
  edges: { from: string; to: string; label: string }[];
}

export type ViewNode = ViewGraph["nodes"][number];

export interface ViewField {
  name: string;
  type: string;
  key?: "primary" | "foreign" | "partition" | "sort" | "unique";
}

export function getView(projectId: string, view: ViewId) {
  return apiFetch<ViewGraph>(`/projects/${encodeURIComponent(projectId)}/views/${view}`);
}
