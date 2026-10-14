<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Signed-in pages render inside the pathless `_app` layout route (sidebar, top bar, shared modals, auth check). `/projects` lists projects; `/projects/$projectId` is the workspace, with its view and tab in search params; `/` redirects to the last-viewed project, else the newest, else `/projects`.
- Fetch and create projects through the React Query hooks in `src/lib/projects.ts` so every page shares one cached list; they call the backend via `src/lib/api.ts` (base URL from `VITE_API_URL`, default `http://localhost:3000`). Workspace graph interactions stay sample-only local state; repository analysis is not connected.
- Keep sample graph definitions in a browser-safe data module, separate from the workspace, so all visualization views share component identities and relationships.
- Define the interface palette, typography, and graph styling in the global design system; use the shared Button for actions.
- Keep sidebar visibility in the `_app` layout's React state, with a collapse toggle inside the sidebar, a mobile-only header toggle (the only way back on mobile, where a closed sidebar is hidden; hidden on desktop), and an icon rail on desktop, so navigation can always be reopened.
- Projects belong directly to the signed-in user (no workspaces); each project is one public GitHub repository.
