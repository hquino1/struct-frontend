import { fetchAuthSession } from "aws-amplify/auth";
import "@/lib/auth";

const API_URL = (import.meta.env["VITE_API_URL"] ?? "http://localhost:3000/api").replace(/\/$/, "");

export interface Project {
  projectId: string;
  name: string;
  repoUrl: string;
  branch: string;
  createdAt: string;
  // Read through the Struct GitHub App rather than anonymously.
  private: boolean;
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

// The repository can't change; a new branch takes effect on the next analysis.
export interface UpdateProjectInput {
  name?: string;
  branch?: string;
}

export function updateProject(projectId: string, input: UpdateProjectInput) {
  return apiFetch<Project>(`/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface RepositoryBranches {
  defaultBranch: string;
  // In GitHub's order (alphabetical).
  branches: string[];
  // The repository may have more branches than Struct lists.
  truncated: boolean;
}

// The branches a project could switch to.
export function listProjectBranches(projectId: string) {
  return apiFetch<RepositoryBranches>(`/projects/${encodeURIComponent(projectId)}/branches`);
}

// The branches of a repository that isn't a project yet, for the import form.
export function listRepositoryBranches(repoUrl: string) {
  return apiFetch<RepositoryBranches>(`/github/branches?repoUrl=${encodeURIComponent(repoUrl)}`);
}

// Also deletes the project's saved graph and views.
export async function deleteProject(projectId: string) {
  await apiFetch<void>(`/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}

export interface GitHubConnection {
  // False when the backend has no GitHub App configured; only public repositories work then.
  enabled: boolean;
  login: string | null;
  // GitHub's page for choosing which repositories Struct can read.
  installUrl: string | null;
  // Connects the account without changing which repositories Struct can read.
  authorizeUrl: string | null;
}

export function getGitHubConnection() {
  return apiFetch<GitHubConnection>("/github/connection");
}

// Finishes GitHub's redirect to /github/callback.
export function connectGitHub(input: { code: string; state: string }) {
  return apiFetch<GitHubConnection>("/github/connection", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  // Answers to the questions a newcomer asks first; missing on runs from before the FAQ.
  faq?: FaqEntry[];
}

export type FaqTopic =
  | "overview"
  | "connections"
  | "endpoints"
  | "data"
  | "deployment"
  | "risks"
  | "onboarding"
  | "other";

export interface FaqEntry {
  question: string;
  // Plain text; lines starting with "- " are list items.
  answer: string;
  topic: FaqTopic;
  componentIds: string[];
  // Repository paths the answer points to; directories end in "/".
  paths: string[];
}

export type GraphComponent = ArchitectureGraph["components"][number];

// Most files one project can have documented.
export const MAX_DOC_FILES = 25;

export type DocsMode = "auto" | "manual";
export type DocsStatus = "NOT_STARTED" | "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";

export type KeyPartKind =
  "function" | "class" | "component" | "hook" | "route" | "type" | "constant" | "config" | "other";

// Generated documentation for one repository file.
export interface FileDoc {
  path: string;
  // The commit the doc describes, for source links.
  commit: string;
  componentId?: string;
  summary: string;
  purpose: string;
  keyParts: { name: string; kind: KeyPartKind; description: string; line?: number }[];
  notes: string[];
  // Files that import this one, and the ones it imports.
  usedBy: string[];
  dependsOn: string[];
  // HTTP routes it serves, e.g. "GET /projects".
  endpoints: string[];
  // The file was longer than what was read to document it.
  truncated: boolean;
  generatedAt: string;
}

export interface DocsState {
  // "auto" documents the suggested files on every analysis; "manual" the user's pick.
  mode: DocsMode;
  selection: string[];
  status: DocsStatus;
  total?: number;
  done?: number;
  // The commit the latest docs run documents.
  commit?: string;
  finishedAt?: string;
  // Files that couldn't be documented in the latest run.
  failed: string[];
  error?: string;
  docs: FileDoc[];
}

export interface DocSuggestion {
  path: string;
  // Why it was picked, e.g. "Entry point of API · Imported by 12 files".
  reason: string;
}

// Every documentable file of the latest analysis, for the file picker.
export interface RepoFiles {
  commit: string;
  paths: string[];
  suggestions: DocSuggestion[];
}

export function getDocs(projectId: string) {
  return apiFetch<DocsState>(`/projects/${encodeURIComponent(projectId)}/docs`);
}

export function getRepoFiles(projectId: string) {
  return apiFetch<RepoFiles>(`/projects/${encodeURIComponent(projectId)}/files`);
}

// Saves which files to document and starts writing their docs.
export function updateDocs(projectId: string, input: { mode: DocsMode; paths?: string[] }) {
  return apiFetch<DocsState>(`/projects/${encodeURIComponent(projectId)}/docs`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

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
