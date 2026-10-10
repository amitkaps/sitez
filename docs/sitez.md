# Sitez

How Sitez is built: the site layer, with its folders, the frame, links, redirects, bundling and
the dev server. What it promises is in [design.md](design.md), and everything here can change
underneath without changing those promises. The element is [elementz.md](elementz.md)'s.

Sitez 0.2 was a CLI with `+layout.js`, `.live` files and a reset. Sitez 0.3 made it a
Vite plugin, and moved it to `code/index.html` and explicit metadata. Since then an element is one
`@name.html` file, and its code is `src/elementz/`.

## Where Sitez sits

Sitez is the top of four layers, and each adds one thing to the one below it. The split is a
direction, not packages yet. Sitez has one site, and a layer earns its own package when a second
one uses it.

| Layer    | Adds                                                             | Knows nothing of     |
| -------- | ---------------------------------------------------------------- | -------------------- |
| markz    | Markdown's syntax, as an AST with positions. It never evaluates. | elements, pages      |
| elementz | the element, one `@name.html` file, rendered and run             | Markdown, files      |
| pagez    | the page, one Markz file and its elements in, one HTML file out  | other pages, folders |
| sitez    | the site: folders, pages that link, Vite, dev and deploy         |                      |

- **elementz** owns `html`, the element file, rendering nested elements inside-out, element CSS
  and the browser runtime ([elementz.md](elementz.md)). Its first form is `src/elementz/` in
  Sitez, which imports nothing from the rest of Sitez. That boundary is the layer, kept honest
  without a package to publish.
