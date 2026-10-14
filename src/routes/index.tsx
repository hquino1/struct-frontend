import { createFileRoute, redirect } from "@tanstack/react-router";
import { getLastProjectId, projectsQuery } from "@/lib/projects";

// `/` reopens the last project the user viewed, or their newest one, or the projects page.
export const Route = createFileRoute("/")({
  // Cognito tokens live in browser storage, so this has to run on the client.
  ssr: false,
  beforeLoad: async ({ context }) => {
    // A signed-out user fails here too; `/projects` then sends them to the login page.
    const projects = await context.queryClient.ensureQueryData(projectsQuery).catch(() => []);
    const lastId = getLastProjectId();
    const target = projects.find((p) => p.projectId === lastId) ?? projects[0];
    if (target) {
      throw redirect({ to: "/projects/$projectId", params: { projectId: target.projectId } });
    }
    throw redirect({ to: "/projects" });
  },
});
