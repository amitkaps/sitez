# runtime

Sitez's own files that a site's build loads through Vite, as if they were the site's: they are
copied into the package as they are (`dist/runtime/`), not bundled into the CLI.

- `reset.css` is the quiet, readable look every site's stylesheet begins with, for the site to
  override.
- `server.ts` renders every imported component in the server render, and decides whether it is
  an island there; `Island.svelte`, `IslandWithChildren.svelte` and `Children.svelte` write the
  marker around one.
- `client.ts` hydrates a page's islands in the browser.
- `oxfmtrc.json` is the style `sitez check` formats a site's files in: oxfmt's defaults, with
  Svelte formatting turned on.
