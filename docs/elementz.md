# elementz

elementz is the element layer: one `@name.html` file that holds an element's markup, written at
build time, its CSS and its behavior. A host renders it into a page. Sitez is the first host,
and Pagez ([pagez.md](pagez.md)) would be the second.

elementz isn't a package yet. Its first form is `src/elementz/` in Sitez, which imports nothing
from the rest of Sitez ([sitez.md](sitez.md#where-sitez-sits)). It is next in the
[plan](plan.md). Until then Sitez reads an element from up to three files (`@name.html`,
`@name.html.js` and `@name.browser.js`), and its `.browser.js` file default-exports a class.

## The file

Where a part sits says when it runs. What is inside `<template>` is what the build writes, and
what is outside ships, as `<style>` and `<script>` do in any HTML page.

```html
<!-- code/blog/@tag-filter.html -->
<template>
  <script>
    export const posts = (pages) => pages.filter((p) => p.url.startsWith("/blog/") && p.date);
    export const tags = (pages) => [...new Set(posts(pages).flatMap((p) => p.tags ?? []))].sort();
  </script>
  <p>
    <button value="" aria-pressed="true">All</button>
    ${tags(pages).map((t) => html`<button value=${t} aria-pressed="false">${t}</button>`)}
  </p>
  <ul>
    ${posts(pages).map((p) => html`<li data-tags=${(p.tags ?? []).join(" ")}>${p.title}</li>`)}
  </ul>
</template>

<style>
  tag-filter {
    display: block;
    &:not(:defined) p {
      display: none;
    }
  }
</style>

<script>
  export default (el, { signal }) => {
    el.addEventListener("click", (event) => { … }, { signal });
  };
</script>
```

| Part                           | Runs    | Gives                                                          |
| ------------------------------ | ------- | -------------------------------------------------------------- |
| `<template>`                   | build   | the element's inner HTML, evaluated as an `html` template      |
| `<script>` inside `<template>` | build   | named exports in the template's scope, and nothing in the page |
| top-level `<style>`            | ships   | the element's CSS, in `@layer elements`                        |
| top-level `<script>`           | browser | `setup(el, { signal })`, which may return a cleanup function   |

Each part is optional. A template with no `${…}` is static markup, and an element whose markup
the text writes has no template.

Colocation is why. amitkaps.github.io's treemap was three places to read, its two scripts and
about 70 lines of `style.css`, for one idea. Vue and Svelte keep a component in one file for this
reason. elementz does it without what they bring with it.

- **No template language.** The template is JavaScript's own template literal, tagged with
  `html`. Loops are `.map`, and conditions are `? :`.
- **HTML already marks the time.** A browser never renders or runs a template's content, so
  "written at build time, never shipped" is what `<template>` means. A top-level `<script>` runs
  in the browser, as it would in any page.
- **Nothing is serialized.** Behavior reads only the page's HTML, so there are no props and
  nothing to hydrate.
- **One suffix to learn.** Four kinds of file become one, with one place in it for each of
  markup, style and behavior.

## The template

elementz reads the template as raw text and evaluates it as an `html` literal, so `${…}` in an
attribute survives. Its scope is the host's context and the element's own.

- `attrs` holds the element's attributes. `data="talks.json"` arrives parsed, as `attrs.data`,
  since the host reads it first.
- `page` is the page's metadata and URL. Sitez adds `pages` and `site`.
- `html` is in scope, since the template is its literal.
- The template's `<script>` adds its named exports by name. An export named like anything above
  fails, naming the export.

Attributes live under `attrs`, so they can't collide with `page` or `site`, and no attribute
name is reserved. An element that reads only `page` works in every host.

Rendering is synchronous. No site has async build code, and Pagez's single pass can't wait. Data
arrives through `data="…"`, which the host reads before the element renders.

A template literal holds no local variables. An element whose markup needs intermediate values,
such as the treemap's layout, exports one function and its template is one line.

```html
<!-- code/notes/@notes-treemap.html -->
<template>
  <script>
    import { html } from "@amitkaps/sitez";
    import { layout, place } from "./treemap.js";
    export const chart = ({ data, year, fill, slider, play }) => { …; return html`…`; };
  </script>
  ${chart(attrs)}
</template>
```

The script imports `html` itself when it writes markup, since only the template has it in
scope. A literal backtick or `${` in the template's markup is escaped, as in any template literal.

## Content goes in `<slot>`

An element's content goes where its `<slot>` is, as a page goes in Sitez's `index.html`. Content
is rendered inside-out, so an element only ever has it as finished HTML. It can place it or check
that it's empty, and `<slot>` does both declaratively.

```html
<!-- code/@call-out.html -->
<template>
  <aside><strong>Note</strong><slot>Nothing noted.</slot></aside>
</template>
```

- elementz fills the slot after the template renders, so a slot in a helper's `html` works too.
- The slot's own content is its fallback, shown only when the element has none, as in the
  platform.
- One unnamed slot. Content with no slot fails, and so do two slots and a named one.
- The template has no `<template shadowrootmode>`. That's declarative shadow DOM, and it fails.

elementz uses no shadow DOM. The content is written into the element in the light DOM, where the
page's CSS reaches it, and `::slotted()` matches nothing. `<slot>` can't drop a wrapper when there
is no content, which CSS's `:empty` can.

## Nesting and wrapping

Elements render inside-out. An element's content renders before its template, and the elements
its template writes render after it, until none is left. An element that ends up inside itself
fails, naming the chain. So an element can't inspect its content's structure at build time.
Structure derived from it, such as a tab list, is built in `setup`, and without JavaScript the
content simply shows.

In HTML an element is a tag with a file. A tag with a hyphen and no file is plain, and holds
whatever elements it holds. An element must be closed, or written `<x />`, which HTML itself
ignores on a custom element. An attribute written twice keeps its first, as HTML does.

### Wrapping

The template writes the element's inner HTML, and elementz writes the element around it with its
attributes. A `data` attribute is left out, since the element has read it. So the tag is always in
the page, where CSS and the element's `setup` look for it. Wrapping costs something for each kind
of use.

- **A leaf** (`{@video-embed id=x /}`) can never be a bare `<iframe>` or `<img>`. The page gets
  `<video-embed id="x"><iframe …></iframe></video-embed>`.
- **A container** (`{@call-out}…{/call-out}`) holds block content in an element that is inline by
  default. Its `<style>` sets `display: block`.
- **An inline element** (`[term]{@key-word}`) sits inside a `<p>`, so its output can't hold a tag
  that closes one, such as `<div>`, `<ul>` or `<p>`. The browser would end the paragraph there and
  pop the element with it, and the page would break silently. So the host fails the build, naming
  the line, the element and the tag. The list is the parser's, of the start tags that close an
  open `<p>`, so it fails exactly where a browser breaks. The check reads the output after
  nesting, and runs wherever the element is used inline, in a heading or a table cell too.

Only the host knows how an element was used, from Markz, so the inline check is the host's.

Ruled out:

- **Replacing the tag with the element's output.** Sitez first did that, and a component could
  return `<aside class="call-out">`. The element's name was gone from the page, so its behavior
  never ran and its CSS never matched. A tag that is always there is worth more than choosing the
  root element.
- **Passing the kind of use** (inline, leaf or container) to the element. An element that renders
  differently by where it's used is two elements, such as `{@cite}` and `{@cite-block}`. So a tag
  means the same everywhere, for CSS and for `setup`.

## `html`

The template is an `html` literal, and a build script imports `html` to write markup of its own.
At build time `html` records its strings and values and renders nothing. The renderer turns that
value into a string. It follows the HTML tokenizer through the template, so each place a value can
go means what HTML makes of it there. The rules began as htl's, a library that makes DOM nodes
from the same tag.

- In text, a value is escaped (`& < > " '`). A nested template or Markz's HTML goes in as HTML,
  and an array is each of its items. `null`, `undefined` and `false` are nothing.
- Right after `name=`, a value is the attribute's. `null`, `undefined` and `false` drop the
  attribute, and `true` leaves it bare. Anything else is written quoted and escaped.
- Inside an attribute's value, quoted or not, a value is escaped text.
- Inside `<script>` or `<style>`, a value goes in as it is, so a JSON-LD block stays JSON. One
  holding the element's closing tag fails.
- In a comment, a value is dropped.

Some templates fail, and the build names the file.

- A function fails, since at build time it could only be an event handler.
- A value where a tag's name or an attribute's name goes fails. htl would spread an object there
  as attributes, which is a second way to write `name=${value}`.
- A template in an attribute fails, and so does a plain object anywhere. Each would write
  `[object Object]`.
- A promise fails, since rendering is synchronous.

`false` in text writes nothing, where htl writes the word. `${cond && html`…`}` is how a template
says "maybe", and the word is never wanted.

A template value is marked with `Symbol.for("sitez.template")`, not a class. Sitez loads the
site's code through Vite's module runner and its own through Node. That makes two copies of the
module, and `instanceof` fails between them.

The renderer's job is correctness, not defense. The site's author writes all of its input, and a
title with `&` must not break the page. The browser's Sanitizer API doesn't apply. It doesn't
exist in Node, and it strips what it finds dangerous from HTML that's meant to be kept.

## Behavior in the browser

The top-level `<script>` default-exports `setup(el, { signal })`. elementz's runtime defines each
element and calls `setup` once per connection with a fresh `AbortController`'s signal. On
disconnect it aborts the signal and calls the cleanup `setup` returned, and a reconnect runs
`setup` again. `setup` works on the DOM the build wrote. It mustn't depend on a child element
having upgraded first.

An element with behavior is a custom element, and its tag is the element's own name. The browser
finds and upgrades a custom element by itself, where a `<div data-component>` would need a runtime
to scan for it and watch for new ones. A custom element is also what Markz writes. Elements with
behavior nest without any effort, since custom elements do.

- **Behavior enhances HTML the build wrote.** On a slow load the script can run after first
  paint, so markup it inserted would move the page. In Sitez's spike, filter buttons the script
  prepended pushed the teaching grid down. So the template writes what the element shows, and
  `setup` wires it.
- **It reads its children and its attributes.** No data is sent besides the page's HTML, so
  nothing is sent twice and there is nothing to hydrate.
- **The two scripts stay apart.** The host cuts each from the file and gives it to its bundler as
  a module of its own. They share no variables. Code both need, such as the treemap's
  `treemap.js`, is a module both import if it has no Node imports. A browser script that imports
  `html` fails, since `html` renders at build time.
- **A large library loads inside `setup`**, with `await import("d3")`, so only a page where the
  element connects fetches it.

The runtime is a few lines in the host's one script, and it's all elementz adds in the browser.

## CSS

An element's CSS is its own, and the page's has the last word.

- Every top-level selector in the `<style>` starts with the tag. Nesting
  (`notes-treemap { & .frame { … } }`) writes the name once, and `x-tag li` passes too. A rule
  that doesn't start with the tag fails, naming the rule.
- elementz puts element CSS in `@layer elements`. Unlayered CSS beats every layer, so element CSS
  outside a layer would beat a layered site's own CSS. In a layer, an unlayered site has the last
  word. A layered site lists `elements` in its order, as in `@layer reset, base, elements, site;`.
- The host ships each element's CSS once, and only for elements its pages use.
- `:not(:defined)` styles an element before its script runs.

Nesting isn't scoping. `notes-treemap .frame` also reaches a `.frame` in an element nested inside
it. `@scope (notes-treemap)` doesn't stop that either. Only a lower boundary does (`to (…)`), and
CSS has no selector for "any other element" to put there. What `@scope` changes is specificity,
since its root adds none. Vite's default target is Baseline widely available (Chrome 111, Firefox
114, Safari 16.4 in Vite 8). Lightning CSS flattens nesting for it, and passes `@scope` through as
written, so a browser without `@scope` drops the whole block.

## The element attribute

`<template element="x-tag">` is optional in a file, and must match the file's name. Pagez needs
it to name an element defined inside a page, so allowing it in a file makes moving one out a cut
and paste. A mismatch fails, so the two names can't drift.

## What the build checks

Each failure names the file and the line.

- The top level holds at most one `<template>`, one `<style>` and one `<script>`. Anything else
  there fails.
- A template holds at most one `<script>`, and it comes first.
- An export that shadows the template's scope fails.
- `</script>` inside a script's string ends the script, as in any HTML. It fails, asking for
  `<\/script>`. A script's text is otherwise read as code, so `<template>` in a string is safe.
- A named slot, two slots, content with no slot, and `shadowrootmode` fail.
- An `element` attribute that doesn't match the file's name fails.
- A top-level CSS selector that doesn't start with the tag fails.
- An invalid or reserved custom element name fails, and so do two files for one name.

Element scripts are JavaScript. `.ts` stays for modules, since no site writes it in an element.

## Ruled out

- **Markers on each script** (`<script build>` and `<script browser>`, or `render` and `setup`).
  Position says the same thing with no attribute to learn.
- **`@name.css` beside the scripts.** It kept CSS beside the element but added a fourth suffix.
- **Separate files by time** (`.html.js` for build markup, `.browser.js` for behavior). They were
  Sitez 0.3's. They kept the two times apart by name, and an element was up to four places to
  read.
- **A template holding markup or a script, never both.** The literal form covers both, so a
  static element and a computed one are the same shape.
- **`${children}`.** Content can only be placed or tested for emptiness, and the slot and its
  fallback do both in markup. It would also be a second way to say what `index.html` says with
  `<slot>`.
- **One class, run at both times.** The build would run the element in a DOM in Node and save the
  HTML, and the browser would run it again. Its code would have to work twice, check whether it
  had already rendered, and couldn't read `data/` in the browser.
- **A DOM at build time**, as htl makes nodes. The build would need a DOM in Node only to
  serialize it back to the string it wanted.
- **A class as the default export.** Sitez 0.3 used one, since a function said nothing of where
  its argument came from or that it was an element. In one file the file is the element, and the
  script's place says it runs in the browser. The class's repeated lines and its easy-to-miss
  second setup on a move are what the runtime absorbs.
- **`define(name, setup)`, or `customElements.define` in the file.** It names the element a second
  time, after its file, and nothing checks that the two agree.
- **`html` in the browser.** It was htl's, which made DOM nodes, so one name meant a string at
  build time and nodes in the browser. An element that renders in the browser imports a renderer
  from npm.
- **`signal` and `effect`.** They held one value per element in every element written, which a
  variable holds as well. A site whose state crosses elements imports a signals library.
- **Declarative behavior** (`click: { "button[data-tab]": "select" }`). It is a framework that grows
  a verb for every interaction nobody planned. A site that wants one imports Alpine or htmx.
- **A `live` attribute on each use** (`{@tag-filter live}`). Behavior belongs to the element, not
  the use.
- **Shadow DOM, async render, and rendering again in the browser.**

## Costs

- The host cuts files into virtual modules, with source lines mapped back for errors.
- An editor's IntelliSense is weaker in an inline script than in a `.js` file, and `${…}` in the
  template's HTML isn't highlighted.
- `@amitkaps/prose` reads `.html` only for HTML comments. It must read an element file part by
  part, as it reads `.svelte`, or an element's prose goes missing.
- `d3` imported in the build script sits a few lines from browser code that must not import it.
  The report's size per element is what catches a copied import.

## Precedent

- **[Enhance](https://enhance.dev)** has the same element model. The file name is the tag, an
  element is a pure function, and it renders in light DOM. It renders on a server, where Sitez
  writes static files.
- **[WebC](https://www.11ty.dev/docs/languages/webc/)** keeps an element in one `.html` file and
  bundles its script only on the pages where its tag appears. Its `<slot>` places content in light
  DOM.
- **Vue and Svelte** keep a component in one file, with a template language and a compiler.

## Open questions

- **Re-rendering behavior.** Behavior changes the nodes the build wrote. That covers hiding,
  toggling and text. An element that re-renders a list would lose focus and input state, and would
  import a diffing renderer, such as uhtml, from npm.
- **Data for behavior.** An element that needs rows of data would get them as a JSON `<script>`
  child. That needs rules for what crosses (a `Date` becomes a string) and how big it may get.
- **Markup from a library.** `html` escapes every value, and `raw` isn't exported. So Vega's SVG,
  a syntax highlighter or KaTeX can't be used in an element. Data Portraits drew its charts with
  d3 and `html` instead. Exporting `raw` waits until a site needs such a library.
- **Meaning.** `<call-out>` means nothing to a screen reader, where `<aside>` is a landmark. When
  the meaning matters on every use, the template writes the `<aside>`.
- **Child inspection.** Whether an element ever needs its content's structure at build time.
  Deferred until a real element needs it.
- **Moves** with `connectedMoveCallback`, once connect and disconnect are proven.
