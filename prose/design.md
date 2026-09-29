# Design

How Sitez is built. What it promises is in [idea.md](idea.md); everything here can change
underneath without changing those promises.

## Toolchain

Sitez is an npm package built on [Vite+](https://vite-plus.dev). Vite+ is the toolchain; Sitez
is a Vite plugin plus the config nobody writes. Users never see a `vite.config.ts`.

```text
sitez (npm)
├── vite             Vite+'s core (@voidzero-dev/vite-plus-core): dev server, Rolldown
├── vite-plus        oxfmt, oxlint
├── svelte           compiler, server renderer, hydrate
├── svelte-check     types
├── devalue          island props
└── @amitkaps/markz  parser
```

Sitez calls `createServer` and `build` itself, with `configFile: false`. Svelte compiles with
`experimental.async` on.

A site needs no `package.json`. It gets one only when a pattern imports an npm library. A
resolver plugin resolves a bare import from the site first, then as if imported from inside
Sitez, so `svelte/transition` works from a folder with no `node_modules`. Vite's dependency
optimizer is off, because it resolves from the site root, where there are no packages. Svelte and
Sitez's other dependencies are ESM and need no pre-bundling.

## Dev server

`sitez dev` is the same Vite server `build` renders through, listening and watching (`dev.ts`).
It renders a page when it's asked for, with the code `build` uses (`site.ts`), so the two can't
disagree; drafts are pages like any other. The site is read again for every page, which is what
makes a new or deleted file a new or missing URL without a restart.

A page's script in dev is a module that imports the stylesheet as modules (the reset,
`pattern/style.css`, and each component's style module, never the component itself, which may
import what only runs on the server) and then hydrates the page's islands. So a change to CSS or
an island is hot-replaced by Vite and Svelte. Anything else can change any page's HTML, even
whether a link on another page is broken, so the server's modules are all invalidated, and so
are the pages' scripts, since a page may now use a different island, and the page reloads: server-rendered pages have no client state to keep, so a reload is the whole of
HMR for them. A failure renders as a page holding `build`'s message, with Vite's client on it,
so fixing the file reloads it.

Vite's dependency optimizer doesn't run, and its cache lives in the system's temp folder, so
`dev` writes nothing into the site.

## Build

Every page is rendered with Svelte's server renderer, after Markz parses its prose. The build
awaits everything a pattern computes before writing its HTML, using Svelte's async server
rendering: `await render(...)` resolves every `await` in the page and the components below it,
running independent ones in parallel, and reading the HTML without awaiting throws instead of
returning half a page. Pages render concurrently. If the build gets slow, the fix is a faster
build, not less HTML.

Pages render through Vite's module runner, in `build` as in `dev`, not from a bundle. A pattern's
modules run from where they are, so `import.meta.url` still points at them (the Markz site's
Quality page reads its test cases relative to its own file), and `dev` and `build` can't render a
page differently. Svelte comes through the same runner, so the page, its layout and the renderer
share one copy of it. A failed `await` rejects with the original error, whose stack names the data
module rather than the page, so the build wraps each render and names the page file.

A prose page reaches Svelte as a component: Markz's HTML with its braces escaped, compiled by
Sitez's own Vite plugin for `.md` files in `prose/`. Svelte does for prose what it does for a
pattern, with no second renderer, and Markz needs no options. An element with a component of its
name, found up the tree as a layout is, has its tags renamed (`<call-out>` to `<CallOut>`) and
the component imported, so its attributes arrive as string props and its content as `children`,
alongside the page's `page`, `prose` and `site` (rule 5); an attribute of one of those names fails.
A raw `=html` block is written through `{@html}`, never read as Svelte: `html()` renders a view
of the document in which each raw block is a marker, so the only tags in its output are Markz's
own, and renaming one is exact. Markz's warnings are printed by `build` and never fail it.

