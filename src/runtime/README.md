# runtime

What a site's own code loads: the `sitez` import, and Sitez's files its build takes in through
Vite. Nothing here imports the rest of Sitez, so the folder can become a package of its own if
something besides Sitez wants it ([design.md](../../docs/design.md#the-runtime)).

The `sitez` import comes in two halves, which the package builds with their types
(`dist/runtime/`).

- `index.ts` is `sitez` at build time, and `browser.ts` is `sitez` in an island.
- `html.ts` is the template value that `html` makes at build time.
- `render.ts` turns a template value into HTML. The build imports it, and a site never does.

The other files are copied into the package as they are.

- `reset.css` is the quiet, readable look every site's stylesheet begins with, for the site to
  override.
- `oxfmtrc.json` is the style `sitez check` formats a site's files in. That's oxfmt's defaults,
  with Svelte formatting turned on.
- `server.ts`, `client.ts` and the `.svelte` files are Sitez 0.1's islands. `server.ts` decides
  in the server render whether a component is an island, and the `.svelte` files write the marker
  around one. `client.ts` hydrates them. They go with Svelte (plan step 15).
