# Design

How Sitez is built. What it promises is in [idea.md](idea.md); everything here can change
underneath without changing those promises.

## Toolchain

Sitez is an npm package built on [Vite+](https://vite-plus.dev). Vite+ is the toolchain; Sitez
is a Vite plugin plus the config nobody writes. Users never see a `vite.config.ts`.

```text
sitez (npm)
├── vite         Vite+'s core (@voidzero-dev/vite-plus-core): dev server, Rolldown
├── vite-plus    oxfmt, oxlint
├── svelte       compiler, server renderer, hydrate
├── svelte-check types
├── devalue      island props
└── markz        parser
```

Sitez calls `createServer` and `build` itself, with `configFile: false`. Svelte compiles with
`experimental.async` on.

A site needs no `package.json`. It gets one only when a pattern imports an npm library. A
resolver plugin resolves a bare import from the site first, then as if imported from inside
Sitez, so `svelte/transition` works from a folder with no `node_modules`. Vite's dependency
optimizer is off, because it resolves from the site root, where there are no packages. Svelte and
Sitez's other dependencies are ESM and need no pre-bundling.

## Dev server

A change to a page reloads that page. A change to CSS or an island is hot-replaced without a
reload. Server-rendered pages have no client state to keep, so a reload is the whole of HMR for
them.

## Build

Every page is rendered with Svelte's server renderer, after Markz parses its prose. The build
awaits everything a pattern computes before writing its HTML, using Svelte's async server
rendering: `await render(...)` resolves every `await` in the page and the components below it,
running independent ones in parallel, and reading the HTML without awaiting throws instead of
returning half a page. Pages render concurrently. If the build gets slow, the fix is a faster
build, not less HTML.

Each page is a virtual server entry that re-exports `render` from `svelte/server`, so the page
and the renderer share one copy of Svelte in the server bundle. A failed `await` rejects with the
original error, whose stack names the data module rather than the page, so the build wraps each
render and names the page file.

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
Svelte's runtime with `hydrate` is about 11 KB gzipped, the floor of `common.js` on a site with
any island; the component itself is a few hundred bytes. The build sets production mode itself:
`NODE_ENV` left at `development` by a dev server in the same process ships Svelte's dev code, 30%
larger.

## Islands

Sitez reads browser behavior from the compiler's AST (`parse(source, { modern: true })`). The
compiled output shows what a component does to its own elements, but not a handler passed to a
child, which rule 6 counts. A component has browser behavior if its template has an event
attribute with an expression value, a `bind:`, a transition or animation, a `use:` action or
`{@attach}`; if its script calls `$effect` or `onMount` (resolved through the imports from
`svelte`, so a renamed import counts); if it imports a `.svelte.js` or `.svelte.ts` module that
does; or if it passes an `on…` prop with an expression value to a child component. A string
value is data (`onboarding="yes"`), and Svelte already rejects string event handlers.

So the island is where the function lives, and no function has to cross into the browser. A
`Button` that spreads its props onto a `<button>` has no behavior of its own: used with data it
stays HTML, and the component that passes it `onclick` is the island. A handler inside a spread
to a component (`<Button {...props}>`) can't be seen statically, so the server build checks it:
a component that isn't an island and receives an `on…` function fails the build, naming the
component and the prop.

The island is the outermost component with browser behavior below a page or layout. In the
server build, Sitez renders it through a wrapper that writes the marker, the component, and its
children inside one `<sitez-children>` element:

```html
<sitez-island c="TagFilter" p="…devalue…">…server-rendered HTML…</sitez-island>
```

Props are serialized with `devalue`, which keeps dates, maps, sets and URLs typed and already
ships with Svelte. It throws on a function with the path to it (`.nested.fmt`), and Sitez turns
that into the build error that names the island and the prop.

The page's script finds each marker and calls `hydrate(Component, { target, props })`. Children
aren't in the JavaScript: they're already in the page, so the script passes back the
`<sitez-children>` element's own HTML through `createRawSnippet`, and hydration reuses the
existing nodes. Children from prose and from a pattern's markup hydrate the same way. Both
elements are `display: contents` in the baseline stylesheet, so neither affects layout.

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

- **Hydration comments.** Svelte's server output carries `<!--[-->` and `<!--]-->` markers on
  every page, not only in islands, where hydration needs them. Stripping them outside islands
  saves bytes; the build report will show whether it's worth doing.
