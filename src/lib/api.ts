import { fetchAuthSession } from "aws-amplify/auth";
import "@/lib/auth";

const API_URL = (import.meta.env["VITE_API_URL"] ?? "http://localhost:3000").replace(/\/$/, "");

export interface Project {
  projectId: string;
  name: string;
  repoUrl: string;
  branch: string;
  createdAt: string;
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
