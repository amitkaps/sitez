# Redesign

An exploration, not a decision: Sitez without Svelte. Pages, layouts and the components prose
uses render to HTML at build time as plain JavaScript functions; islands become custom elements
that run only in the browser. Sitez shrinks to a Vite plugin over Markz, with one small runtime
of its own. The spike on amitkaps.github.io's `/teaching/` page held
([spike/README.md](../spike/README.md)), so this folds into [idea.md](idea.md) and
[design.md](design.md) next, and goes.

## The contract

- Pages, layouts and components render HTML at build time. A layout is never a browser component.
- Browser behavior lives only in islands: custom elements, defined in `*.island.js` files.
- An island enhances HTML the build rendered. It never builds a page's first HTML.
- An island reads its children and its attributes. Nothing else crosses into the browser.
- A page with no island tags loads no JavaScript.
- `html` escapes every value it interpolates. A function in a template rendered at build time fails
  the build, naming the file.
- The client runtime is a few primitives (`html`, `signal`, `effect`, `define`), not an app
  framework.

## Why

Most of Sitez's Svelte machinery exists to render an island on the server and then hydrate it:
reading browser behavior from Svelte's AST (`islands.ts`), wrapping every component in the server
render (`runtime/server.ts` and the `Island*.svelte` files), serializing props with `devalue`,
passing children back through `createRawSnippet`, and compiling prose _as_ Svelte so prose and
patterns share one renderer (`prose.ts`). Six of Sitez's seven dependencies and about a third of
`src/` serve that one feature.

Sitez's real sites don't need it. amitkaps.github.io, the site Sitez is tested against, has one
kind of interactivity: three grids (workshops, talks, teaching) filtered by category. The grid is
already complete HTML; filtering only hides items. Hydrating a Svelte island for it ships about
11 KB of runtime on each of those pages and sends the grid's data twice: once as HTML and again as
props, so the browser can draw what the build already drew.

If islands never render on the server, none of that machinery is needed.

## Folders

```text
site/
├── site.md               the site's metadata
├── text/                 Markdown, one page per file
│   ├── index.md          → /
│   └── blog/hello.md     → /blog/hello/
├── code/                 everything that runs at build time or in the browser
│   ├── Layout.js         wraps every page
│   ├── CallOut.js        renders {@call-out}
│   ├── filter-grid.island.js
│   ├── style.css
│   └── blog/
│       ├── index.js      → /blog/
│       └── Layout.js     wraps /blog/*
├── data/                 JSON the code imports, if the site has any
└── public/               copied as it is
```

`prose/` and `pattern/` become `text/` and `code/`. `prose` is the name of another of the author's
projects, and `pattern` named what the folder held under Svelte, not what it holds now: JS pages,
layouts, components, islands and the stylesheet.

**A folder is named for the kind of file written in it**, so a file's extension says where it
goes:

| Folder    | Holds                                             | Because                                     |
| --------- | ------------------------------------------------- | ------------------------------------------- |
| `text/`   | `.md`                                             | words, read as they are and on GitHub       |
| `code/`   | `.js`, `.css`, and the fonts and images CSS names | what runs or styles, processed by the build |
| `data/`   | `.json`                                           | values the code imports                     |
| `public/` | anything                                          | copied as it is, `.html` included           |

Any other file in `text/` fails the build, naming it and pointing to `public/`. An image belongs in
`public/`, where Markz links already have to find it.

The split stays the one a person works with: `text/` is for writing and never holds code, and
`code/` is for building. Inside `code/`, the folder gives scope and the file name gives role:
`code/blog/Layout.js` wraps `/blog/` and below, a capitalized file is a layout or component, a
lowercase one is a page, and `.island.js` is an island. Folders by role (`layouts/`, `components/`,
`islands/`) were ruled out. A JS page like `/blog/` has no place among them, and scope would move
into each page's front matter (`layout: post`), which is configuration under another name, or into
a copy of the URL tree in every folder.

`data/` is optional and flat. Its JSON files are modules the code imports
(`import talks from "../data/talks.json"`). They are never pages and never copied to the output.
It's the home for what amitkaps.github.io keeps in `content/data/*.yml` today. YAML becomes JSON,
since Vite imports JSON.

The prop that hands every page's metadata to code (`prose` today) becomes `pages`, which pairs with
`page`: `page` is this page's record, and `pages` is all of them. A record is flat (`p.url`,
`p.title`, `p.date`, and any key of the site's own), so it's `pages.filter((p) => p.date)`, not
`p.metadata.title`. `metadata` stays the name of what a JS page exports to describe itself.
`meta` was considered and ruled out: it names one page's metadata, not a list of pages. Since the
name says "pages", it covers every page, JS pages included, which the build already loads first for
their draft status. Today `prose` covers only prose pages.