A page renders before its layout, because a Svelte page's title can come from its own `<h1>` and
the layout needs the title. The layout then renders with a placeholder element as its children,
and the page's HTML replaces it; a layout that doesn't render its children, or renders them
twice, fails the build. Only the nearest layout wraps a page: `pattern/blog/Layout.svelte` that
wants the site's header imports `../Layout.svelte` and puts itself inside it.

Links are rewritten from the AST, not the HTML, so examples in code blocks are left alone: the
view `html()` renders has each link's destination swapped for its URL, as it has raw blocks
swapped for markers. A relative link to a `.md` in `prose/` becomes that page's URL, one to a file
in `public/` its path, and one to any other file in the repo `{repo}/blob/main/{path}` (`tree`
for a folder), with the path from the git root, which may be above the site's. A site link
(`/about`) is looked up among the pages, then in `public/`. A link to a draft, to the 404 page,
or to anything that isn't there fails with its line. The check needs every page's draft status
before any prose loads, so `build` loads the Svelte pages' modules for their `metadata` first.
Then each rendered page's `href` and `src` attributes are checked against the same pages,
`public/` and Sitez's own files, which catches what patterns and raw blocks write. A site link
there has to be exact (`/blog/`), since the HTML is finished and nothing rewrites it. Only start
tags are read, so HTML shown as text, whose `<` is escaped, and code inside `<script>` aren't
taken for links.

The head is written from metadata (`head.ts`): `<title>`, the description, the canonical URL and
Open Graph tags, Twitter's card (it reads the rest from Open Graph), and a feed link when the site
has one; `<html lang>` is `lang` from `site.md`. A `<svelte:head>` that writes one of those
fails, so there is one source for what a page says about itself. `sitemap.xml` lists every page
but the 404; `feed.xml` is RSS 2.0 with the pages that have a `date`, newest first, each with its
title, summary and date. The 404 page is written as `404.html` and left out of `prose`, since
nothing lists or links to it.

## Bundling

Once every page has rendered, Rolldown builds what the browser downloads besides the HTML
(`bundle.ts`), since only then is it known which components the site uses. Nothing it builds
reaches `dist/` until every page has.

A site has one stylesheet, `style.[hash].css`: the reset (`src/runtime/reset.css`), then
`pattern/style.css`, then the scoped styles of every component a page rendered, in path order.
CSS is small and needed before anything paints, so one file, cached by the first page and reused
by every other, costs less than a split that saves a few bytes a page. The reset is `@layer
reset`, declared first, so its order against the site's CSS doesn't matter; the site's own CSS
stays unlayered, so `@layer` and `!important` in it mean what they always mean. A component's
selector carries its scoping class, and components come after `pattern/style.css`, so a
component's rule wins over the site's. Svelte names that class from the component's path, so the
client build and the server render agree on it. A `url()` in any of it is bundled as
`assets/[name].[hash][ext]`; one Vite can't resolve is a warning Vite would ship as written, so
Sitez fails the build instead.

JavaScript splits by one rule: what more than one page uses goes in `common.js`; what only this
page uses goes in the page's own `index.js`, next to its `index.html`. The Svelte runtime and an
island in the layout are common; `TagFilter` on `/blog/` is the page's.

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

The island is the outermost component with browser behavior below a page or layout, which only
the render knows: the same component can be an island on one page and part of another island on
the next. So in the server render every `.svelte` a site's module imports resolves to a small
generated module (`islands.ts`) that calls the real component through `runtime/server.ts`, with
what the AST said about it. Svelte's context tells it where it is: inside an island it renders the
component as it is, since the browser runs all of it; outside, a component with behavior becomes
the island, written with its marker, and its children inside one `<sitez-children>` element:

```html
<sitez-island c="TagFilter" p="…devalue…">…server-rendered HTML…</sitez-island>
```

Calling the component directly is what compiled Svelte does for a child, so the wrapper adds no
markup and the island's HTML is exactly what the component renders, as hydration needs. The
island sets a context its children's components read, so an island in another's children fails.
The client build doesn't wrap anything: there an island is just its component.

