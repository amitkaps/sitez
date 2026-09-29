# Vite+ without a config

**Answer: it works.** `run.ts` copies the landing site (plus a `Counter` island) to a temp folder
with no `package.json`, `node_modules` or `vite.config.ts`, then runs Vite's dev server and both
builds from code, with `configFile: false`.

- **Dev:** `createServer` with `appType: 'custom'` and a middleware that `ssrLoadModule`s the page
  and renders it. `GET /` returns the page, island included.
- **Server build:** `build({ build: { ssr: true } })` from a virtual entry per page, with
  `ssr.noExternal: true`. The entry re-exports `render` from `svelte/server`, so the page and the
  renderer share the bundle's one copy of Svelte: rendering a bundled component with Sitez's own
  `svelte/server` would load a second copy. The bundle has no bare imports (72 KB for the landing
  page), so Node runs it from anywhere. Vite names SSR output `.mjs`.
- **Client build:** an ordinary build of a generated entry, with a manifest mapping entries to
  hashed files. One island with Svelte's runtime and `hydrate` is 38 KB, **15 KB gzipped**: that is
  the floor of `common.js` on any site with an island.

What the site's missing `node_modules` needs:

- **A resolver plugin.** Bare imports from the site's files (`svelte`, `svelte/transition`)
  resolve from the site first, so a site with its own `package.json` still gets its libraries,
  then as if imported from inside Sitez.
- **No dependency optimizer.** It resolves from the site root, where there are no packages, and
  vite-plugin-svelte adds `svelte/*` to its list in a config hook. Sitez clears the list in
  `configResolved`. Svelte and its dependencies are ESM, so nothing needs pre-bundling.
- **A real path for `root`.** On macOS `tmpdir()` is a symlink (`/var` → `/private/var`), and a
  root that isn't its real path puts `outDir` "outside the project" and skips emptying it. Sitez
  passes `realpath(root)`.
- `vite` is `@voidzero-dev/vite-plus-core` (as the `vite-plus` package depends on it), so Sitez
  imports `createServer` and `build` from `vite`, and `vite-plus` stays a dev tool of this repo.
