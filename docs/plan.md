# Plan

The order in which [design.md](design.md) gets built, and what each step must prove before the
next starts. The spec is [idea.md](idea.md); "rule N" means its rule N. This file holds only what
spans the codebase: the order of the work and items that touch several files. Once a file exists,
work that belongs to it is a pending `@prose` chunk there, not a line here. Finished steps shrink
to one line each.

## Done

- **0.1, the Svelte iteration** ([`v0.1.0`](https://github.com/amitkaps/sitez/tree/v0.1.0)).
  Steps 0 to 10 built Sitez on Svelte: the skeleton and CLI, pages and metadata checks,
  components in prose, links, the head, sitemap and feed, one stylesheet, islands hydrated from
  the server render, the build report, the dev server, and preview, check and deploy. What doesn't
  depend on the renderer carries over: `discover.ts`, `metadata.ts`, `links.ts`, `head.ts`,
  `sitemap.ts`, `report.ts`, `preview.ts`, `deploy.ts`, check's oxfmt and oxlint, the reset, and
  the error fixtures.
- **The redesign's spike.** amitkaps.github.io's `/teaching/` page built without Svelte
  ([spike/](../spike/README.md)): 2 KB of JavaScript against 206 KB, no data sent twice, and no
  layout shift once the build writes the island's buttons. idea.md and design.md were rewritten
  from it.

## Open work, in order

Each step ends in something a fixture site shows, so the step is done when its fixture builds and
its tests pass, not when the code is written. Error cases are fixtures too: a site that must fail,
with the message it must fail with. The order keeps the tests green throughout: the mechanical
changes come while Svelte still renders, then the renderer is swapped, then Svelte is deleted.

### 11. The new folders, on Svelte

A rename only, so that a test failing later means the renderer, not a path.

- [ ] `prose/` becomes `text/` and `pattern/` becomes `code/`, in the code, the fixtures and the
      messages; `text/site.md` is the reserved name.
- [ ] Any file in `text/` but `.md` fails, pointing to `public/`. `data/` holds JSON that code
      imports and is never copied.
- [ ] The `prose` prop becomes `pages`, and covers every page, Svelte pages included.
- [ ] A file in `code/` whose name starts with `_` is a module, never a page.
- [ ] Sitez's own `test/` becomes `tests/`, as in its other repos.

### 12. The runtime

- [ ] Its own folder, which never imports the rest of Sitez: `html` and the template value, the
      renderer, and `define`, `signal` and `effect` over htl and the signals core.
- [ ] `sitez`'s package exports pick the Node or browser entry by the `browser` condition.
- [ ] A test table for the renderer: escaping in text and attributes, attributes dropped or bare,
      arrays, nested templates, promises, and the failures (a function, a value in a tag).

### 13. Pages, layouts and components in JavaScript

- [ ] Lowercase `.js` and `.ts` files in `code/` are pages; capitalized ones are layouts and
      components; `Head.js` adds to the head, and writing a tag Sitez writes fails.
- [ ] A text page is Markz's HTML with each element that has a component replaced by its
      output, through markers in the view `html()` renders, as raw blocks are today.
- [ ] A layout gets the page's finished HTML as `children`, and fails if it drops or repeats it;
      a JS page without `metadata` gets its title from its `<h1>`.
- [ ] The `blog`, `landing` and `elements` fixtures are rewritten in JS, and their snapshots
      match what they rendered on Svelte, scoping classes and hydration comments aside.

### 14. Islands as custom elements

- [ ] `name.island.js` (or `.ts`) defines `<name>`; a page's islands are found by scanning its
      HTML, and bundled per page with the `common.js` split.
- [ ] Failures: build-time code importing an island, an island importing a page, layout or
      component, and a component dropping its own tag when an island of that name exists.
- [ ] `test/islands.test.ts` runs the built pages in happy-dom: `define` sets up once, and the
      `tag-filter` and `fold-out` islands work.

### 15. Svelte goes

- [ ] Delete `islands.ts`, `runtime/server.ts`, `runtime/client.ts` and the `Island*.svelte`
      files; drop `svelte`, its Vite plugin, `svelte-check` and `devalue`.
- [ ] `check.ts` runs oxfmt, oxlint and Markz's warnings; the report lists islands by tag.
- [ ] `dev` hot-replaces CSS and reloads for anything else.
- [ ] `spike/` goes, its findings already in design.md.

### 16. amitkaps.github.io

The real site, kept in its own private repo, ported on its `next` branch. Its notes stay there.

- [ ] Pages to `text/`, YAML to JSON in `data/`, the card grids as components, and the
      workshops, talks and teaching grids wrapped in `filter-grid`. Old `.html` URLs keep working.
- [ ] Compare with the SvelteKit site page by page: same content, less JavaScript. Whatever Sitez
      couldn't do goes back into idea.md or "Not in v1".

### 17. Release

- [ ] Publish `sitez` 0.2.0 to npm; check `npx sitez build` and `mise use -g npm:sitez` on a
      clean machine.
- [ ] Cloudflare: build amitkaps.github.io with `npx sitez build` from its git integration.

## Open questions

- **Rendered bodies in `pages`.** Whether each entry carries its page's HTML (for a feed with
  full posts, or an index with excerpts) as well as its metadata. The feed carries summaries
  until a site needs more.
- The rest are in [design.md](design.md#open-questions).
