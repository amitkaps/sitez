# Plan

The order in which [design.md](design.md) gets built, and what each step must prove before the
next starts. The spec is [idea.md](idea.md), and "rule N" means its rule N.

This file holds only what spans the codebase, which is the order of the work and items that touch
several files. Once a file exists, work that belongs to it is a pending `@prose` chunk there, not a
line here. Finished steps shrink to one line each.

## Done

- **0.1, the Svelte iteration** ([`v0.1.0`](https://github.com/amitkaps/sitez/tree/v0.1.0)).
  Steps 0 to 10 built Sitez on Svelte. They covered the skeleton and CLI, pages and metadata
  checks, components in text, links, the head, sitemap and feed, and one stylesheet. They also
  covered islands hydrated from the server render, the build report, the dev server, and preview,
  check and deploy. What doesn't depend on the renderer carries over. That's `discover.ts`,
  `metadata.ts`, `links.ts`, `head.ts`, `sitemap.ts`, `report.ts`, `preview.ts`, `deploy.ts`,
  check's oxfmt and oxlint, the reset, and the error fixtures.
- **The redesign's spike.** amitkaps.github.io's `/teaching/` page was built without Svelte
  ([spike/](../spike/README.md)). It loads 2 KB of JavaScript against 206 KB, sends no data
  twice, and has no layout shift once the build writes the island's buttons. idea.md and
  design.md were rewritten from it.
- **11. The new folders, on Svelte.** `text/`, `code/` and `data/` replace `prose/` and
  `pattern/`, `pages` replaces `prose` and lists every page, and `_` files and non-Markz files in
  `text/` follow rule 1. Sitez's own tests moved to `tests/`.

## Open work, in order

Each step ends in something a fixture site shows. So a step is done when its fixture builds and
its tests pass, not when the code is written. Error cases are fixtures too, each a site that must
fail with the message it must fail with.

The order keeps the tests green throughout. The mechanical changes came while Svelte still
rendered. Next the renderer is swapped, then Svelte is deleted.

### 12. The runtime

- [ ] The runtime gets its own folder, which never imports the rest of Sitez. It holds `html` and
      the template value, the renderer, and `define`, `signal` and `effect` over htl and the
      signals core.
- [ ] `sitez`'s package exports pick the Node or browser entry by the `browser` condition.
- [ ] A test table covers the renderer. It checks escaping in text and attributes, attributes
      dropped or bare, arrays, nested templates and promises. It checks the failures too, a
      function and a value in a tag.

### 13. Pages, layouts and components in JavaScript

- [ ] Lowercase `.js` and `.ts` files in `code/` are pages, and capitalized ones are layouts and
      components. `Head.js` adds to the head, and writing a tag Sitez writes fails.
- [ ] A text page is Markz's HTML with each element that has a component replaced by its output.
      That goes through markers in the view `html()` renders, as raw blocks do today.
- [ ] A layout gets the page's finished HTML as `children`, and fails if it drops or repeats it.
      A JS page without `metadata` gets its title from its `<h1>`.
- [ ] The `blog`, `landing` and `elements` fixtures are rewritten in JS. Their snapshots match
      what they rendered on Svelte, scoping classes and hydration comments aside.

### 14. Islands as custom elements

- [ ] `name.island.js` (or `.ts`) defines `<name>`. A page's islands are found by scanning its
      HTML, and bundled per page with the `common.js` split.
- [ ] Three things fail. Build-time code importing an island, an island importing a page, layout
      or component, and a component dropping its own tag when an island of that name exists.
- [ ] `tests/islands.test.ts` runs the built pages in happy-dom. It checks that `define` sets up
      once, and that the `tag-filter` and `fold-out` islands work.

### 15. Svelte goes

- [ ] Delete `islands.ts`, `runtime/server.ts`, `runtime/client.ts` and the `Island*.svelte`
      files. Drop `svelte`, its Vite plugin, `svelte-check` and `devalue`.
- [ ] `check.ts` runs oxfmt, oxlint and Markz's warnings, and the report lists islands by tag.
- [ ] `dev` hot-replaces CSS and reloads for anything else.
- [ ] `spike/` goes, its findings already in design.md.

### 16. amitkaps.github.io

The real site, kept in its own private repo, is ported on its `next` branch. Its notes stay
there.

- [ ] Pages go to `text/`, YAML becomes JSON in `data/`, and the card grids become components.
      The workshops, talks and teaching grids are wrapped in `filter-grid`. Old `.html` URLs keep
      working.
- [ ] Compare with the SvelteKit site page by page, for the same content with less JavaScript.
      Whatever Sitez couldn't do goes back into idea.md or "Not in v1".

### 17. Release

- [ ] Publish `sitez` 0.2.0 to npm. Check `npx sitez build` and `mise use -g npm:sitez` on a
      clean machine.
- [ ] Build amitkaps.github.io on Cloudflare with `npx sitez build`, from its git integration.

## Open questions

- **Rendered bodies in `pages`.** Each entry could carry its page's HTML as well as its metadata,
  for a feed with full posts or an index with excerpts. The feed carries summaries until a site
  needs more.
- The rest are in [design.md](design.md#open-questions).
