# Pagez

Pagez is an idea for a single-page compiler: one Markz file in, one HTML file out. It is the layer
between elementz and Sitez ([sitez.md](sitez.md#where-sitez-sits)), and it doesn't exist yet. It
gets built when a page needs it, and this file keeps its idea in step with Sitez's until then.

> The build produces the page. JavaScript enhances the page.

**Keep Pagez small.** There is no Pagez runtime model to understand. There is a compiler that
turns prose plus elements into HTML, CSS and JS, and elementz's small runtime in the output.

## Core model

**The unit is the page.** The page holds its content, its metadata and the elements it uses.
Elements exist in service of the prose.

**An element is one file of plain HTML,** made of a `<template>`, a `<style>` and a `<script>`.
That's elementz's element, the same one Sitez uses ([elementz.md](elementz.md)).
It is defined in the page, or in its own `@x-tag.html` file beside it.

In short, it's Web Components in the light DOM, rendered at build time.

**The ideal page** is a simple text page with some behavior, such as an essay with a toggle, a
small interactive figure, or a filterable list.

## Scope

- Input is one Markz file, and the `@x-tag.html` files beside it.
- Output is one self-contained HTML file, with its markup, CSS and behavior inline.
- Site concerns are Sitez's. Routing, navigation, links between pages and shared caching are out.

## Markz and Pagez

Markz is purely syntactic. It parses and never evaluates, and every node carries its position and
source.

| Markz syntax | Markz AST                                        | Markz HTML renderer    | Pagez                                              |
| ------------ | ------------------------------------------------ | ---------------------- | -------------------------------------------------- |
| `${…}`       | expression node (`value` = inner text)           | prints `value` as code | evaluates it as a `page` path and emits it escaped |
| `{@x-tag …}` | element node (attributes plus Markdown children) | —                      | renders the element through elementz               |
| ` ```=html ` | raw node                                         | emits verbatim         | emits verbatim, unless it defines an element       |

- Pagez overrides the Markz renderer for these three nodes only, and reuses everything else.
- A page rendered by Markz alone stays readable. Expressions show as code, and raw HTML passes
  through.
- A literal `${…}` in prose goes in an inline code span.

## Expressions

Prose and templates evaluate separately.

| Where           | Parsed by               | Scope                                         | Power             |
| --------------- | ----------------------- | --------------------------------------------- | ----------------- |
| Prose `${…}`    | Markz (expression node) | `page`                                        | dotted paths only |
| Template `${…}` | elementz (raw template) | `attrs`, `page`, `html`, the script's exports | full JavaScript   |

- Prose refers to values, and elements compute.
- Anything beyond a dotted path in prose fails, at the node's position.
- `page` is the page's metadata, the name Sitez uses, so an element that reads only `page` works
  in both.

Sitez doesn't evaluate `${…}` in prose (its idea.md, "Not in v1"). That difference is a page
feature, not part of the element, so elements stay shared.

## Metadata, never settings

Frontmatter holds the page's metadata, such as `title`, `description`, `url` and `image`. It holds
no settings, as Sitez's `site.md` holds none. Each would-be setting is a convention.

- **The frame** is an `index.html` beside the page, with one `<slot>` for the page, as Sitez's
  `code/index.html` is. With none, Pagez writes a minimal document. The frame must not grow
  layouts, partials or site logic.
- **Elements** are the page's own definitions and the `@x-tag.html` files beside it, found by
  name. There's nothing to import.
- **Undefined tags** warn only when a hyphenated tag has no definition and no selector in the
  page's CSS. That catches a typo without a list of tags to allow.

Relative paths resolve from the page file.

## Head

- Pagez writes the head from metadata: title, description, canonical URL, and the Open Graph and
  Twitter tags. Sitez's `head.ts` does this now, and it moves down to Pagez when Pagez is built.
- Absolute URLs come from `url`.
- Pagez adds no display or layout defaults.

## Elements

The element itself is elementz's, with its template, slot, CSS and `setup`
([elementz.md](elementz.md)). Elements nest inside-out, as there. What's Pagez's own is how
elements are used, and where their definitions live.

### Use

- An element is used through Markz, `{@x-tag attr=…}`, optionally with Markdown children.
- An attribute's value may be a prose expression (a `page` path), which evaluates to any value.

### Where definitions live

- **In the page,** one `=html` block per element, named by `<template element="x-tag">`. Its
  `<style>` and `<script>` are siblings in the block. Definitions sit anywhere in the page,
  typically at the end, like footnotes. A behavior-only element has an empty
  `<template element="x-tag"></template>`, which writes no markup.
- **In a file,** `@x-tag.html` beside the page. The file's name is the tag, and an `element`
  attribute is optional and must match.
- Moving an element from the page to a file is a cut and paste. The same file works in Sitez.
- An element's block isn't emitted. All other `=html` content stays verbatim.

### Names

These fail, at their source positions:

- an invalid custom element name
- a reserved name
- two definitions for one name
- a name that isn't lowercase
- an `element` attribute that doesn't match its file's name

## CSS

Element CSS is in `@layer elements`, emitted once and only for elements the page uses
([elementz.md](elementz.md#css)). So the page's own CSS has the last word, layered or not.

## JavaScript

- `setup` scripts are emitted only for elements the page uses that have one.
- elementz's runtime defines each element, and aborts and cleans up on disconnect.
- Pagez as a library returns the head, the body, and the CSS and JS of the elements used. Its
  command writes them inline as one file. Sitez gives the same parts to Vite, which bundles and
  hashes them. One core has two consumers, and neither is an option.

## Errors

- Markz nodes carry their position and source, so every error points to an exact place.
- An error inside an `=html` definition is offset from the block's position, so a line in a
  template maps back to the page or the `@x-tag.html` file.

## Trust and determinism

- A template's script runs at build time with full Node access. A page is trusted like a script.
- Other `=html` content is emitted verbatim. A `<script>` in it runs only in the browser.
- Pagez is deterministic when the page's code is. Dates, randomness, environment variables and
  reading files or the network in a build script are the author's to avoid.

## Non-goals

- Shadow DOM, JSX, decorators, framework template syntax, attribute languages
- A DOM at build time, hydration, a virtual DOM, reactive state, a runtime props system
- Async render, streaming, rendering again in the browser
- Logic in prose
- Settings in frontmatter
- A frame that grows into a site framework
- Multiple pages, which are Sitez's

## Open questions

- **Page CSS and JS.** Whether they're the frame's, as in Sitez, or plain `=html` blocks too.
- **Assets.** Whether relative images are copied, inlined, or left as they are.
- **Dev loop.** Watching and rebuilding, and what invalidates what.
- **The Sitez boundary.** Sitez rendering each page through Pagez, with `pages` and `site` added
  to the context, linked output for caching, and a page's element clashing with a site's as an
  error.