## The model

A Markz element is an HTML element first. `{@call-out type="note"}` is written as
`<call-out type="note">`: a custom-element name is valid HTML with or without a definition, takes
any attribute, and CSS can style it. Code is added only when it's needed, in three levels, using
the lowest that works:

| Level        | When                                 | Files                            | Runs                              |
| ------------ | ------------------------------------ | -------------------------------- | --------------------------------- |
| HTML element | styling is enough                    | rules in `style.css`, or nothing | nowhere                           |
| Component    | the markup or the data has to change | `CallOut.js`                     | build, in Node, to an HTML string |
| Island       | it needs behavior                    | `filter-grid.island.js`          | browser only, as a custom element |

So call-outs, figures and asides can need no code at all: `call-out[type="warning"] { … }` is the
whole feature. That's "HTML before JavaScript" (rule 7) one step further. The same tag runs through
every level: a component replaces it with its own markup, and an island upgrades it in place.

The tag stays the element's own name, not `<div data-component="call-out">`. A real custom element
is what lets the browser find and upgrade an island by itself (`customElements.define`); a `div`
would need Sitez's runtime to scan for it and watch for new ones. The tag is also what Markz writes,
and it's shorter to style. A `div` would give one thing, the right default display. Here the site
gives it instead: an undefined custom element is `display: inline`, and the site's `style.css`
already names each element it styles. Sitez adds no reset rule for them. An unstyled block
element runs into its paragraph, which shows up in `dev` at once.

An island file is named by its tag and the word Sitez uses for it: `filter-grid.island.js` defines
`<filter-grid>`. It can't be taken for a page or a component, and Sitez never imports it in Node.

**Build-time code** is functions that return HTML, written with a tagged template that escapes
every interpolated value:

```js
// code/CallOut.js renders {@call-out} in text
export default ({ type, children }) => html`<aside class="callout ${type}">${children}</aside>`;

// code/blog/index.js → /blog/
export const metadata = { title: "Blog" };
export default async ({ pages }) => html`
  <ul>
    ${pages.filter((p) => p.date).map((p) => html`<li><a href="${p.url}">${p.title}</a></li>`)}
  </ul>
`;
```

Build-time data is a plain `await`. A layout is `Layout({ page, site, children })`, called with
the page's finished HTML: it needs no async renderer and no placeholder to swap. Pages, layouts and
components get `page`, `pages` and `site`, as they get `page`, `prose` and `site` today (rule 5). Layout lookup up the tree,
link checking, the head, the sitemap and the feed are unchanged: they work on text and on finished
HTML, not on Svelte.

**Islands** are custom elements, defined only in the browser. They enhance children that the
build rendered. They don't draw the page themselves:

```md
{@filter-grid filters="vis:Visualisation, ds:Data Science, talk:Talk"}
{@teaching-grid /}
{/filter-grid}
```

`teaching-grid` is a build-time component, so all 91 items are in the HTML. `filter-grid` is
both. Its component writes the tag and its buttons at build time, and its island upgrades that
tag in the browser, wiring the buttons and toggling `hidden` on items, with signals for its state:

```js
// code/FilterGrid.js
export default ({ filters, children }) => {
  const pairs = [["", "Show all"], ...filters.split(",").map((pair) => pair.trim().split(":"))];
  return html`<filter-grid>
    <div class="filters">
      ${pairs.map(([value, label]) => html`<button data-value=${value}>${label}</button>`)}
    </div>
    ${children}
  </filter-grid>`;
};

// code/filter-grid.island.js
define("filter-grid", (el) => {
  const buttons = [...el.querySelectorAll("button[data-value]")];
  const items = [...el.querySelectorAll("[data-filter]")];
  const active = signal("");
  for (const b of buttons) b.onclick = () => (active.value = b.dataset.value);
  effect(() => {
    for (const b of buttons) b.classList.toggle("is-checked", b.dataset.value === active.value);
    for (const i of items)
      i.hidden = !!active.value && !i.dataset.filter.split(" ").includes(active.value);
  });
});
```

The island gets no props, ships no copy of the data, and needs no hydration. That's the whole data
channel in v1: an island reads the HTML it wraps and its string attributes. A JSON `<script>` child,
for an island that needs rows of data, comes when a site needs it. amitkaps.github.io doesn't.

