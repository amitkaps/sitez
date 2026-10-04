# Design

How Sitez is built. What it promises is in [idea.md](idea.md); everything here can change
underneath without changing those promises.

## Toolchain

Sitez is an npm package built on [Vite+](https://vite-plus.dev). Vite+ is the toolchain; Sitez
is a Vite plugin plus the config nobody writes. Users never see a `vite.config.ts`.

```text
sitez (npm)
├── vite                  Vite+'s core (@voidzero-dev/vite-plus-core): dev server, Rolldown
├── vite-plus             oxfmt, oxlint
├── @amitkaps/markz       parser
├── htl                   html in the browser
└── @preact/signals-core  signal and effect
```

Sitez calls `createServer` and `build` itself, with `configFile: false`.

A site needs no `package.json`. It gets one only when its code imports an npm library. A resolver
plugin resolves a bare import from the site first, then as if imported from inside Sitez, so
`sitez` itself resolves from a folder with no `node_modules`. Vite's dependency optimizer is off,
because it resolves from the site root, where there are no packages. Sitez's dependencies are ESM
and need no pre-bundling. Vite strips TypeScript's types with no setup, so `code/` takes `.ts` as
well as `.js`.

## The runtime

What a site imports from `sitez` is four names: `html`, `signal`, `effect` and `define`. The site
never imports htl or a signals library itself, so what is behind those names can change (htl to
uhtml, the signals package to Sitez's own) without touching a site. The runtime lives in its own
folder and never imports the rest of Sitez. If something other than Sitez wants it, it moves out
into a tiny package of its own; until then, a second package would be a second release cycle for
one consumer.

`sitez` has one entry per runtime, picked by the package's `browser` export condition, so build
code and islands write the same import:

```text
html`…`
  ├─ build:   a template value → Sitez's renderer → escaped HTML string
  └─ browser: htl → DOM nodes
```

**At build time**, `html` records its strings and values and renders nothing. The renderer turns
that value into a string, with htl's meaning for each place a value can go, so one tag means the
same in both runtimes. In text, a value is escaped (`& < > " '`), a nested template or Markz's
HTML goes in as HTML, an array is each item, and `null`, `undefined` and `false` are nothing. In
an unquoted attribute (`href=${link}`), `null`, `undefined` and `false` drop the attribute and
`true` leaves it bare. A value where an attribute name goes fails. A promise anywhere is awaited,
and every promise in a template resolves in parallel. A function fails the build, naming the file.

Making DOM nodes at build time as well, as htl does, was ruled out: the build would need a DOM in
Node only to serialize it back to the string it wanted. A template value is marked with
`Symbol.for("sitez.template")`, not a class: the site's code loads `sitez` through Vite's module
runner and the build loads it through Node, which makes two copies of the module, and `instanceof`
fails between them.

The renderer's job is correctness, not defense: the site's author writes all of its input, and a
title with `&` must not break the page. The browser's Sanitizer API doesn't apply. It doesn't
exist in Node, and it strips what it finds dangerous from HTML that's meant to be kept.

**In the browser**, `html` is htl's, which turns values into text nodes and attributes, so it is
safe by construction. `signal` and `effect` are the signals core's. `define(name, setup)` defines
the custom element and calls `setup(el)` once per element, on its first connect:
`connectedCallback` runs again when an element moves, and running `setup` twice would bind
everything twice. In Node, `define` fails, since an island never runs at build time. Each island
bundle includes only what it uses, so an island that doesn't call `html` ships no htl.

## Dev server

`sitez dev` is the same Vite server `build` renders through, listening and watching (`dev.ts`).
It renders a page when it's asked for, with the code `build` uses (`site.ts`), so the two can't
disagree; drafts are pages like any other. The site is read again for every page, which is what
makes a new or deleted file a new or missing URL without a restart.

A page in dev has two scripts. One imports the stylesheet as modules (the reset and
`code/style.css`), then shows the page. It blocks the first render (`blocking="render"`), as a
stylesheet link does in `build`, and where that isn't supported a small `<style>` keeps the page
hidden until then, or for a second at most, so it never flashes unstyled. That `<style>` also opts
into view transitions, which must be on before a page first renders. The other script imports the
page's islands, apart, so a broken island can't hold back the styles.

A change to CSS is hot-replaced by Vite. Anything else reloads the page: a change to code can
change any page's HTML, even whether a link on another page is broken, so the server's modules are
all invalidated, and a custom element can't be defined twice, so an island can't be swapped in
place. Pages rendered at build time have no client state to keep, so a reload is the whole of HMR
for them. A failure renders as a page holding `build`'s message, with Vite's client on it, so
fixing the file reloads it, CSS included. A `url()` in the site's CSS that points at nothing is
one: Vite hands it to the browser unchecked in dev, so `dev` checks the stylesheet itself as a
page is served, as `build` would fail on it.

Vite's dependency optimizer doesn't run, and its cache lives in the system's temp folder, so
`dev` writes nothing into the site.

## Build

Pages render through Vite's module runner, in `build` as in `dev`, not from a bundle. The site's
modules run from where they are, so `import.meta.url` still points at them, and `dev` and `build`
can't render a page differently. A rejected promise keeps its original error, whose stack names the
data module rather than the page, so the build wraps each render and names the page file. Pages
render concurrently. If the build gets slow, the fix is a faster build, not less HTML.

A text page is Markz's HTML with each element that has a component replaced by its output.
`html()` renders a view of the document in which each such element, and each raw `=html` block, is
a marker, so the only tags in its output are Markz's own and replacing one is exact. A component
is found up the tree as a layout is, and called with its attributes as string props, its content
rendered first as `children`, and the page's `page`, `pages` and `site`; an attribute of one of
those names fails. A raw block is written as it is. Markz's warnings are printed by `build` and
never fail it.

A page renders before its layout, because a JS page's title can come from its own `<h1>` and the
layout needs the title. The layout is then called with the page's finished HTML as `children`;
one that doesn't render its children, or renders them twice, fails the build. Only the nearest
layout wraps a page: `code/blog/Layout.js` that wants the site's header imports `../Layout.js`
and puts itself inside it. `Head.js` resolves the same way.

Links are rewritten from the AST, not the HTML, so examples in code blocks are left alone: the
view `html()` renders has each link's destination swapped for its URL, as it has markers for
elements and raw blocks. A relative link to a `.md` in `text/` becomes that page's URL, one to a
file in `public/` its path, and one to any other file in the repo `{repo}/blob/main/{path}`
(`tree` for a folder), with the path from the git root, which may be above the site's. A site link
(`/about`) is looked up among the pages, then in `public/`. A link to a draft, to the 404 page, or
to anything that isn't there fails with its line. The check needs every page's draft status before
any text renders, so `build` loads the JS pages' modules for their `metadata` first. Then each
rendered page's `href` and `src` attributes are checked against the same pages, `public/` and
Sitez's own files, which catches what code and raw blocks write. A site link there has to be exact
(`/blog/`), since the HTML is finished and nothing rewrites it. Only start tags are read, so HTML
shown as text, whose `<` is escaped, and code inside `<script>` aren't taken for links. A link an
island writes exists only in the browser and isn't checked, one more reason islands enhance rather
than generate.

The head is written from metadata (`head.ts`): `<title>`, the description, the canonical URL and
Open Graph tags, Twitter's card (it reads the rest from Open Graph), and a feed link when the site
has one; `<html lang>` is `lang` from `site.md`. `Head.js`'s output follows, and writing one of
those tags there fails, so there is one source for what a page says about itself. `sitemap.xml`
lists every page but the 404; `feed.xml` is RSS 2.0 with the pages that have a `date`, newest
first, each with its title, summary and date. The 404 page is written as `404.html` and left out
of `pages`, since nothing lists or links to it.

## Islands

An island is a custom element, and its tag is the element's own name, not
`<div data-component="call-out">`: the browser finds and upgrades a custom element by itself, where
a `div` would need Sitez's runtime to scan for it and watch for new ones. It's also what Markz
writes. The file is named by its tag and the word Sitez uses for it, `filter-grid.island.js`, so it
can't be taken for a page or a component, and Sitez never imports it in Node, where `HTMLElement`
doesn't exist. Sitez can't read browser behavior from plain JavaScript, as it read it from Svelte's
AST, so the file name is the mark.

Sitez finds the islands a page uses by scanning its finished HTML for their tags. Islands nest
without any effort, since custom elements do.

An island adds behavior to HTML the build wrote, and doesn't draw its own. On a slow load its module
can run after first paint, so markup it inserted would move the page: in the spike, filter buttons
an island prepended pushed the teaching grid down. So a component of the same name writes what the
island shows. `FilterGrid.js` writes `<filter-grid>`, its buttons and its children, and
`filter-grid.island.js` wires the buttons. A component whose output drops its own tag while an
island of that name exists fails the build, since the island would never run.

The only data an island gets is the page: its children and its attributes. There are no props to
serialize, nothing is sent twice, and there is nothing to hydrate. An island that needs rows of
data will get them as a JSON `<script>` child, once a site needs one; it will need rules for what
crosses (a `Date` becomes a string in JSON) and how big it may get.

The two sides of the boundary fail apart: build-time code that imports an `.island.js` would crash
Node, and an island that imports a page, layout or component would bundle whatever those import.
Both fail the build, naming the import. A helper with no Node imports, such as a `_card.js` that
returns a template, can be used by both.

## Bundling

Once every page has rendered, Rolldown builds what the browser downloads besides the HTML
(`bundle.ts`). Nothing it builds reaches `dist/` until every page has.

A site has one stylesheet, `style.[hash].css`: the reset (`src/runtime/reset.css`), then
`code/style.css` and what it imports. CSS is small and needed before anything paints, so one file,
cached by the first page and reused by every other, costs less than a split that saves a few bytes
a page. The reset is `@layer reset`, declared first, so its order against the site's CSS doesn't
matter; the site's own CSS stays unlayered, so `@layer` and `!important` in it mean what they
always mean. A `url()` in it is bundled as `assets/[name].[hash][ext]`; one Vite can't resolve is
a warning Vite would ship as written, so Sitez fails the build instead.

JavaScript splits by one rule: what more than one page uses goes in `common.js`; what only this
page uses goes in the page's own `index.js`, next to its `index.html`. The signals core and an
island in the layout are common; `tag-filter` on `/blog/` is the page's.

File names carry a content hash (`common.3f9a1c.js`), so a new deploy is never served from a
stale cache. A page with no islands loads no JavaScript, common or its own. An island used on a
few pages still lands in `common.js`; the `common` row in the build report shows if that grows.
The runtime's floor is the signals core, about 1.5 KB gzipped, and htl, about 3 KB, only for an
island that calls `html`. The build sets production mode itself.

## Check

`sitez check` runs oxfmt over `text/` and `code/`, oxlint over `code/`, and reports Markz's
warnings, which `build` prints but never fails on (`check.ts`). oxfmt formats the HTML inside
`html` templates, as Prettier does, and it is the formatter whose output is Markz's canonical form,
so one tool formats both folders. What is safe to fix, it fixes first, without asking: oxlint's
safe fixes, then formatting, naming the files it formatted. Every problem left is one
`file:line:col: message` line and any problem fails. The style is oxfmt's defaults
(`runtime/oxfmtrc.json`), so an editor running oxfmt without a config agrees with it. The tools are
Sitez's own dependencies, run with the Node running Sitez.

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

## Why not Svelte

Sitez 0.1 ([`v0.1.0`](https://github.com/amitkaps/sitez/tree/v0.1.0)) wrote its pages,
layouts and components in Svelte, rendered them on the server, and hydrated each island in the
browser. It worked, and most of it existed for one feature: rendering an island on the server and
then hydrating it. That meant reading browser behavior from Svelte's AST, wrapping every component
in the server render, serializing props with `devalue`, passing children back through
`createRawSnippet`, and compiling text as Svelte so both shared one renderer. Six of its seven
dependencies and about a third of `src/` served that.

Sitez's real site didn't need it. amitkaps.github.io has one kind of interactivity, card grids
filtered by category, and the grid is already complete HTML. A Svelte island for it shipped about
11 KB of runtime and sent the grid's data twice, as HTML and again as props, so the browser could
draw what the build already had. What leaving gives up is Svelte's editor support inside
templates. The spike that decided it is in [spike/](../spike/README.md).

## Why not SvelteKit, Astro or Ogygia

- **SvelteKit** has server rendering, build-time data (`load` with `prerender`) and a Vite dev
  server. It also has what Sitez leaves out: a client router, `+page`/`+layout`/`+server` files,
  endpoints, form actions, hooks, adapters and a server runtime, and its own conventions for each.
  It hydrates a whole page or none of it, and it has no convention for text: amitkaps.github.io
  writes its own loaders to read its Markdown and YAML, and its `/teaching/` page loads 206 KB of
  JavaScript.
- **Astro** is the nearest tool: content pages, islands, no JavaScript by default, View
  Transitions. Its pages are `.astro`, its content is Markdown or MDX configured through content
  collections, and its islands are framework components hydrated with their props.
- **[Ogygia](https://ogygia.puruvj.dev)** adds islands to SvelteKit, and Sitez 0.1's islands
  followed it: rendered on the server, then hydrated, with props through `devalue`. It is also what
  SvelteKit plus islands becomes without a limit: server islands, remote functions, content
  collections with schemas, a docs shell, versions and locales, an SPA router, and a Vite config,
  server hooks and an `ORIGIN` variable to adopt it.

## Open questions

- **Types.** `sitez check` has no type checker since svelte-check went. `tsc` with `checkJs` over
  `code/`, strict but asking for no annotations, is the likely one, once a site's mistakes call for
  it.
- **Misspelled elements.** An element with no component and no island is a plain HTML element,
  which is legitimate, so a misspelled island name does nothing, silently. A warning for an element
  that has no component, no island and no selector in `style.css` would catch it, if it isn't too
  fragile.
- **Disposing effects.** An island's effects live as long as its page, and cross-document View
  Transitions mean a full load each time, so nothing disposes them yet. An island that removes
  elements would need `define` to dispose effects in `disconnectedCallback`.
- **Re-rendering in islands.** htl builds DOM once, and signals update it through `effect`, which
  covers hiding, toggling and text. An island that re-renders a list would lose focus and input
  state and need a diffing renderer, such as uhtml, behind the same `html`.
- **Meaning.** `<call-out>` means nothing to a screen reader, where `<aside>` is a landmark.
  `{@call-out role="note"}` works for one use; when the meaning matters on every use, that's what
  a component is for. Whether the docs should say so more strongly waits for a site that needs it.
- **Raw HTML.** A ` ```=html ` block ships as written, `<script>` included: it is the author's
  escape hatch, outside the islands and the JavaScript they account for. The build report notes
  a page with a raw `<script>`; whether to sanitize raw HTML waits until sites use it enough to
  say.
- **A social image.** `og:image` is left out until Sitez can make one: each page's card drawn by
  a component (a `Card.js` given `page` and `site`, or an SVG template), rendered at build time.
  Social sites don't take SVG, so the card has to be rasterized to PNG, which means a renderer
  such as resvg in the toolchain. Twitter's card becomes `summary_large_image` once there is one.