Props are serialized with `devalue`, which keeps dates, maps, sets and URLs typed and already
ships with Svelte. It throws on a function with the path to it (`.nested.fmt`), and Sitez turns
that into the build error that names the island and the prop. Of `page`, `prose` and `site`, which
an element's component always gets, only the ones its `$props()` names are serialized, and naming
`prose` fails: every page's metadata would ship to the browser. A component with a scoping class
hashed from its path renders the same class on the server and in the browser.

Each island adds its name to a set the render is given, through Svelte's context, and the build
gives the page an entry that imports those islands and `runtime/client.ts`, which finds each
marker and calls
`hydrate(Component, { target, props })`. Children
aren't in the JavaScript: they're already in the page, so the script passes back the
`<sitez-children>` element's own HTML through `createRawSnippet`, and hydration reuses the
existing nodes. Children from prose and from a pattern's markup hydrate the same way. Both
elements are `display: contents` in the reset, so neither affects layout.

## Check

`sitez check` runs oxfmt over `prose/` and `pattern/`, oxlint over `pattern/`, `svelte-check`
for types, and reports Markz's warnings, which `build` prints but never fails on (`check.ts`).
oxfmt formats `.svelte` files, and it is the formatter whose output is Markz's canonical form, so
one tool formats both folders. Every problem is one `file:line:col: message` line and any problem
fails; `--fix` formats and applies oxlint's safe fixes first. The style is Sitez's, not
configured (`runtime/oxfmtrc.json`).

The tools are Sitez's own dependencies, run with the Node running Sitez. svelte-check looks for a
Svelte config up the tree from each file, so a site inside a larger repo, as the Markz site is,
would be checked by the repo's `vite.config.ts`; Sitez runs it in a folder of its own in the
cache folder instead, with a link to `pattern/`, a `tsconfig` and a Svelte config that compiles
as Sitez does. Svelte's `state_referenced_locally` warning is off: a page renders once and an
island's props are set once, so reading a prop at the top of a script is always what's meant.

## Preview

`sitez preview` serves `dist/` as a static host does (`preview.ts`): a folder's URL serves its
`index.html`, a folder without its slash redirects to it, and what isn't there gets `404.html`
with a 404. It renders nothing, so it shows exactly what will deploy.

## Install

`npm i -g sitez`, or `npx sitez dev` without installing. For someone without Node,
`mise use -g npm:sitez` installs Node and Sitez together: the one-command install a binary would
give, without building or signing one.

A single binary stays possible later. Vite+ ships native code (Rolldown, the Oxc tools), which
rules out Node's single executable applications; `bun build --compile` is the likely route.

## Deploy

`sitez deploy` builds, then pushes `dist/` to the `gh-pages` branch with the user's own git and
credentials, when the remote is on GitHub (`deploy.ts`). It clones the branch into a temp folder,
so the author's checkout is never touched, replaces its files with `dist/`'s and a `.nojekyll`,
and commits `Deploy <source sha>`: the branch keeps its history, so a bad deploy can be found and
reverted, and a build that changed nothing pushes nothing. Cloudflare builds from its own git
integration with `npx sitez build`, so Sitez carries no Wrangler.

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
- **Raw HTML.** A ` ```=html ` block ships as written, `<script>` included: it is the author's
  escape hatch, outside the islands and the JavaScript they account for. The build report notes
  a page with a raw `<script>`; whether to sanitize raw HTML waits until sites use it enough to
  say.
- **A social image.** `og:image` is left out until Sitez can make one: each page's card drawn by
  a pattern (a `Card.svelte` given `page` and `site`, or an SVG template), rendered at build time.
  Social sites don't take SVG, so the card has to be rasterized to PNG, which means a renderer
  such as resvg in the toolchain. Twitter's card becomes `summary_large_image` once there is one.