- **pagez** owns Markz to HTML, the head from metadata and the frame ([its design](https://github.com/amitkaps/pagez/blob/main/docs/design.md)). It
  gets built when a page needs it, and amitkaps.com/stories, a page with its own look, may be that
  page ([Open questions](#open-questions), "A second frame").
- **sitez** keeps what only a site has, such as discovery, links, redirects, `data/`, bundling and
  the dev server.

A host gives elementz its context. pagez gives `page`, and sitez adds `pages` and `site`. So an
element that reads only `page` works in both. Splitting into packages was ruled out for now. It
would mean three repos to release in step for one person, and an API designed for a consumer
that doesn't exist yet.

## Toolchain

Sitez is a Vite plugin, run with Vite+. A site adds it in `vite.config.js` and runs `vp`'s commands from its
`package.json` (`docs/design.md#commands`). The plugin takes no options. It reads the site, renders
every page, and has Vite build the CSS and the script.

```text
site
├── vite-plus             dev server, preview, Rolldown, oxfmt, oxlint
└── @amitkaps/sitez       the plugin, and html for build code
    └── @amitkaps/markz   parser
```

`vite-plus` is a peer dependency, which the site installs and pins beside Sitez, and Sitez imports
Vite's API from it. So a site needs no `vite` of its own. A site that adds a plugin wanting `vite`
points `vite` at Vite+'s build with an override, as every repository at
[ship](https://ship.amitkaps.com) does. Imports resolve as Node's do, from the site's own
`node_modules`, at build time and in element scripts alike.
Vite strips TypeScript's types with no setup, so `code/` takes `.ts` as well as `.js`.

Sitez began as a CLI that ran Vite itself, with the config nobody writes, and then as a plugin was
ruled out ([Install](#install)). It became one once behavior could import npm packages.
Those imports need a bundler that resolves `node_modules`, so Vite stays. That ruled out a spike
without Vite, which the plan had held. A plugin then costs the site one small file,
and saves Sitez its CLI, its preview server, `check`, `deploy` and finding the site's root.

**How `build` renders.** Vite's `buildApp` hook runs the plugin's build in place of Vite's own,
since a site has no `index.html` for Vite to build from yet. The plugin starts a Vite server
with no listener or watcher, made from the site's own config file, and renders every page through
its module runner, as `build` did before the plugin. Then two more Vite builds, from the same
config file, bundle the CSS and the script. So a plugin the site adds applies to rendering, to its
CSS and to its script alike. The plugin marks Vite's environments built, so Vite doesn't build
them again. `vp preview` serves `dist/`, and the plugin adds the two things a static host does
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
- **Plain `vite`.** A site's `node_modules` is about 31 MB on it, against 158 MB on Vite+, which
  bundles oxlint, oxfmt and a test runner. Vite+ won anyway, since every repository runs one
  toolchain, so a site formats, lints and builds the way Sitez itself does. Sitez 0.3 ran on plain
  `vite`.
- **Options for the plugin.** Every option is configuration, which design.md leaves out. When a
  feature seems to need one, the convention that makes it unnecessary comes first.

## Names in `code/`

`code/index.html` is the one name Sitez reads in `code/`. An element's file is `@name.html`. Any
other name is the site's own module or CSS (`docs/design.md#folders`).

- **`@` is Markz's own mark.** `{@call-out}` in text is `@call-out.html` in code, so the file for
  an element is found by reading the element.
- **Where a part sits says when it runs**, inside the file ([elementz.md](elementz.md#the-file)).
  So the name needs no suffix for the time.
- **`index.html` is Vite's own name** for the HTML a build starts from, and it links what the page
  needs, as Vite's does. `text/index.md` is the home page, and nothing else in `code/` is HTML a
  page starts from, so the two don't meet.
- **Elements are global.** Subfolders in `code/` only organize. One script holds every element's
  behavior, so a tag can only have one. A tag that meant different markup in different folders
  would mean different things to the same CSS. So two files for one element fail, wherever they
  sit.

Sitez began with other names, and they went because each was a rule with nothing behind it.

- **JS pages** (`code/blog/index.js` → `/blog/`). A page that lists posts is a text page holding an
  element, so a second kind of page bought nothing.
- **Capitalized layouts and components** (`Layout.js`, `CallOut.js`). They had to be translated
  from the element's name, and case is easy to get wrong on a case-insensitive disk.
- **`_` for modules.** Once nothing in `code/` is a page, a module needs no mark.
- **`+` for files Sitez reads** (`+layout.js`, `+style.css`). Once `index.html` links its own CSS,
  Sitez reads one file by name. A mark for a set of one is a rule to learn with nothing behind it.
- **`.live`, then `.browser.js`, for behavior, and `@name.js`, then `.html.js`, for build
  markup.** Each named the time in the file's suffix. One file, where a part's place names the
  time, replaced them. A leftover `.html.js`, `.browser.js` or bare `@name.js` fails, naming the
  `@name.html` that replaces it.
- **Elements found up the tree.** A `code/blog/@post-list.js` applied under `/blog/` only. It was a
  second rule for where a name means something, and one script had already made behavior global.

Other marks were weighed and ruled out.

- **`.server.js` and `.client.js`.** They're familiar from Nuxt and Remix, but a static site has no
  server. Nothing runs when a page is served, so the names would mislead about what code can do.
- **A sigil for the browser half** (`$tag-filter.js`, `~tag-filter.js`). A symbol has to be taught
  where a word reads, and `$`, `~`, `!` and `#` also mean something to shells.
- **Browser code as a second export of a build module** (`render` and `enhance`). One module
  would run in Node and in the browser, and its imports would cross the boundary unseen. An
  element file keeps them apart by position, and Sitez cuts each script into its own module.
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

## Dev server

`vp dev` serves the site through Sitez's plugin. It renders a page when it's asked for, with the code
`build` uses, so the two can't disagree. Drafts are pages like any other. The site is read again
for every page, so a new or deleted file is a new or missing URL without a restart.

A page in dev is `index.html` with the page in its slot, served through Vite's HTML pipeline. Its
stylesheet links resolve to the files in `code/`, so Vite hot-replaces a change to CSS. A second
script imports the page's element scripts and elementz's runtime.

Anything else reloads the page.

- A change to code can change any page's HTML, even whether a link on another page is broken. So
  the server's modules are all invalidated.
- A custom element can't be defined twice, so an element's script can't be swapped in place.
- Pages rendered at build time have no client state to keep, so a reload is the whole of HMR for
  them.

A failure renders as a page holding `build`'s message, with Vite's client on it. So fixing the
file reloads it, CSS included. A `url()` in the site's CSS that points at nothing is one such
failure. Vite hands it to the browser unchecked in dev, so `dev` checks the stylesheets itself as
a page is served, as `build` would fail on them.

`dev` is Vite's own server, so its dependency optimizer pre-bundles the packages an element's
script imports, in the site's `node_modules/.vite`. The server `build` renders with turns it off.

## Build

Pages render through Vite's module runner, in `build` as in `dev`, not from a bundle. The site's
modules run from where they are, so `import.meta.url` still points at them. And `dev` and `build`
can't render a page differently. The build wraps each render and names the page file, since an
error's stack names the data module rather than the page.

A page is Markz's HTML put in `index.html`'s slot, with each element that has a file rendered by
elementz ([elementz.md](elementz.md#nesting-and-wrapping)). `html()` renders a view of the
document in which each such element is a marker, as each raw `=html` block is. So the only tags in
its output are Markz's own, and replacing one is exact. `index.html`'s own elements and the ones
an element writes render the same way. The frame renders for each page, since its elements read
`page`, and the page's HTML goes in last.

Elements in HTML are found by a small tag scanner (`src/markup.ts`), not by a parser. It reads
what the HTML tokenizer would call a tag, so a `<` in a comment, a script or a value is text. An
element's content is given to it as a marker, and put back once its output has rendered. So an
element's output is read for the elements it wrote and never for the ones it was handed, which
would render twice.

Sitez gives each element `page`, `pages` and `site` as well as its `attrs`. A `data` attribute is
read first. Its path resolves in `data/`, and the parsed JSON replaces the string. One that isn't
there fails, naming the line. `page` is a page's metadata block and its `url`, and nothing else.
`pages` is every page's, read before any page renders. `site` is `site.md`'s block. Sitez adds no
other key, so whatever code reads is written in a file.

Sitez reads from Markz how each element is used, and fails an inline element whose output would
end its paragraph ([elementz.md](elementz.md#wrapping)). A raw block is written as it is. `build`
prints Markz's warnings, and they never fail it.

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
aren't taken for links. A link an element's `setup` writes exists only in the browser and isn't
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

## Bundling

Once every page has rendered, Rolldown builds what the browser downloads besides the HTML.
Nothing it builds reaches `dist/` until every page has.

Each stylesheet `index.html` links becomes one file, `[name].[hash].css`, with what it
`@import`s, and the link is rewritten to it. A link is a file in `code/` when its path is
relative, and it fails when the file isn't there. A path that starts `/` or names a host is left
as written. Each stylesheet is a build of its own, named for its file. Most sites link one. In
`dev` the link points at the file, which Vite serves and replaces as it changes. CSS is small and
needed before anything paints, so one file, cached by the first page and reused by every other,
costs less than a split that saves a few bytes a page. A `url()` in it is bundled as `assets/[name].[hash][ext]`. Vite would ship one
it can't resolve as written, with only a warning, so Sitez fails the build instead.

Sitez's reset went. It was a `@layer reset` of Sitez's look before the site's CSS, and
amitkaps.github.io's first rules undid it. A look a site didn't write is the kind of value Sitez
no longer fills in (promise 4).

Element CSS is the one thing Sitez adds. The `<style>` of every element a built page uses goes in
`@layer elements`, in the first stylesheet `index.html` links, so it is cached with the site's
([elementz.md](elementz.md#css)). Sitez adds no other CSS, so `@layer` and `!important` mean what
they always mean.

A site has at most one script, `script.[hash].js`, for the same reason as its CSS. It holds
elementz's runtime and the `setup` of every element a built page uses, each defined under the tag
its file's name gives. Only a page
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
cache. `dev` still loads each page's own element scripts, since it serves modules as they are
and has no file to cache. The build sets production mode itself.

## Check, preview and deploy

Sitez has no commands of its own. `vp preview` serves `dist/`, and Sitez's plugin adds what a
static host does that Vite doesn't, such as serving `404.html` with a 404. Formatting and linting
are the site's own scripts, with oxfmt and oxlint as its own dependencies. oxfmt formats the HTML
inside `html` templates, and its Markdown output is Markz's canonical form.

Ruled out:

- **`sitez check`.** It ran oxfmt and oxlint as Sitez's dependencies, and reported Markz's
  warnings as problems. That put two linters in every site's install, and a wrapper between the
  author and tools they can run directly. `build` prints Markz's warnings.
- **`sitez preview`.** It was a static server of Sitez's own, beside Vite's.

## Install

Sitez is installed in each site, never globally. `package.json` names Sitez and Vite+, and
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
  toolchain was Sitez's to swap. Once element scripts import npm packages, Vite isn't
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
import. It releases the way every package does, as [ship's standard](https://github.com/amitkaps/ship/blob/main/docs/standard.md#releases)
says: `pnpm release sitez X.Y.Z`, run from ship, opens a pull request that bumps `version`, and
its description is the release's summary. Merging it runs the `release` workflow, which stages
the version on npm for a maintainer to approve, then tags the commit and publishes a GitHub
Release with notes from the pull requests' labels.

Markz is a dev dependency, bundled into `dist/`, so a site never installs a second Markz, and
Sitez releases without waiting on one. A new Markz reaches sites in Sitez's next release.

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

## Open questions

- **Types.** A site has had no type checker since svelte-check went with Svelte. The likely one is
  `tsc` with `checkJs` over `code/`, strict but asking for no annotations. It comes once a site's
  mistakes call for it.
- **Misspelled elements.** An element with no files is a plain HTML element, which is legitimate.
  So a misspelled name silently does nothing. A warning could catch it, for an element with no
  files and no selector in the site's CSS. That's worth it if it isn't too fragile.
- **Raw HTML.** A ` ```=html ` block ships as written, `<script>` included. It is the author's
  escape hatch, outside the element scripts and the JavaScript they account for. The build
  report notes a page with a raw `<script>`. Whether to sanitize raw HTML waits until sites use it
  enough to say.
- **Host files in `public/`.** Cloudflare reads `_headers` and `_redirects` from the folder it
  serves, and a name starting `_` is skipped in every folder (`docs/design.md#folders`). So a site
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