An island could add the buttons itself, but in the spike that moved the grid on a slow load: the
module can run after first paint. So the build writes whatever an island shows, and the island adds
only behavior. Since that island no longer calls `html`, htl isn't in its bundle: 2 KB of
JavaScript in all.

Sitez finds the islands a page uses by scanning its finished HTML for their tags, then bundles those modules into the page's
JavaScript, with the `common.js` split as today. A page with no island tags loads no JavaScript.

An island that needs a library imports it, and Vite bundles it. Sitez doesn't own a client
framework; the build report shows what each one costs.

## One package, one API

Sitez is the only dependency a site has, and its audience is one author, so Sitez wraps what it
uses and exposes it from one flat import, `sitez`: `html`, `signal`, `effect` and `define`. A site
never imports htl or a signals library itself. The implementation behind those four names can
change (htl to uhtml, a signals package to Sitez's own) without touching a site.

**`html` makes a template value, not a DOM node.** `html`…` records its strings and values and
renders nothing. Each runtime decides what to make of it:

```text
html`…`  →  template value
              ├─ build:   Sitez's renderer → escaped HTML string
              └─ browser: htl              → DOM nodes
```

The alternative was for `html` to make DOM nodes everywhere, as htl does. The build would then
need a DOM in Node (jsdom, happy-dom) only to serialize it back to the HTML string it wanted in the
first place. A template value keeps the build at the level of its output: strings in, strings out.
htl isn't the architecture. It's the browser's implementation of `html`, a thin adapter that
receives the same strings and values.

So authors learn one tag. The build enforces purity with it: a function in a template rendered at
build time can only be an event handler that ended up in a layout or component, and it fails the
build, naming the file. Layouts and components still run only at build time, by the contract. What
the shared tag allows is a small template helper with no Node imports, such as a card, that both a
component and an island can use. Two names (`html` for strings, `dom` for nodes) was the
alternative: less code, but authors would have to remember which runs where.

**Dependencies.** Sitez depends directly on `@amitkaps/markz`, Vite+ (its core, oxfmt and oxlint),
htl and a small signals core. Svelte, its Vite plugin, svelte-check and devalue go.

**Where the runtime lives.** In its own folder in Sitez, which never imports Sitez's internals. If
something other than Sitez wants it (the Markz Quality page, now a standalone HTML page, or
amitkaps.github.io's `public/apps/wordgame/`), the folder moves out into a tiny package of its own
(`renderz`, `componentz`). Until then, a second package is a second release cycle for one consumer.

## What it changes in idea.md

These are spec changes, to make or reject together:

- **The tagline and promise 1:** "Markz in `prose/`, Svelte in `pattern/`, files in `public/`"
  becomes Markz in `text/`, JavaScript in `code/`, files in `public/`, and JSON in `data/` if
  needed. "Three folders and a file" becomes three and an optional fourth.
- **Promise 3, complete HTML:** islands enhance HTML rendered at build time; they don't produce
  it. An island that draws itself from data is blank until its JavaScript runs.
- **Rule 6, "there is nothing to mark":** this goes away. Sitez can't read browser behavior from
  plain JavaScript, and importing an island in Node fails, because `HTMLElement` doesn't exist
  there. So an island is marked by its file's name: `filter-grid.island.js`.
- **Styling:** scoped component `<style>` goes away. The site's one stylesheet stays.
- **`sitez check`:** svelte-check goes. Types become `tsc` with `checkJs`, or nothing at first.
- **Not in v1:** islands inside islands work without any effort, since custom elements nest.
  `${…}` in Markdown stays out: amitkaps.github.io doesn't need it, and on GitHub it reads as
  literal code.

## What could come back to bite

- **The flat import across both runtimes.** `sitez` is imported by build code and by islands,
  so its entry must be safe for the browser. It can't import Node, Markz or the CLI, or Vite pulls
  them into an island's bundle. The CLI stays behind the binary, and the runtime entry stays free
  of side effects so the build-time half is tree-shaken out of islands.
- **The boundary between the two kinds of file.** A build-time component that imports an island
  crashes Node. An island that imports a build-time module bundles whatever that module imports.
  Both have to fail the build, naming the import, rather than fail strangely.
- **Escaping.** The build-time template escapes every interpolated value (`& < > " '`), refuses
  a `javascript:` URL in `href` and `src`, and says which HTML is trusted: nested templates, prose
  `children`, Markz output and raw blocks. The site's author writes all of its input, so the risk
  is correctness, not attack: a title with `&` or `<` must not break the page. The browser's
  Sanitizer API doesn't apply. It doesn't exist in Node, where templates run, and it strips
  dangerous parts from HTML you mean to keep, which isn't the job here. In islands, htl turns
  interpolated values into text nodes, which are safe by construction. The code is small, and it
  needs a thorough test table.
- **Meaning.** `<call-out>` means nothing to a screen reader, where `<aside>` is a landmark.
  `{@call-out role="note"}` works for one use. When the meaning matters on every use, that's what a
  component is for.
- **Async components.** If only pages may be `async`, a component that needs data forces the
  `await` up to its page. If templates may hold promises, the renderer resolves them, in parallel,
  and names the component when one rejects. Decide before the first site depends on either.
- **Element names are now one namespace.** `{@call-out}` can resolve to `CallOut.js` (build
  time), `call-out.island.js` (island), or both, when the component writes the tag the island
  upgrades. The component's output must keep the tag, or the island never runs. Neither existing is
  the first level, a plain HTML element, which is legitimate, so Sitez can't fail the build on it. A misspelled
  island then looks exactly like a CSS-only element and does nothing, silently. A warning for an
  element with no component, no island and no selector in `style.css` would catch it. That works,
  but could be fragile.
- **The first island that needs data.** v1 islands read only children and attributes. A
  Quality-page-like island needs rows. The JSON `<script>` child that comes then will need rules
  for what crosses (JSON turns a `Date` into a string, where `devalue` kept it) and how big it may
  get, which the build report shows.
- **Layout shift.** The spike showed it matters: buttons an island inserted moved the grid when
  its module ran after first paint. The build writes them now, as in the example above. Nothing
  enforces it, so an island that inserts visible markup can still bring the shift back.
- **The head.** A layout can't add to `<head>`. amitkaps.github.io preloads two fonts and links its
  icons from its layout's `<svelte:head>`, and Sitez writes the rest of the head from metadata. It
  needs a convention before the port, such as a `code/head.html` included in every page's head.
- **Template values cross module instances.** Build code loads `sitez` through Vite, and the build
  loads it through Node: two copies of the module. A template value is marked with
  `Symbol.for("sitez.template")`, not a class, so the renderer recognizes it from either.
- **Markz has no hook for elements.** Sitez replaces an element with its component's output after
  Markz writes the HTML, with markers as `prose.ts` already uses for raw blocks, unless Markz grows
  a hook.
- **The runtime contract.** What `define` does (initialize once, on first connect), what `effect`
  returns, and how effects are disposed is written down after the spike, from code that works, not
  before it.
- **Client re-rendering.** htl builds the DOM once; signals update it through `effect`. That
  handles hiding, toggling and text. An island that re-renders a list loses focus and input state
  and needs a diffing renderer (uhtml). Owning the API is what makes that swap cheap.
- **Lifecycle.** `connectedCallback` runs again when an element is moved, so `define` must
  initialize once. Effects should be disposed in `disconnectedCallback`. Cross-document View
  Transitions mean a full page load each time, so leaks stay small, but double initialization
  doesn't.
- **Authoring ergonomics.** oxfmt formats the HTML inside `html` templates, as Prettier does,
  and oxlint passes (the spike checked). What's still missing is completion and checking inside
  the strings. That's the comfort Svelte's editor support gives, and you feel its loss every day,
  not only at build time.
- **Links an island writes aren't checked.** They exist only in the browser. That's acceptable if
  islands enhance rather than generate. One more reason for that rule.
- **Migration.** `v0.1.0-rc.0` is out, built on Svelte. The fixtures, snapshots, `islands.ts` and
  the dev server's island hot-replace are written for it. Since amitkaps.github.io hasn't started
  its port, this is the cheapest moment to change; after its port, it's two migrations.

## The spike

amitkaps.github.io's `/teaching/` page, built this way in [spike/](../spike/README.md): its
layout, `ArticleHeader`, the teaching grid as a build-time component, and `filter-grid` as an
island. Compared with the live SvelteKit page:

- **JavaScript:** 2.0 KB against 206 KB. Most of SvelteKit's is a 170 KB chunk with the whole
  site's content, because of how that site loads data; its runtime alone is about 31 KB.
- **Data sent:** the HTML only, 5.5 KB against 6.1 KB, with nothing sent twice.
- **Layout shift:** the same as SvelteKit's once the build writes the buttons. What's left in both
  is the web fonts swapping in.
- **Code:** about 100 lines of JavaScript against about 150 of Svelte, formatted by oxfmt.

It held. Next, idea.md and design.md change together, and plan.md gets the rewrite as its next
steps.
