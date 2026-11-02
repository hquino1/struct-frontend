import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShell } from "@/hooks/use-shell";
import { useConnectGitHub, useGitHubConnection } from "@/lib/projects";

interface CallbackSearch {
  code?: string;
  state?: string;
  // "install" or "update" after the install page; "request" when an organization owner
  // still has to approve the installation.
  setup_action?: string;
}

// Keeps the non-empty string params GitHub sent and drops anything else.
const pick = (search: Record<string, unknown>, keys: (keyof CallbackSearch)[]): CallbackSearch =>
  Object.fromEntries(
    keys.flatMap((key) => {
      const value = search[key];
      return typeof value === "string" && value ? [[key, value]] : [];
    }),
  );

// The GitHub App's Callback URL: GitHub sends the user here after they install the app or
// approve signing in, and this page links their GitHub account through the API.
export const Route = createFileRoute("/_app/github/callback")({
  head: () => ({ meta: [{ title: "Connecting GitHub — Struct" }] }),
  validateSearch: (search: Record<string, unknown>) =>
    pick(search, ["code", "state", "setup_action"]),
  component: GitHubCallback,
});

function GitHubCallback() {
  const { code, state, setup_action } = Route.useSearch();
  const navigate = useNavigate();
  const { openImport } = useShell();
  const connect = useConnectGitHub();
  const { data: connection } = useGitHubConnection();
  const sent = useRef(false);

  useEffect(() => {
    // GitHub's code works once, so StrictMode's second effect run mustn't send it again.
    if (sent.current || !code || !state) return;
    sent.current = true;
    connect.mutate({ code, state });
  }, [code, state, connect]);

  const importRepository = () => {
    void navigate({ to: "/projects" });
    openImport();
  };

  const retry = connection?.authorizeUrl && (
    <Button size="sm" asChild>
      <a href={connection.authorizeUrl}>Try again</a>
    </Button>
  );

  let body;
  if (setup_action === "request") {
    body = (
      <>
        <h2>Installation requested</h2>
        <p>
          An owner of the organization needs to approve Struct on GitHub. Once they do, you can
          import its private repositories.
        </p>
      </>
    );
  } else if (!code || !state) {
    body = (
      <>
        <h2>GitHub didn't finish connecting</h2>
        <p>The link from GitHub is missing its sign-in details.</p>
        {retry}
      </>
    );
  } else if (connect.isError) {
    body = (
      <>
        <h2>Couldn't connect GitHub</h2>
        <p role="alert">{connect.error.message}</p>
        {retry}
      </>
    );
  } else if (connect.isSuccess) {
    body = (
      <>
        <h2>GitHub connected</h2>
        <p>
          Signed in as @{connect.data.login}. You can now import the private repositories you shared
          with Struct.
        </p>
        <Button size="sm" onClick={importRepository}>
          Import a repository
        </Button>
      </>
    );
  } else {
    body = <h2>Connecting your GitHub account...</h2>;
  }

  return (
    <main className="main-content">
      <section className="projects-empty" aria-live="polite">
        <Github size={28} className="text-primary" />
        {body}
      </section>
    </main>
  );
}
