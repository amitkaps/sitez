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
  ([spike/](https://github.com/amitkaps/sitez/tree/465e738/spike), since removed). It loads 2 KB of JavaScript against 206 KB, sends no data
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
  `@`, `+` and `.live` names, and components that wrap.
- **14. Names in `code/`, and components that wrap.** Pages are only text, `@name.js` renders an
  element and Sitez writes the element around it, and `+layout.js` exports `head`. `data` feeds a
  component from `data/`. `checkCode` fails on an unknown `+` file, a bad `@` name and a second
  stylesheet.
- **15. Live elements.** A page's HTML is scanned for tags with an `@name.live.js` file, and each
  page loads its own, split with `common.js`. Build code importing a live file fails, and so does
  a live file importing a component or layout. `live.test.ts` runs the pages in happy-dom.
- **16. Svelte goes.** `islands.ts`, the Island files, the Svelte plugin and the four Svelte
  dependencies are deleted, with `spike/`, whose findings are in design.md. `dev` hot-replaces CSS
  and reloads for anything else, and the report lists live elements by tag.
- **17. A site names its Sitez.** Every command fails in a site whose `package.json` doesn't name
  `sitez`, and the report's last line names the version that ran. Every fixture has a
  `package.json`. An inline element whose output would end its paragraph fails the build.
- **Redirects.** A page lists its old URLs under `redirects`, and `build` writes a page at each
  that refreshes to it. A redirect a page has, or a link to one, fails, and `dev` answers with a 301.

## Open work, in order

Each step ends in something a fixture site shows. So a step is done when its fixture builds and
its tests pass, not when the code is written. Error cases are fixtures too, each a site that must
fail with the message it must fail with.

### 18. amitkaps.github.io

The real site, kept in its own private repo, is ported on its `next` branch. Its notes stay
there.

- [ ] Pages go to `text/`, YAML becomes JSON in `data/`, and the card grids become components
      given `data`. The workshops, talks and teaching grids are each a `filter-grid` with a
      `.live` file. Pages keep their folders, and each one that moved lists its old URLs under
      `redirects`.
- [ ] Compare with the SvelteKit site page by page, for the same content with less JavaScript.
      Whatever Sitez couldn't do goes back into idea.md or "Not in v1".

### 19. Release

- [x] Sitez is 0.2.0, published as `@amitkaps/sitez` with the command `sitez`. A `v*` tag runs the release workflow, which stages
      the version on npm and attaches the tarball to a GitHub Release. The packed tarball,
      installed with `npm install` in a fresh copy of amitkaps.github.io, builds the same `dist/`.
- [ ] Publish 0.2.0 to npm by hand, then set up the trusted publisher
      ([docs/design.md#release](design.md#release)), and tag `v0.2.0`.
- [ ] Build amitkaps.github.io on Cloudflare with `npx sitez build`, from its git integration.

## Open questions

- **Rendered bodies in `pages`.** Each entry could carry its page's HTML as well as its metadata,
  for a feed with full posts or an index with excerpts. The feed carries summaries until a site
  needs more.
- The rest are in [design.md](design.md#open-questions).
