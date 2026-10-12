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
- Keep the prototype workspace at the index route and use local React state for its sample-only interactions; no repository analysis or persistence is connected.
- Keep sample graph definitions in a browser-safe data module, separate from the workspace, so all visualization views share component identities and relationships.
- Define the interface palette, typography, and graph styling in the global design system; use the shared Button for actions.
