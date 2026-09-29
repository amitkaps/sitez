# Design

How Sitez is built. What it promises is in [idea.md](idea.md); everything here can change
underneath without changing those promises.

## Toolchain

Sitez is an npm package built on [Vite+](https://vite-plus.dev). Vite+ is the toolchain; Sitez
is a Vite plugin plus the config nobody writes. Users never see a `vite.config.ts`.

```text
sitez (npm)
├── vite-plus    dev server, bundling, oxfmt, oxlint
├── svelte       compiler and server renderer
├── svelte-check types
└── markz        parser
```

A site needs no `package.json`. It gets one only when a pattern imports an npm library.

## Dev server

A change to a page reloads that page. A change to CSS or an island is hot-replaced without a
reload. Server-rendered pages have no client state to keep, so a reload is the whole of HMR for
them.

## Build

Every page is rendered with Svelte's server renderer, after Markz parses its prose. The build
awaits everything a pattern computes before writing its HTML, using Svelte's async server
rendering. If the build gets slow, the fix is a faster build, not less HTML.

Links are rewritten from the AST, not the HTML, so examples in code blocks are left alone. A
relative link to a `.md` file becomes that page's URL; one to any other file in the repo becomes
`{repo}/blob/main/{path}`, when `site.md` has a `repo`. A link to a page Sitez didn't build, or to
a file that isn't there, fails with its source position.

## Bundling

Rolldown splits each page's CSS and JavaScript by one rule: what more than one page uses goes in
`common.css` and `common.js`; what only this page uses goes in the page's own `index.css` and
`index.js`, next to its `index.html`. The baseline stylesheet, the Svelte runtime and an island in
the layout are common; `TagFilter` on `/blog/` is the page's.

File names carry a content hash (`common.3f9a1c.js`), so a new deploy is never served from a
stale cache. A page with no islands loads no JavaScript, common or its own. An island used on a
few pages still lands in `common.js`; the `common` row in the build report shows if that grows.

## Islands

Sitez reads browser behavior from the compiled component, where the Svelte compiler has already
resolved it. A component has it if its template has an event attribute, a `bind:`, a transition
or animation, or `{@attach}`; if its script has `$effect` or `onMount`; or if it passes an `on…`
prop to a child. That last one catches handlers that arrive through a spread (`{...rest}`) by
following Svelte 5's naming for event props, and it puts the island where the function lives,
so no function has to cross into the browser.

The island is the outermost component with browser behavior below a page or layout. Its HTML
comes from the build, wrapped in a marker:

```html
<sitez-island c="TagFilter" p='…devalue…'>…server-rendered HTML…</sitez-island>
```

The page's script finds each marker and calls `hydrate(Component, { target, props })`. Props are
serialized with `devalue`, which Svelte already depends on. Children are rendered once at build
time and passed back in with `createRawSnippet`, which takes the HTML of one element, so Sitez
wraps them in one.

A component that forwards `onclick` to a `<button>` counts as interactive wherever it's used,
even without a handler. Static navigation should be `<a>`, so that's accepted rather than worked
around.

## Check

`sitez check` runs oxfmt and oxlint over `prose/` and `pattern/`, `svelte-check` for types, and
reports Markz's warnings. oxfmt formats `.svelte` files, and it is the formatter whose output is
Markz's canonical form, so one tool formats both folders.

## Install

`npm i -g sitez`, or `npx sitez dev` without installing. For someone without Node,
`mise use -g npm:sitez` installs Node and Sitez together: the one-command install a binary would
give, without building or signing one.

A single binary stays possible later. Vite+ ships native code (Rolldown, the Oxc tools), which
rules out Node's single executable applications; `bun build --compile` is the likely route.

## Deploy

`sitez deploy` pushes `dist/` to the `gh-pages` branch with the user's own git, when the remote
is on GitHub. Cloudflare builds from its own git integration with `npx sitez build`, so Sitez
carries no Wrangler.

## Why not SvelteKit, Astro or Ogygia

- **SvelteKit** has server rendering, build-time data (`load` with `prerender`) and a Vite dev
  server. It also has what Sitez leaves out: a client router, `+page`/`+layout`/`+server` files,
  endpoints, form actions, hooks, adapters and a server runtime. It hydrates a whole page or none
  of it, and it has no convention for prose: the Markz site writes `pages.ts`, `SOURCES`,
  `[slug]` and `entries` to get what rule 1 gives.
- **Astro** is the nearest tool: content pages, islands, no JavaScript by default, View
  Transitions. Its pages are `.astro`, not Svelte, and its content is Markdown or MDX configured
  through content collections.
- **[Ogygia](https://ogygia.puruvj.dev)** adds islands to SvelteKit, and Sitez's islands follow
  it: rendered on the server, then hydrated, with props through `devalue`. Ogygia marks islands at
  the import and takes no children; Sitez reads islands from the code and hands them static
  children. Ogygia is also what SvelteKit plus islands becomes without a limit: server islands,
  remote functions, content collections with schemas, a docs shell, versions and locales, an SPA
  router, and a Vite config, server hooks and an `ORIGIN` variable to adopt it. It needs
  SvelteKit 2 and is at 0.7.

## Open questions

- **Waiting at build time.** Rule 5 lets a pattern `await`, as the Quality page's `quality()`
  does. Svelte's async server rendering, still experimental, is how a component waits during the
  build. The rule is settled; a spike proves the mechanism holds.
