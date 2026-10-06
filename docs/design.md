# Design

How Sitez is built. What it promises is in [idea.md](idea.md). Everything here can change
underneath without changing those promises.

Sitez 0.2 was a CLI with `+layout.js`, `.live` files and a reset. Step 21 of the plan made it a
Vite plugin. Step 22 moved it to `code/index.html`, `.html` and `.browser.js` names, and explicit
metadata. This page describes the code as it is.

## Toolchain

Sitez is a Vite plugin. A site adds it in `vite.config.js` and runs Vite's own commands from its
`package.json` (`docs/idea.md#commands`). The plugin takes no options. It reads the site, renders
every page, and has Vite build the CSS and the script.

```text
site
├── vite                  dev server, preview, Rolldown
└── @amitkaps/sitez       the plugin, and html for build code
    └── @amitkaps/markz   parser
```

`vite` is a peer dependency, which the site installs and pins beside Sitez. Its imports resolve as
Node's do, from the site's own `node_modules`, at build time and in `.browser.js` files alike.
Vite strips TypeScript's types with no setup, so `code/` takes `.ts` as well as `.js`.

Sitez began as a CLI that ran Vite itself, with the config nobody writes, and then as a plugin was
ruled out ([Install](#install)). It became one once `.browser.js` files could import npm packages.
Those imports need a bundler that resolves `node_modules`, so Vite stays. That ruled out the spike
without Vite that step 21 of the plan had planned. A plugin then costs the site one small file,
and saves Sitez its CLI, its preview server, `check`, `deploy` and finding the site's root.

**How `build` renders.** Vite's `buildApp` hook runs the plugin's build in place of Vite's own,
since a site has no `index.html` for Vite to build from yet. The plugin starts a Vite server
with no listener or watcher, made from the site's own config file, and renders every page through
its module runner, as `build` did before the plugin. Then two more Vite builds, from the same
config file, bundle the CSS and the script. So a plugin the site adds applies to rendering, to its
CSS and to its script alike. The plugin marks Vite's environments built, so Vite doesn't build
them again. `vite preview` serves `dist/`, and the plugin adds the two things a static host does
that Vite doesn't, a redirect from a folder to its slash and `404.html` with a 404 status.

**The site must name Sitez.** The check that the site's `package.json` named Sitez went with the
CLI. A site's `vite.config.js` imports `@amitkaps/sitez/vite`, and Vite fails to load a config
whose import isn't installed. So the import is the check, and it says which package is missing.

Ruled out:

- **Rendering in Vite's environments.** A build environment bundles modules and a dev server runs
  them where they are. Rendering from a bundle would move every module, and `import.meta.url`
  with it. The Markz site's Quality page reads its test cases relative to its own file. The plugin
  would also have to name every element as an entry before it had read the site, when the site's
  files say which of them a page needs. The server costs a second config load.
- **Bundling the CSS and script in the one client build.** It would be fewer builds, but both come
  from what the pages rendered, and the stylesheet has no code splitting where the script has
  chunks. Two builds keep `dist/`'s files and hashes as they were.
- **Vite+** (`vite-plus`). It bundles oxlint, oxfmt and a test runner with Vite, and makes a
  site's `node_modules` 137 MB. A site installs plain `vite`, about 31 MB, and the linters only if
  it wants them. Sitez itself still builds and tests with Vite+.
- **Options for the plugin.** Every option is configuration, which idea.md leaves out. When a
  feature seems to need one, the convention that makes it unnecessary comes first.

## Names in `code/`

`code/index.html` is the one name Sitez reads in `code/`. An element's files start with `@`, and
their suffix says when they run. Any other name is the site's own module or CSS
(`docs/idea.md#folders`).

- **`@` is Markz's own mark.** `{@call-out}` in text is `@call-out.html` in code, so the file for
  an element is found by reading the element.
- **The suffix names the time.** `.html` and `.html.js` write HTML once, at build time, in Node.
  `.browser.js` runs in every visitor's browser, where Node's modules don't exist. Sitez can't tell
  browser code from build code by reading plain JavaScript, so the name is the mark. Both halves
  of an element share its name, so they sort side by side.
- **`index.html` is Vite's own name** for the HTML a build starts from, and it links what the page
  needs, as Vite's does. `text/index.md` is the home page, and nothing else in `code/` is HTML a
  page starts from, so the two don't meet.
- **Elements are global.** Subfolders in `code/` only organize. One script holds every
  `.browser.js`, so a tag can only have one behavior. A tag that meant different markup in
  different folders would mean different things to the same CSS. So two files for one element
  fail, wherever they sit.

Sitez 0.2 began with other names, and they went because each was a rule with nothing behind it.

- **JS pages** (`code/blog/index.js` → `/blog/`). A page that lists posts is a text page holding an
  element, so a second kind of page bought nothing.
- **Capitalized layouts and components** (`Layout.js`, `CallOut.js`). They had to be translated
  from the element's name, and case is easy to get wrong on a case-insensitive disk.
- **`_` for modules.** Once nothing in `code/` is a page, a module needs no mark.
- **`+` for files Sitez reads** (`+layout.js`, `+style.css`). Once `index.html` links its own CSS,
  Sitez reads one file by name. A mark for a set of one is a rule to learn with nothing behind it.
- **`.live` for behavior.** It said the file was special, and not what made it so. "Browser" says
  where the file runs.
- **`@name.js` for build-time markup.** With static `.html` elements beside it, `.html.js` says it
  writes HTML as plainly. A bare `@name.js` now fails, so a file under the old name isn't ignored.
- **Elements found up the tree.** A `code/blog/@post-list.js` applied under `/blog/` only. It was a
  second rule for where a name means something, and one script had already made behavior global.

Other marks were weighed and ruled out.

- **`.server.js` and `.client.js`.** They're familiar from Nuxt and Remix, but a static site has no
  server. Nothing runs when a page is served, so the names would mislead about what code can do.
- **A sigil for the browser half** (`$tag-filter.js`, `~tag-filter.js`). It would sort an
  element's two files apart, and a symbol has to be taught where a word reads. `$`, `~`, `!` and
  `#` also mean something to shells.
- **Browser code in the markup file**, as a second export (`render` and `enhance`, or
  `TagFilter.browser`). One file would then run in Node and in the browser, and its imports would
  cross the boundary unseen. Keeping them apart would take a compiler that splits a module, and
  the browser half would be a function that Sitez wraps, which is a runtime again.
- **One `.html` file with a `<script>`** (WebC, a Vue or Svelte file). It was ruled out because
  loops and data need a template language. That reason didn't survive a second look. A
  `<script render>` holding what `.html.js` holds today, a `<style>` and a `<script browser>`
  holding the class is each its own module, so the import checks still hold. Rewriting
  amitkaps.github.io's `code/notes` this way showed what's left. The gain is mostly the CSS,
  which per-element CSS gives with no new shape (see [Open questions](#open-questions)). The costs are
  an extractor and virtual modules in the plugin, `.html` meaning two things, prose that reads
  `.html` only for HTML comments, and `d3` a few lines from browser code that must not import it.
  So it is deferred, not ruled out. It comes back if three files per element feel scattered once
  per-element CSS is in use.
- **One class, run at both times.** The build would run the element in a DOM in Node and save the
  HTML, and the browser would run it again. Its code would have to work twice, check whether it
  had already rendered, and couldn't read `data/` in the browser.
- **Declarative behavior** (`click: { "button[data-tab]": "select" }`). It is a framework that grows
  a verb for every interaction nobody planned. A site that wants one imports Alpine or htmx in a
  `.browser.js` file.
- **A `live` attribute on each use** (`{@tag-filter live}`). Behavior belongs to the element, not
  the use. It comes back only if load timing needs a per-use switch.
- **`from` or `src` for data.** `data` says what the element gets, and `src` already means a URL
  in HTML.

## The frame

Every page is `code/index.html` with the page in its `<slot>` (rule 2). The file is complete HTML,
so it opens in a browser as it is and shows the site. Everything a page shows besides its text is
written there, and the head is split by who knows each tag.

- **`index.html` writes what the site chooses.** That's `lang`, `charset`, `viewport`, icons, font
  preloads, the stylesheets, the header and the footer. Its `<title>` and description are the
  site's own, kept by any page that sets neither.
- **Sitez writes what follows from metadata.** It puts a page's `title` and `description` in
  place of `index.html`'s. It writes the canonical link, `og:title`, `og:description`, `og:url`,
  `og:type` (`website`), `twitter:card` (`summary`), `twitter:title` and `twitter:description`.
  Those seven repeat two values with no choice in them, so writing them by hand would only invite
  a typo.
- **Sitez adds what only the build knows.** That's each stylesheet's hashed name, the script on
  pages that use behavior, and a redirect's refresh.

Sitez's tags go at the end of the head, after what `index.html` wrote, so a site's own tags come
first. A frame with no `</head>` gets them after its description. The 404 page is served at URLs
that aren't its own, so it has no canonical link and no `og:url`. A page that sets neither `title`
nor `description` keeps the frame's, and its social tags say the same. A stylesheet link with a
relative path is a file in `code/`, and one that starts `/` or names a host is the site's own to
get right ([Bundling](#bundling)).

`index.html` fails the build for what would make every page wrong. A missing `lang`, `charset`,
`viewport`, `<title>` or description fails. So does a slot count other than one, and a canonical,
`og:` or `twitter:` tag, which would be on the page twice. Each message shows the line to add or
remove. Sitez isn't an HTML validator, so it checks nothing else.

`charset`, `viewport` and `lang` are the site's to write, and Sitez fails without them rather
than adding them. Without them a page's accented text garbles, a phone zooms out, and a screen
reader guesses the language. All three are the same on every page, so writing them once costs
three lines.

Ruled out:

- **Template syntax** (`{{ site.title }}`, as Jekyll writes). The file would be broken until
  something ran it, and its syntax a language to learn. Sitez fills the two tags whose values
  change by page, which needs none.
- **`+layout.js` with a `head` export.** It was JavaScript around markup that is mostly fixed.
  amitkaps.github.io's was 58 lines, most of them a nav loop and font preloads that HTML writes
  as plainly. It also needed rules for a layout that dropped or repeated its children.
- **Frames that nest**, found up the tree as `+layout.js` was. `index.html` is a whole page, so
  one can't go inside another, and a section varies through elements that read `page`. A second
  frame that replaces the first is a different question, open below.
- **`<main>` as the place for the page.** A frame often puts more around the page inside `<main>`,
  such as an `<article>`. `<slot>` is HTML's own word for where content goes.
- **The title as content.** Sitez 0.2 took `title` from the first heading and `summary` from the
  first paragraph, and the layout showed the title and a tagline. So a page's heading came from
  its metadata. Now metadata only reaches the head and the code, and a page writes its heading.
- **A title suffix** (`About | Amit Kapoor`). A page that wants it writes it.
- **A namespace for head keys** (`meta.title`). Only two keys reach the head, so a namespace buys
  nothing, and `meta` beside Markz's `metadata` would confuse both.
- **`name` and `lang` in `site.md`.** `lang` is `<html lang>`, where the frame writes it. `name`
  was read only by the feed.
- **Writing the Open Graph tags in `index.html`**, filled by Sitez as `<title>` is. It's more
  visible, and seven tags that hold the same two values.

## The runtime

A site imports one name from `sitez`, which is `html`, and only its `.html.js` files do. A
`.browser.js` file imports nothing from Sitez. Its default export is a class, and it works on the
DOM (rule 6).

The runtime lives in its own folder and never imports the rest of Sitez. If something other than
Sitez wants it, it moves out into a tiny package of its own. Until then, a second package would be
a second release cycle for one consumer.

```text
html`…` → a template value → Sitez's renderer → escaped HTML string
```

**At build time**, `html` records its strings and values and renders nothing. The renderer
(`src/runtime/render.ts`) turns that value into a string. It follows the HTML tokenizer through
the template, so each place a value can go means what HTML makes of it there. The rules began as
htl's, a library that makes DOM nodes from the same tag.

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

`false` in text writes nothing, where htl writes the word. `${cond && html`…`}` is how a template
says "maybe", and the word is never wanted.

Making DOM nodes at build time as well, as htl does, was ruled out. The build would need a DOM in
Node only to serialize it back to the string it wanted.

A template value is marked with `Symbol.for("sitez.template")`, not a class. The site's code loads
`sitez` through Vite's module runner, and the build loads it through Node. That makes two copies
of the module, and `instanceof` fails between them.

The renderer's job is correctness, not defense. The site's author writes all of its input, and a
title with `&` must not break the page. The browser's Sanitizer API doesn't apply. It doesn't
exist in Node, and it strips what it finds dangerous from HTML that's meant to be kept.

**In the browser**, there is no `sitez`. A `.browser.js` file default-exports a custom element's
class, and the site's script defines each under the tag its file's name gives. That's one
`customElements.define` line per element, which is all Sitez does in the browser.

A class is the web platform's own element, so the file says what it is with nothing from Sitez.
Writing one by hand repeats a few lines, and running setup twice when an element moves is easy to
get wrong. That boilerplate will go in elementz, a separate library for light-DOM elements, which
doesn't exist yet. Until then a site writes the class. Its `element(setup)` returns a class that
runs `setup` once per element and calls the cleanup `setup` returns on disconnect. elementz knows
nothing of Sitez, and a site uses it like any other npm package.

Earlier ways went or were ruled out.

- **A function as the default export**, which Sitez wrapped in a class with a once-guard. Nothing
  in the file said where its argument came from, or that it was an element at all.
- **`element` from `sitez`.** It would label the function and check nothing. It would bring back
  an import from Sitez in the browser, and `{html, element}` would read as a server half and a
  browser half of one library, which they aren't.
- **`define(name, setup)`** named the element a second time, after its file, and nothing checked
  that the two agreed. A file calling `customElements.define` itself has the same flaw.
- **`html` in the browser** was htl's, which made DOM nodes. So one name meant a string at build
  time and nodes in the browser. Behavior enhances HTML the build wrote, so it seldom makes nodes.
  An element that renders in the browser imports a renderer from npm.
- **`signal` and `effect`** held one value per element in every element written, which a field or
  a variable holds as well. A site whose state crosses elements imports a signals library from
  npm. elementz takes on signals or templates only when a real page needs them.

## Dev server

`vite` serves the site through Sitez's plugin. It renders a page when it's asked for, with the code
`build` uses, so the two can't disagree. Drafts are pages like any other. The site is read again
for every page, so a new or deleted file is a new or missing URL without a restart.

A page in dev is `index.html` with the page in its slot, served through Vite's HTML pipeline. Its
stylesheet links resolve to the files in `code/`, so Vite hot-replaces a change to CSS. A second
script imports the page's `.browser.js` files.

Anything else reloads the page.

- A change to code can change any page's HTML, even whether a link on another page is broken. So
  the server's modules are all invalidated.
- A custom element can't be defined twice, so a `.browser.js` file can't be swapped in place.
- Pages rendered at build time have no client state to keep, so a reload is the whole of HMR for
  them.

A failure renders as a page holding `build`'s message, with Vite's client on it. So fixing the
file reloads it, CSS included. A `url()` in the site's CSS that points at nothing is one such
failure. Vite hands it to the browser unchecked in dev, so `dev` checks the stylesheets itself as
a page is served, as `build` would fail on them.

`dev` is Vite's own server, so its dependency optimizer pre-bundles the packages a `.browser.js`
file imports, in the site's `node_modules/.vite`. The server `build` renders with turns it off.

## Build

Pages render through Vite's module runner, in `build` as in `dev`, not from a bundle. The site's
modules run from where they are, so `import.meta.url` still points at them. And `dev` and `build`
can't render a page differently. A rejected promise keeps its original error, whose stack names
the data module rather than the page. So the build wraps each render and names the page file.
Pages render concurrently. If the build gets slow, the fix is a faster build, not less HTML.

A page is Markz's HTML put in `index.html`'s slot, with each element that has a markup file
rendered by it. `html()` renders a view of the document in which each such element is a marker, as
each raw `=html` block is. So the only tags in its output are Markz's own, and replacing one is
exact. Markers are replaced innermost first, so an element's `children` holds its content already
rendered. `index.html`'s own elements and the ones an element's markup writes render the same way,
until none is left. An element that ends up inside itself fails, naming the chain.

Elements in HTML are found by a small tag scanner (`src/markup.ts`), not by a parser. It reads
what the HTML tokenizer would call a tag, so a `<` in a comment, a script or a value is text. An
element's content is given to it as a marker, and put back once its output has rendered. So an
element's output is read for the elements it wrote and never for the ones it was handed, which
would render twice. The chain of elements an output is inside is what the cycle check reads. The
frame renders for each page, since its elements read `page`, and the page's HTML goes in last.

In HTML an element is a tag with a markup file. A tag with a hyphen and no file is plain, and
holds whatever elements it holds. An element must be closed, or written `<x />`, which HTML itself
ignores on a custom element. An element with no content, or only space, has none. An attribute
written twice keeps its first, as HTML does, where Markz keeps its last.

An `.html` element is its file's HTML, with its content in place of its `<slot>`. An `.html.js`
element is called with three kinds of props.

- Its attributes, as strings. Classes accumulate, and any other key's last value wins.
- Its content, rendered first, as `children`.
- The page's `page`, `pages` and `site`. An attribute named `children` or one of those fails.

A `data` attribute is read before the call. Its path resolves in `data/`, and the parsed JSON
replaces the string. One that isn't there fails, naming the line. A `.html` element gets no data,
so the attribute is read and left off the page all the same.

An `.html.js` file's default export returns a template, and the build renders it. Its output is
trimmed, so a template written across lines can sit inside a paragraph. Sitez writes the element
around it ([Wrapping](#wrapping)). A raw block is written as it is. `build` prints Markz's
warnings, and they never fail it.

`page` is a page's metadata block and its `url`, and nothing else. `pages` is every page's, read
before any page renders. `site` is `site.md`'s block. Sitez adds no other key, so whatever code
reads is written in a file.

### Wrapping

An element's markup file returns its inner HTML, and Sitez writes the element around it with its
attributes. A `data` attribute is left out, since the element has read it. So the tag is always in
the page, where CSS and the element's `.browser.js` look for it. Wrapping costs something for each
kind of element.

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
  a browser breaks. The check reads the output after nesting, since inner elements render first.
  It runs wherever the element is used inline, in a heading or a table cell too, since a tag
  means the same everywhere.

Sitez adds no CSS, and CSS has no selector for custom elements, or for elements used as blocks. So
a block element costs one line in the site's CSS.

Replacing the tag with the element's output was ruled out. Sitez first did that, and a component
could return `<aside class="call-out">`. The element's name was gone from the page, so its
behavior never ran and its CSS never matched. A tag that is always there is worth more than
choosing the root element.

Passing the kind of use (inline, leaf or container) to the element was ruled out. Sitez reads it
from Markz to run the check above, and the element never sees it. An element that renders
differently by where it's used is two elements, such as `{@cite}` and `{@cite-block}`. So a tag
means the same everywhere, for CSS and for its `.browser.js`. A `kind` prop would also be a fifth
reserved attribute name, and `form` is already an HTML attribute. It can be added later without
breaking an element, and taking it away couldn't.

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
`public/` and Sitez's own files. That catches what `index.html`, elements and raw blocks write. A
site link there has to be exact (`/blog/`), since the HTML is finished and nothing rewrites it.
Only start tags are read. So HTML shown as text, whose `<` is escaped, and code inside `<script>`
aren't taken for links. A link a `.browser.js` file writes exists only in the browser and isn't
checked. That's one more reason behavior enhances rather than generates.

### Redirects

A page that moved lists its old URLs under `redirects`, and `build` writes a page at each. It is
`index.html` rendered for the page it reaches, with that page's `page`, so the frame's elements
never see a page with no metadata. Its slot holds a link to the new URL, and its head refreshes
there at once, names it canonical, and asks not to be indexed. Search engines read an instant
refresh as a permanent redirect. It works on every static host and in `preview`, and `dev`
answers an old URL with a 301.

- An old URL is a page's URL (`/old/`, or `/old` read as one) or an old `.html` file. Any other
  extension is a file, which a page can't stand in for.
- It fails when a page has it, drafts included, or when another page lists it. It also fails when
  a file in `public/` is already there.
- An old `/x.html` fails while a page has `/x/`. Hosts serve `x.html` at `/x` as well, so the
  redirect page would stand in front of that page, and `/x` would reach it through a refresh.
  Cloudflare sends `/x.html` to `/x/` by itself, so a page that only lost its `.html` needs no
  redirect. GitHub Pages doesn't, and there that old URL is lost. A clean `/x` mattered more.
- A link to an old URL fails, naming the page it reaches. Redirects are for links from elsewhere,
  so nothing on the site goes through one.
- A draft's redirects aren't written, since the page they reach isn't.

Ruled out:

- **A URL in a page's metadata** (Jekyll's `permalink`, an Astro entry's `slug`). The path would
  stop being the URL (rule 2), and every link check would need a second source of URLs.
- **A host's redirect file** (`_redirects` in `public/`). Only some hosts read it, GitHub Pages
  and `preview` among those that don't, and Sitez can't check it. A name starting `_` is skipped
  in `public/` as in every folder, so a site can't ship one. That's open, in
  [Open questions](#open-questions).
- **A stub file in `text/` for each old URL.** A site that moved its pages into folders would
  get one file per old URL, and the stub would be a page with no content.

Real 301s, written into a host's redirect file beside the stub pages, could come later without
changing the key.

### Outputs

`build` writes a page for each text file and each redirect, the 404 page as `404.html`, the CSS
and the script, and `public/` as it is. The 404 page is left out of `pages`, since nothing lists or
links to it.

Ruled out:

- **`sitemap.xml`.** Every site got one, with no way out. Search engines find a small site's pages
  by its links, and a sitemap page for humans is the site's own, written from `pages`.
- **`feed.xml`.** Any page with a `date` joined it, so one key both ordered pages and published
  them. amitkaps.com dated its essays only to order them. A feed needs its own decisions, such as
  which pages and how much of each, and those are a site's.

## Behavior

An element with behavior is a custom element, and its tag is the element's own name. It isn't
`<div data-component="call-out">`. The browser finds and upgrades a custom element by itself,
where a `div` would need Sitez's runtime to scan for it and watch for new ones. A custom element
is also what Markz writes.

Sitez finds the `.browser.js` files a page uses by scanning its finished HTML for their tags.
Elements with behavior nest without any effort, since custom elements do.

Behavior adds to HTML the build wrote, and doesn't draw its own. On a slow load its module can run
after first paint, so markup it inserted would move the page. In the spike, filter buttons the
script prepended pushed the teaching grid down. So the element's markup file writes what it shows.
`@filter-grid.html.js` writes the buttons and the grid's children, and `@filter-grid.browser.js`
wires the buttons. Sitez writes `<filter-grid>` around the markup, so the script always finds its
element.

The only data behavior gets is the page, which means its element's children and attributes. There
are no props to serialize, nothing is sent twice, and there is nothing to hydrate. An element that
needs rows of data will get them as a JSON `<script>` child, once a site needs one. That will need
rules for what crosses (a `Date` becomes a string in JSON) and how big it may get.

The two sides of the boundary fail apart. Build-time code that imports a `.browser.js` file would
crash Node. A `.browser.js` file that imports an `.html.js` file would bundle whatever that
imports. Both fail the build, naming the import. A module with no Node imports can be used by
both, such as a `slug.js` that turns a title into an id. One that imports `sitez` is build code,
since `html` renders at build time, and a `.browser.js` file that imports it fails.

Sitez checks a `.browser.js` file's shape by reading its syntax, since it can't run the file in
Node. A class written in the export passes, and so does a call to a library that makes one. A call
that returns something else fails only in the browser, where `customElements.define` throws. A
value, a bare function or a name fails the build. The message for a bare function points to
`connectedCallback`.

## Bundling

Once every page has rendered, Rolldown builds what the browser downloads besides the HTML.
Nothing it builds reaches `dist/` until every page has.

Each stylesheet `index.html` links becomes one file, `[name].[hash].css`, with what it
`@import`s, and the link is rewritten to it. A link is a file in `code/` when its path is
relative, and it fails when the file isn't there. A path that starts `/` or names a host is left
as written. Each stylesheet is a build of its own, named for its file. Most sites link one. In
`dev` the link points at the file, which Vite serves and replaces as it changes. CSS is small and needed before anything paints, so one file,
cached by the first page and reused by every other, costs less than a split that saves a few bytes
a page. The site's CSS is unlayered and Sitez adds none, so `@layer` and `!important` mean what
they always mean. A `url()` in it is bundled as `assets/[name].[hash][ext]`. Vite would ship one
it can't resolve as written, with only a warning, so Sitez fails the build instead.

Sitez's reset went. It was a `@layer reset` of Sitez's look before the site's CSS, and
amitkaps.github.io's first rules undid it. A look a site didn't write is the kind of value Sitez
no longer fills in (promise 4).

A site has at most one script, `script.[hash].js`, for the same reason as its CSS. It defines every
element with behavior that a built page uses, each under the tag its file's name gives. Only a page
with such an element loads it, so a page with none loads no JavaScript. Defining a tag the page
doesn't have registers a class that never runs, which costs nothing worth counting. The report
shows the script once, on the `common` row, and each page's notes name its elements with
behavior.

One script means a large library loads inside its element. A package imported at the top goes into
the script, which every page with behavior loads. That's right for a small one, and the report's
`common` row shows what it costs. `await import("d3")` inside the element becomes a hashed chunk
of its own, fetched only where the element connects. A URL imported at the top fails, since the
browser would fetch it before the script runs on every page with behavior. One imported inside is
left as it is, and the report names its host.

Two other ways were ruled out.

- **A script for each page**, with what pages share split into `common.js`. It saved each page a
  few hundred bytes, and cost per-page entries, chunk splitting, `modulepreload` links and a
  report column. It paid off while signals and htl were the shared part, and both are gone.
- **Inlining the script** in each page. It saves a request, and repeats the bytes on every page.
  A site with a Content-Security-Policy would also have to allow inline scripts.

File names carry a content hash (`script.3f9a1c.js`), so a new deploy is never served from a stale
cache. `dev` still loads each page's own `.browser.js` files, since it serves modules as they are
and has no file to cache. The build sets production mode itself.

## Check, preview and deploy

Sitez has no commands of its own. `vite preview` serves `dist/`, and Sitez's plugin adds what a
static host does that Vite doesn't, such as serving `404.html` with a 404. Formatting and linting
are the site's own scripts, with oxfmt and oxlint as its own dependencies. oxfmt formats the HTML
inside `html` templates, and its Markdown output is Markz's canonical form.

Ruled out:

- **`sitez check`.** It ran oxfmt and oxlint as Sitez's dependencies, and reported Markz's
  warnings as problems. That put two linters in every site's install, and a wrapper between the
  author and tools they can run directly. `build` prints Markz's warnings.
- **`sitez preview`.** It was a static server of Sitez's own, beside Vite's.

## Install

Sitez is installed in each site, never globally. `package.json` names Sitez and Vite, and
`npm install` puts those versions in `node_modules`. So the author's machine and the host build
with the same Sitez by construction. The report's last line names the version that ran.

`vite.config.js` sits at the site's root, beside `site.md`, and Vite's root is the site's. So
several sites in one repo are several folders, each with its own config. A site kept in `site/`
inside its repo leaves the repo's own files at the top, which is a habit, not a rule.

Ruled out:

- **A global install.** It was the first design, with no `package.json`, and nothing in the repo
  said which version built the site.
- **A single binary.** It was for installing without Node, and a site with a `package.json` needs
  Node anyway.
- **A CLI that runs Vite itself.** It was Sitez 0.2, and it kept Vite out of sight so the
  toolchain was Sitez's to swap. Once `.browser.js` files import npm packages, Vite isn't
  swappable, and the CLI was a second name for each of Vite's commands. It also needed its own
  check that the site's `package.json` named Sitez, which the plugin's import in `vite.config.js`
  makes ([Toolchain](#toolchain)). The cost of the plugin is that a site sees Vite, and can add other plugins to its config.
- **A version in `site.md`.** It holds metadata, never settings, and npm already pins packages.

## Deploy

A site deploys from Cloudflare, which builds the repo itself, as prose's site does. Its build
command is `npm run build`, and its deploy command `npx wrangler deploy` runs Wrangler on
Cloudflare's machine. So neither Sitez nor a site depends on Wrangler, and a site needs no Sitez
command or setting to deploy.

Ruled out:

- **A deploy command.** Each host has its own one-time setup, such as a domain, a 404 page or a
  config file, and a command covers one step of it. Steps for one host are simpler than a command
  for several. GitHub Pages was the other host, and Sitez's sites are moving off it.
- **A deploy target in `site.md`** (`deploy.github`, `deploy.cloudflare`). Markz reads dotted
  keys, but a target is a setting, and `site.md` holds metadata.

## Release

Sitez is published to npm as `@amitkaps/sitez`, the name a site's code and `vite.config.js`
import. A release tags a version, and the `release` workflow does the rest
(`.github/workflows/release.yml`). It runs the checks, packs the tarball, stages it on npm, and
attaches it to a GitHub Release.

Bump `version` in `package.json` and push to `main`. Then tag the release and push the tag.

```sh
git tag v0.2.0 && git push origin v0.2.0
```

The workflow stages each version with npm's trusted publishing, which uses OIDC and adds
provenance. There's no token, and CI can't release on its own. A maintainer approves each version
with 2FA, in the **Staged Packages** tab on npmjs.com or with `npm stage approve <id>`.

Set the trusted publisher up once, in the package's settings on npmjs.com. Name the repository
`amitkaps/sitez` and the workflow `release.yml`. Leave direct publishing and dist-tags unchecked,
so staging is all it can do. npm may not take the setting before the package exists. Then publish
the first version by hand, outside the repository, because `npm` refuses to run where
`devEngines` names pnpm.

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/sitez/amitkaps-sitez-<version>.tgz --access public
```

Ruled out:

- **The plain name `sitez`.** npm refuses it as too similar to `vite`, which also keeps anyone
  else from taking it. Publishing the scoped package for sites to install as
  `"sitez": "npm:@amitkaps/sitez"` was ruled out too. Every site would need that line, and the
  error naming it would have to explain it.
- **Installing from GitHub** (`github:amitkaps/sitez#v0.2.0`). `dist/` isn't committed, so each
  install would build Sitez, and pnpm runs no dependency's build scripts unless the site allows
  them.

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
templates. The spike that decided it is in the repo's history, at
[spike/](https://github.com/amitkaps/sitez/tree/465e738/spike).

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
  pages where its tag appears, as Sitez does with `.browser.js` files. Its `<slot>` places content
  in light DOM, as Sitez's does.
- **Vite** starts a build from `index.html`, which links what the page needs. Sitez's
  `code/index.html` is that file, with a slot for each page.

What Sitez adds is the combination of text-first pages, behavior paired with markup by file name,
and static output.

## Open questions

- **Types.** A site has had no type checker since svelte-check went with Svelte. The likely one is
  `tsc` with `checkJs` over `code/`, strict but asking for no annotations. It comes once a site's
  mistakes call for it.
- **Misspelled elements.** An element with no files is a plain HTML element, which is legitimate.
  So a misspelled name silently does nothing. A warning could catch it, for an element with no
  files and no selector in the site's CSS. That's worth it if it isn't too fragile.
- **Per-element CSS.** An `@notes-treemap.css` beside the element's other files would keep its
  styles with it. amitkaps.github.io's treemap has about 70 lines in `style.css`, far from the
  markup that writes `.frame` and `.controls`. The likely convention has three parts.
  - Each rule nests under the element's tag (`notes-treemap { & .frame { … } }`), so the name is
    written once. A top-level rule that doesn't start with the tag fails, naming the rule.
  - Sitez puts the file in `@layer elements`. Unlayered CSS beats every layer, so element CSS
    outside a layer would beat a layered site's own CSS. In a layer, an unlayered site has the
    last word. A layered site lists `elements` in its order, as in
    `@layer reset, base, elements, site;`.
  - It ships only to pages that use the element, as a `.browser.js` file does.

  Nesting isn't scoping. `notes-treemap .frame` also reaches a `.frame` in an element nested
  inside it. `@scope (notes-treemap)` doesn't stop that either. Only a lower boundary does
  (`to (…)`), and CSS has no selector for "any other element" to put there. What `@scope` changes
  is specificity, since its root adds none. Vite's default target is Baseline widely available
  (Chrome 111, Firefox 114, Safari 16.4 in Vite 8). Lightning CSS flattens nesting for it, and
  passes `@scope` through as written, so a browser without `@scope` drops the whole block. `@scope`
  was newly available only in late 2025. So nesting is the convention. No page on the one site nests
  elements that share a class name. Step 25 of the [plan](plan.md) tries the convention first.

- **Re-rendering behavior.** Behavior changes the nodes the build wrote. That covers hiding,
  toggling and text. An element that re-renders a list would lose focus and input state, and would
  import a diffing renderer, such as uhtml, from npm.
- **Meaning.** `<call-out>` means nothing to a screen reader, where `<aside>` is a landmark.
  `{@call-out role="note"}` works for one use. When the meaning matters on every use, that's what
  a markup file is for. Whether the docs should say so more strongly waits for a site that needs
  it.
- **Raw HTML.** A ` ```=html ` block ships as written, `<script>` included. It is the author's
  escape hatch, outside the `.browser.js` files and the JavaScript they account for. The build
  report notes a page with a raw `<script>`. Whether to sanitize raw HTML waits until sites use it
  enough to say.
- **Host files in `public/`.** Cloudflare reads `_headers` and `_redirects` from the folder it
  serves, and a name starting `_` is skipped in every folder (`docs/idea.md#folders`). So a site
  can't ship either. The rule could leave `public/` out, since it copies files as they are and
  `_` there means nothing to Sitez. That's the human's call, since the idea says "every folder".
- **A second frame.** amitkaps.com/stories/ is one page with its own header, footer, stylesheet
  and font, sharing nothing with the site's frame. Through the one frame it would take the site's
  look, and its CSS and font would reach every page. The narrow rule would be that
  `code/stories/index.html` frames the pages in `text/stories/`, with no nesting. The heads
  wouldn't drift, since they're meant to differ. The cost is that one folder in `code/` means
  something, and the stylesheet is one per frame instead of one per site. Until the page is
  merged, its built HTML goes in `public/stories/`, which Sitez copies as it is. The rule waits
  for that merge, and for the decision to keep the page's own look.
- **A social image.** `og:image` is left out until Sitez can make one. Each page's card would be
  drawn at build time by a function given `page` and `site`, or by an SVG template. Social sites
  don't take SVG, so the card has to be rasterized to PNG. That means a renderer such as resvg in
  the toolchain. Twitter's card becomes `summary_large_image` once there is one. A simpler first
  step is an `image` key naming a picture the page already has. amitkaps.com/stories/ is the
  known case, a page shared with a large card of its book cover.
