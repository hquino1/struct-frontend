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
- Fetch and create projects through the React Query hooks in `src/lib/projects.ts` so every page shares one cached list; they call the backend via `src/lib/api.ts` (base URL from `VITE_API_URL`, default `http://localhost:3000`). A project's latest analysis comes from `useAnalysis`, which polls while a run is queued or running; once it is `COMPLETE`, `useGraph` fetches the saved architecture graph (`GET /projects/:id/graph`), cached per analysis run.
- Lay out graphs in `src/lib/graph.ts` (pure, browser-safe: type lanes, wrapped columns, crossing reduction, edge routing) and draw them with `GraphCanvas` (pan, zoom, fit, minimap), so the layout works for any number of components. Explore views (`viewMeta` in `graph.ts`) come from `useView` (`GET /projects/:id/views/:view`) and are drawn with `layoutView` (columns per group when the meta lists `lanes`, otherwise a `layoutFlow` pipeline); the analysis's `views` field says whether each was built, didn't apply, or failed. all six explore views are built (Dependencies, Function calls, Database schema, API interactions, Cloud infrastructure, CI/CD workflows), and nodes with `fields` (schema tables) draw as taller cards listing them; views without `viewMeta` show a placeholder.
- Define the interface palette, typography, and graph styling in the global design system; use the shared Button for actions.
- Keep sidebar visibility in the `_app` layout's React state, with a collapse toggle inside the sidebar, a mobile-only header toggle (the only way back on mobile, where a closed sidebar is hidden; hidden on desktop), and an icon rail on desktop, so navigation can always be reopened.
- Projects belong directly to the signed-in user (no workspaces); each project is one public GitHub repository.
