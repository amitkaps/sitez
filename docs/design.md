# Design

How Sitez is built. What it promises is in [idea.md](idea.md). Everything here can change
underneath without changing those promises.

## Toolchain

Sitez is an npm package built on [Vite+](https://vite-plus.dev). Vite+ is the toolchain, and
Sitez is a Vite plugin plus the config nobody writes. Users never see a `vite.config.ts`, and
nothing in a site names Vite. So the toolchain is Sitez's to swap. Vite+ may give way to Vite,
oxfmt and oxlint as separate packages, or to something else, and a site doesn't change.

```text
sitez (npm)
├── vite                  Vite+'s core (@voidzero-dev/vite-plus-core): dev server, Rolldown
├── vite-plus             oxfmt, oxlint
├── @amitkaps/markz       parser
├── htl                   html in the browser
└── @preact/signals-core  signal and effect
```

Sitez calls `createServer` and `build` itself, with `configFile: false`.

A site's `package.json` names its version of Sitez, and any npm library its code imports. A
resolver plugin resolves a bare import from the site first, then as if imported from inside Sitez.
`sitez` itself resolves to the running Sitez's runtime, so its templates go to the renderer that
has to agree with them. Since the command hands off to the site's copy ([Install](#install)), the
running Sitez and the site's are one.

Vite's dependency optimizer is off, because it resolves from the site root, where there are no
packages. Sitez's dependencies are ESM and need no pre-bundling. Vite strips TypeScript's types
with no setup, so `code/` takes `.ts` as well as `.js`.

## Names in `code/`

A file's role in `code/` is the first character of its name (`docs/idea.md#folders`). `@` is an
element's file, `+` is a file Sitez reads by name, and anything else is a module. Every page is
text, so no file in `code/` is a page, and a plain name can mean a module with no prefix.

- **`@` is Markz's own mark.** `{@call-out}` in text is `@call-out.js` in code, so the file for an
  element is found by reading the element.
- **`+` is a closed set.** Sitez reads `+layout.js` and `+style.css`, and any other `+` file fails.
  A misspelled name fails rather than doing nothing. SvelteKit marks its files the same way, so
  the mark is familiar.
- **`.live` is the one suffix.** It marks the file Sitez never imports in Node, where
  `HTMLElement` doesn't exist. Sitez can't tell browser code from build code by reading plain
  JavaScript, so the name is the mark.

Sitez 0.2 began with other names, and they went because each was a rule with nothing behind it.

- **JS pages** (`code/blog/index.js` → `/blog/`). A page that lists posts is a text page holding a
  component, so a second kind of page bought nothing. Without it, a lowercase name no longer has
  to mean a page, and a page's title always comes from its metadata.
- **Capitalized layouts and components** (`Layout.js`, `CallOut.js`). They had to be translated
  from the element's name, and case is easy to get wrong on a case-insensitive disk.
- **`_` for modules.** Once nothing in `code/` is a page, a module needs no mark.
- **`Head.js`.** The nearest layout already knows the page, so it exports `head` beside its
  default export. A section's layout imports its parent's `head`, as it imports the parent layout.
- **`.island.js`.** "Live" says what the file does, and "island" named an architecture the reader
  had to know.
- **A `content/` folder holding text and data.** It would put the files authors write together.
  But `text/` would hold files that aren't pages, and "a folder is named for its kind of file"
  would get an exception. Jekyll, Hugo and Eleventy keep data apart too.

Other marks were weighed and ruled out.

- **Browser code as a named export** of the component's file. One file would then run in Node and
  in the browser, and its imports would cross the boundary unseen.
- **`.html.js`, `.client.js`, `.island.js` or a `$` prefix.** Each is another word for `@` or
  `.live` with no gain.
- **A `live` attribute on each use** (`{@tag-filter live}`). Behavior belongs to the element, not
  the use. It comes back only if load timing needs a per-use switch.
- **`+` files for custom outputs** (a `+feed.xml.js`). Sitez writes the sitemap and feed itself,
  and custom outputs are configuration by another name.
- **`from` or `src` for data.** `data` says what the component gets, and `src` already means a URL
  in HTML.

## The runtime

A site imports four names from `sitez`, which are `html`, `signal`, `effect` and `define`. The
site never imports htl or a signals library itself. So what's behind those names can change
without touching a site (htl to uhtml, or the signals package to Sitez's own).

The runtime lives in its own folder and never imports the rest of Sitez. If something other than
Sitez wants it, it moves out into a tiny package of its own. Until then, a second package would be
a second release cycle for one consumer.

`sitez` has one entry per runtime, picked by the package's `browser` export condition. So build
code and `.live` files write the same import.

```text
html`…`
  ├─ build:   a template value → Sitez's renderer → escaped HTML string
  └─ browser: htl → DOM nodes
```

**At build time**, `html` records its strings and values and renders nothing. The renderer
(`src/runtime/render.ts`) turns that value into a string. It follows the HTML tokenizer through
the template, as htl does, so each place a value can go means what it means in htl.

- In text, a value is escaped (`& < > " '`). A nested template or Markz's HTML goes in as HTML,
  and an array is each of its items. `null`, `undefined` and `false` are nothing.
- Right after `name=`, a value is the attribute's. `null`, `undefined` and `false` drop the
  attribute, and `true` leaves it bare. Anything else is written quoted and escaped.
- Inside an attribute's value, quoted or not, a value is escaped text.
- Inside `<script>` or `<style>`, a value goes in as it is, so a JSON-LD block stays JSON. One
  holding the element's closing tag fails.
- In a comment, a value is dropped.
- A promise anywhere is awaited, in nested templates and arrays too.

Some templates fail, and the build names the file.

- A function fails, since at build time it could only be an event handler.
- A value where a tag's name or an attribute's name goes fails. htl would spread an object there
  as attributes, which is a second way to write `name=${value}`.
- A template in an attribute fails, and so does a plain object anywhere. Each would write
  `[object Object]`.

The renderer differs from htl in one place on purpose. htl writes `false` in text as the word.
`${cond && html`…`}` is how a template says "maybe", and the word is never wanted.

Making DOM nodes at build time as well, as htl does, was ruled out. The build would need a DOM in
Node only to serialize it back to the string it wanted.

A template value is marked with `Symbol.for("sitez.template")`, not a class. The site's code loads
`sitez` through Vite's module runner, and the build loads it through Node. That makes two copies
of the module, and `instanceof` fails between them.

The renderer's job is correctness, not defense. The site's author writes all of its input, and a
title with `&` must not break the page. The browser's Sanitizer API doesn't apply. It doesn't
exist in Node, and it strips what it finds dangerous from HTML that's meant to be kept.

**In the browser**, `html` is htl's. It turns values into text nodes and attributes, so it is
safe by construction. `signal` and `effect` are the signals core's.

`define(name, setup)` defines the custom element and calls `setup(el)` once per element, on its
first connect. `connectedCallback` runs again when an element moves, and running `setup` twice
would bind everything twice. In Node, `define` fails, since a `.live` file never runs at build
time. Each bundle includes only what it uses, so a `.live` file that doesn't call `html` ships no
htl.

## Dev server

`sitez dev` is the same Vite server `build` renders through, listening and watching (`dev.ts`).
It renders a page when it's asked for, with the code `build` uses (`site.ts`), so the two can't
disagree. Drafts are pages like any other. The site is read again for every page, so a new or
deleted file is a new or missing URL without a restart.

A page in dev has two scripts.

- The first imports the stylesheet as modules (the reset and `code/+style.css`), then shows the
  page. It blocks the first render (`blocking="render"`), as a stylesheet link does in `build`.
  Where that isn't supported, a small `<style>` keeps the page hidden until then, or for a second
  at most, so it never flashes unstyled. That `<style>` also opts into view transitions, which
  must be on before a page first renders.
- The second imports the page's `.live` files, apart, so a broken one can't hold back the styles.

Vite hot-replaces a change to CSS. Anything else reloads the page.

- A change to code can change any page's HTML, even whether a link on another page is broken. So
  the server's modules are all invalidated.
- A custom element can't be defined twice, so a `.live` file can't be swapped in place.
- Pages rendered at build time have no client state to keep, so a reload is the whole of HMR for
  them.

A failure renders as a page holding `build`'s message, with Vite's client on it. So fixing the
file reloads it, CSS included. A `url()` in the site's CSS that points at nothing is one such
failure. Vite hands it to the browser unchecked in dev, so `dev` checks the stylesheet itself as a
page is served, as `build` would fail on it.

Vite's dependency optimizer doesn't run, and its cache lives in the system's temp folder. So `dev`
writes nothing into the site.

## Build

Pages render through Vite's module runner, in `build` as in `dev`, not from a bundle. The site's
modules run from where they are, so `import.meta.url` still points at them. And `dev` and `build`
can't render a page differently. A rejected promise keeps its original error, whose stack names
the data module rather than the page. So the build wraps each render and names the page file.
Pages render concurrently. If the build gets slow, the fix is a faster build, not less HTML.

A page is Markz's HTML with each element that has a component rendered by it. `html()` renders a
view of the document in which each such element is a marker, as each raw `=html` block is. So the
only tags in its output are Markz's own, and replacing one is exact. Markers are replaced
innermost first, so a component's `children` holds its content already rendered. A component is
found up the tree, as a layout is. It's called with three kinds of props.

- Its attributes, as strings. Classes accumulate, and any other key's last value wins.
- Its content, rendered first, as `children`.
- The page's `page`, `pages` and `site`. An attribute named `children` or one of those fails.

A `data` attribute is read before the call. Its path resolves in `data/`, and the parsed JSON
replaces the string. One that isn't there fails, naming the line.

A component is a module whose default export returns a template, and the build renders it. Its
output is trimmed, so a template written across lines can sit inside a paragraph. Sitez writes the
element around it ([Wrapping](#wrapping)). A raw block is written as it is. `build` prints Markz's
warnings, and they never fail it.

The layout is called with the page's finished HTML as `children`. A layout that doesn't render
its children, or renders them twice, fails the build. Only the nearest layout wraps a page. A
`code/blog/+layout.js` that wants the site's header imports `../+layout.js` and puts itself inside
it. The same layout's `head` export adds to the page's `<head>`.

`pages` is every page's URL and metadata, read before any page renders.

### Wrapping

A component returns its element's inner HTML, and Sitez writes the element around it with its
attributes. A `data` attribute is left out, since the component has read it. So the tag is always
in the page, where CSS and the element's `.live` file look for it. Wrapping costs something for
each kind of element.

- **A leaf** (`{@video-embed id=x /}`) can never be a bare `<iframe>` or `<img>`. The page gets
  `<video-embed id="x"><iframe …></iframe></video-embed>`.
- **A container** (`{@call-out}…{/call-out}`) holds block content in an element that is inline by
  default. Its background, border and margins are wrong until the site's CSS sets
  `display: block`.
- **An inline element** (`[term]{@key-word}`) is right as inline. It can't become another element,
  so an `{@ext-link href=…}` writes its `href` twice, once on each tag. It sits inside a `<p>`, so
  its output can't hold a tag that closes one, such as `<div>`, `<ul>` or `<p>`. The browser
  would end the paragraph there and pop the element with it, and the page would break silently.
  So the build fails, naming the line, the element and the tag. The list is the parser's, of the
  start tags that close an open `<p>`, not the spec's phrasing content, so it fails exactly where
  a browser breaks. The check reads the output after nesting, since inner components render first.
  It runs wherever the element is used inline, in a heading or a table cell too, since a tag
  means the same everywhere.

The reset can't set `display: block` for the site. CSS has no selector for custom elements, or for
elements used as blocks. So a block component costs one line in `+style.css`.

Replacing the tag with the component's output was ruled out. Sitez first did that, and a
component could return `<aside class="call-out">`. The element's name was gone from the page, so
its `.live` file never ran and its CSS never matched. A tag that is always there is worth more
than choosing the root element.

Passing the kind of use (inline, leaf or container) to the component was ruled out. Sitez reads
it from Markz to run the check above, and the component never sees it. An element that renders
differently by where it's used is two elements, such as `{@cite}` and `{@cite-block}`. So a tag
means the same everywhere, for CSS and for its `.live` file. A `kind` prop would also be a fifth
reserved attribute name, and `form` is already an HTML attribute. It can be added later without
breaking a component, and taking it away couldn't.

### Links

Links are rewritten from the AST, not the HTML, so examples in code blocks are left alone. The
view `html()` renders has each link's destination swapped for its URL, as it has markers for
elements and raw blocks.

- A relative link to a `.md` in `text/` becomes that page's URL, and one to a file in `public/`
  becomes its path.
- A link to any other file in the repo becomes `{repo}/blob/main/{path}` (`tree` for a folder).
  The path is from the git root, which may be above the site's.
- A site link (`/about`) is looked up among the pages, then in `public/`.
- A link to a draft, to the 404 page, or to anything that isn't there fails with its line.

The check needs every page's draft status before any text renders, which every page's metadata
block gives.

Then each rendered page's `href` and `src` attributes are checked against the same pages,
`public/` and Sitez's own files. That catches what code and raw blocks write. A site link there
has to be exact (`/blog/`), since the HTML is finished and nothing rewrites it. Only start tags
are read. So HTML shown as text, whose `<` is escaped, and code inside `<script>` aren't taken for
links. A link a `.live` file writes exists only in the browser and isn't checked. That's one more
reason live elements enhance rather than generate.

### The head, the sitemap and the feed

The head is written from metadata (`head.ts`).

- `<title>`, the description, the canonical URL and Open Graph tags.
- Twitter's card. Twitter reads the rest from Open Graph.
- A feed link, when the site has a feed.
- `<html lang>`, which is `lang` from `site.md`.

The nearest layout's `head` follows. Writing one of those tags there fails, so there is one source
for what a page says about itself.

`sitemap.xml` lists every page but the 404. `feed.xml` is RSS 2.0 with the pages that have a
`date`, newest first, each with its title, summary and date. The 404 page is written as
`404.html` and left out of `pages`, since nothing lists or links to it.

## Live elements

A live element is a custom element, and its tag is the element's own name. It isn't
`<div data-component="call-out">`. The browser finds and upgrades a custom element by itself,
where a `div` would need Sitez's runtime to scan for it and watch for new ones. A custom element
is also what Markz writes.

Sitez finds the `.live` files a page uses by scanning its finished HTML for their tags. Live
elements nest without any effort, since custom elements do.

A live element adds behavior to HTML the build wrote, and doesn't draw its own. On a slow load its
module can run after first paint, so markup it inserted would move the page. In the spike, filter
buttons the script prepended pushed the teaching grid down. So the element's component writes
what it shows. `@filter-grid.js` writes the buttons and the grid's children, and
`@filter-grid.live.js` wires the buttons. Sitez writes `<filter-grid>` around the component's
output, so the script always finds its element.

The only data a live element gets is the page, which means its children and its attributes. There
are no props to serialize, nothing is sent twice, and there is nothing to hydrate. One that needs
rows of data will get them as a JSON `<script>` child, once a site needs one. That will need rules
for what crosses (a `Date` becomes a string in JSON) and how big it may get.

The two sides of the boundary fail apart. Build-time code that imports a `.live` file would crash
Node. A `.live` file that imports a component or a layout would bundle whatever those import. Both
fail the build, naming the import. A module with no Node imports can be used by both, such as a
`card.js` that returns a template.

## Bundling

Once every page has rendered, Rolldown builds what the browser downloads besides the HTML
(`bundle.ts`). Nothing it builds reaches `dist/` until every page has.

A site has one stylesheet, `style.[hash].css`. It holds the reset (`src/runtime/reset.css`), then
`code/+style.css` and what it imports. CSS is small and needed before anything paints. So one file,
cached by the first page and reused by every other, costs less than a split that saves a few
bytes a page.

The reset is `@layer reset`, declared first, so its order against the site's CSS doesn't matter.
The site's own CSS stays unlayered, so `@layer` and `!important` in it mean what they always
mean. A `url()` in it is bundled as `assets/[name].[hash][ext]`. Vite would ship one it can't
resolve as written, with only a warning, so Sitez fails the build instead.

JavaScript splits by one rule. What more than one page uses goes in `common.js`. What only this page
uses goes in the page's own `index.js`, next to its `index.html`. The signals core and a live
element in the layout are common, and `tag-filter` on `/blog/` is the page's.

File names carry a content hash (`common.3f9a1c.js`), so a new deploy is never served from a stale
cache. A page with no live element loads no JavaScript, common or its own. A `.live` file used on a
few pages still lands in `common.js`, and the `common` row in the build report shows if that grows.
The runtime's floor is the signals core, about 1.5 KB gzipped. htl adds about 3 KB, only for a
`.live` file that calls `html`. The build sets production mode itself.

## Check

`sitez check` runs oxfmt over `text/` and `code/` and oxlint over `code/` (`check.ts`). It also
reports Markz's warnings, which `build` prints but never fails on.

oxfmt formats the HTML inside `html` templates, as Prettier does. Its Markdown output is Markz's
canonical form, so one tool formats both folders.

What is safe to fix, `check` fixes first, without asking. That means oxlint's safe fixes, then
formatting, naming the files it formatted. Every problem left is one `file:line:col: message`
line, and any problem fails. The style is oxfmt's defaults (`runtime/oxfmtrc.json`), so an editor
running oxfmt without a config agrees with it. The tools are Sitez's own dependencies, run with
the Node running Sitez.

## Preview

`sitez preview` serves `dist/` as a static host does (`preview.ts`). A folder's URL serves its
`index.html`, and a folder without its slash redirects to it. What isn't there gets `404.html`
with a 404. It renders nothing, so it shows exactly what will deploy.

## Install

Sitez is installed in each site, never globally. `npm install` puts the version the site's
`package.json` names in `node_modules`, and `npx sitez dev` or `pnpm sitez dev` runs that copy.
So the author's machine and the host build with the same Sitez by construction. Without a pinned
version, a release of Sitez could change a live site on its next deploy with nothing in the repo
changed.

Sitez checks one thing, that the site's `package.json` names `sitez`. Run in a site that doesn't,
`npx` downloads the newest release, and nothing in the repo would record it. So every command
fails there, naming the line to add. It never compares versions. Keeping `node_modules` in step
with `package.json` is the package manager's job. The report's last line names the version that
ran.

Ruled out:

- **A global install.** It was the first design, with no `package.json`, and nothing in the repo
  said which version built the site. A global command that hands off to the site's copy, as
  ESLint's does, was ruled out next. `npx` and `pnpm` already run the site's copy, so the
  launcher would be machinery for a path nobody needs. `mise use -g npm:sitez` went with it.
- **A single binary.** It was for installing without Node, and a site with a `package.json` needs
  Node anyway.
- **A Vite plugin the site configures.** It would pin the version, but every site would write a
  `vite.config.js`. Vite's API would become Sitez's public surface, and `check`, `deploy` and the
  report would be scripts each site wires up.
- **A version in `site.md`.** It holds metadata, never settings, and npm already pins packages.
- **Scripts in `package.json`.** `"dev": "sitez dev"` repeats the CLI under a second name, which
  drifts. A site can add them, and Sitez never writes or reads them.

## Deploy

`sitez deploy` builds, then pushes `dist/` to the `gh-pages` branch when the remote is on GitHub
(`deploy.ts`). It uses the user's own git and credentials.

It clones the branch into a temp folder, so the author's checkout is never touched. It replaces
the branch's files with `dist/`'s and a `.nojekyll`, and commits `Deploy <source sha>`. The branch
keeps its history, so a bad deploy can be found and reverted. A build that changed nothing pushes
nothing.

Cloudflare builds from its own git integration with `npx sitez build`, so Sitez carries no
Wrangler.

## Why not Svelte

Sitez 0.1 ([`v0.1.0`](https://github.com/amitkaps/sitez/tree/v0.1.0)) wrote its pages, layouts
and components in Svelte. It rendered them on the server and hydrated each island in the browser.
It worked, and most of it existed for one feature, rendering an island on the server and then
hydrating it. That feature needed several pieces.

- Reading browser behavior from Svelte's AST.
- Wrapping every component in the server render.
- Serializing props with `devalue`.
- Passing children back through `createRawSnippet`.
- Compiling text as Svelte, so both shared one renderer.

Six of its seven dependencies and about a third of `src/` served that.

Sitez's real site didn't need it. amitkaps.github.io has one kind of interactivity, card grids
filtered by category, and the grid is already complete HTML. A Svelte island for it shipped about
11 KB of runtime. It sent the grid's data twice, as HTML and again as props, so the browser could
draw what the build already had. What leaving gives up is Svelte's editor support inside
templates. The spike that decided it is in the repo's history, at [spike/](https://github.com/amitkaps/sitez/tree/465e738/spike).

## Why not SvelteKit, Astro or Ogygia

- **SvelteKit** has server rendering, build-time data (`load` with `prerender`) and a Vite dev
  server. It also has what Sitez leaves out. That's a client router, `+page`, `+layout` and
  `+server` files, endpoints, form actions, hooks, adapters and a server runtime, each with its
  own conventions. It hydrates a whole page or none of it. It has no convention for text, so
  amitkaps.github.io writes its own loaders to read its Markdown and YAML. Its `/teaching/` page
  loads 206 KB of JavaScript.
- **Astro** is the nearest tool, with content pages, islands, no JavaScript by default and View
  Transitions. Its pages are `.astro`. Its content is Markdown or MDX configured through content
  collections. Its islands are framework components hydrated with their props.
- **[Ogygia](https://ogygia.puruvj.dev)** adds islands to SvelteKit, and Sitez 0.1's islands
  followed it. They were rendered on the server, then hydrated, with props through `devalue`.
  Ogygia is also what SvelteKit plus islands becomes without a limit. It has server islands,
  remote functions, content collections with schemas, a docs shell, versions and locales, and an
  SPA router. Adopting it takes a Vite config, server hooks and an `ORIGIN` variable.

## Precedent

- **[Enhance](https://enhance.dev)** has the same element model. The file name is the tag, an
  element is a pure function, and it renders in light DOM. It renders on a server, where Sitez
  writes static files.
- **[WebC](https://www.11ty.dev/docs/languages/webc/)** bundles a component's script only on the
  pages where its tag appears, as Sitez does with `.live` files.

What Sitez adds is the combination of text-first pages, behavior paired with markup by file name,
and static output.

## Open questions

- **Types.** `sitez check` has had no type checker since svelte-check went with Svelte. The likely
  one is `tsc` with `checkJs` over `code/`, strict but asking for no annotations. It comes once a
  site's mistakes call for it.
- **Misspelled elements.** An element with no `@` file and no `.live` file is a plain HTML
  element, which is legitimate. So a misspelled name silently does nothing. A warning could catch
  it, for an element with neither file and no selector in `+style.css`. That's worth it if it
  isn't too fragile.
- **Per-component CSS.** An `@call-out.css` beside `@call-out.js` would keep an element's styles
  with it. It would join the one stylesheet, so its order against `+style.css` needs deciding.
- **Disposing effects.** A live element's effects live as long as its page. Cross-document View
  Transitions mean a full load each time, so nothing disposes them yet. A live element that removes
  elements would need `define` to dispose effects in `disconnectedCallback`.
- **Re-rendering in live elements.** htl builds DOM once, and signals update it through `effect`.
  That covers hiding, toggling and text. A live element that re-renders a list would lose focus and
  input state. It would need a diffing renderer behind the same `html`, such as uhtml.
- **Meaning.** `<call-out>` means nothing to a screen reader, where `<aside>` is a landmark.
  `{@call-out role="note"}` works for one use. When the meaning matters on every use, that's what
  a component is for. Whether the docs should say so more strongly waits for a site that needs it.
- **Raw HTML.** A ` ```=html ` block ships as written, `<script>` included. It is the author's
  escape hatch, outside the `.live` files and the JavaScript they account for. The build report
  notes a page with a raw `<script>`. Whether to sanitize raw HTML waits until sites use it enough
  to say.
- **A social image.** `og:image` is left out until Sitez can make one. Each page's card would be
  drawn at build time by a function given `page` and `site`, or by an SVG template.
  Social sites don't take SVG, so the card has to be rasterized to PNG. That means a renderer
  such as resvg in the toolchain. Twitter's card becomes `summary_large_image` once there is one.
