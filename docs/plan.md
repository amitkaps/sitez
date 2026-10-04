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
- **12. The runtime.** `src/runtime/` holds `html`, the renderer and `define`, and `sitez`'s
  exports pick its build or browser half. `render.test.ts` covers each place a value can go.
- **13. Pages, layouts and components in JavaScript.** The build renders them through the
  runtime, and text through markers. The fixtures are JS, and `check` dropped svelte-check.
- **The conventions refined.** idea.md drops JS pages, capitalized names, `_` and `Head.js` for
  `@`, `+` and `.live` names, and components that wrap. Step 14 builds it.

## Open work, in order

Each step ends in something a fixture site shows. So a step is done when its fixture builds and
its tests pass, not when the code is written. Error cases are fixtures too, each a site that must
fail with the message it must fail with.

The order keeps the tests green throughout. The mechanical changes came while Svelte still
rendered. Next the renderer is swapped, then Svelte is deleted.

### 14. Names in `code/`, and components that wrap

The refined conventions in idea.md ([design.md](design.md#names-in-code)). Most of step 13 carries
over, and its JS pages go.

- [ ] Pages are only `.md` in `text/`. `discover.ts` drops JS pages, and the `<h1>` title rule
      goes with them.
- [ ] `code/` reads `@name.js`, `+layout.js` and `+style.css` up the tree, and plain names are
      modules. An unknown `+` file, a `+style.css` below `code/`, and an `@` file without a hyphen
      fail.
- [ ] A component returns inner HTML, and the build writes the element around it with its
      attributes ([Wrapping](design.md#wrapping)).
- [ ] `data="talks.json"` passes `data/talks.json`, parsed, as `data`. A missing path fails with
      its line, and the attribute isn't written.
- [ ] `+layout.js`'s `head` export replaces `Head.js`.
- [ ] The fixtures move to the new names, with `landing` and the blog's index as text pages. The
      error fixtures follow, with one each for an unknown `+` file and a missing data path.

### 15. Live elements

- [ ] `@name.live.js` (or `.ts`) defines `<name>`. A page's `.live` files are found by scanning
      its HTML, and bundled per page with the `common.js` split.
- [ ] Build-time code importing a `.live` file fails, and so does a `.live` file importing a
      component or layout.
- [ ] `tests/live.test.ts` runs the built pages in happy-dom. It checks that `define` sets up
      once, and that the `tag-filter` and `fold-out` elements work. The fixtures' components
      already write their markup.

### 16. Svelte goes

- [ ] Delete `islands.ts`, `runtime/server.ts`, `runtime/client.ts` and the `Island*.svelte`
      files. Drop `svelte`, its Vite plugin, `svelte-check` and `devalue`.
- [ ] The report lists live elements by tag.
- [ ] `dev` hot-replaces CSS and reloads for anything else.
- [ ] `spike/` goes, its findings already in design.md.

### 17. amitkaps.github.io

The real site, kept in its own private repo, is ported on its `next` branch. Its notes stay
there.

- [ ] Pages go to `text/`, YAML becomes JSON in `data/`, and the card grids become components
      given `data`. The workshops, talks and teaching grids are each a `filter-grid` with a
      `.live` file. Old `.html` URLs keep working.
- [ ] Compare with the SvelteKit site page by page, for the same content with less JavaScript.
      Whatever Sitez couldn't do goes back into idea.md or "Not in v1".

### 18. Release

- [ ] Publish `sitez` 0.2.0 to npm. Check `npx sitez build` and `mise use -g npm:sitez` on a
      clean machine.
- [ ] Build amitkaps.github.io on Cloudflare with `npx sitez build`, from its git integration.

## Open questions

- **Rendered bodies in `pages`.** Each entry could carry its page's HTML as well as its metadata,
  for a feed with full posts or an index with excerpts. The feed carries summaries until a site
  needs more.
- The rest are in [design.md](design.md#open-questions).
