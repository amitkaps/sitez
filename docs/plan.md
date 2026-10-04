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
- [x] 0.2.0 is on npm and in a GitHub Release, and amitkaps.github.io installs it from npm.
- [x] next.amitkaps.com is built with Sitez 0.2.0 from npm and deployed to Cloudflare by the
      site's CI. Taking it live at amitkaps.com is the site's own cutover, planned in its repo.

Next comes simplifying before adding. The site changes to fit Sitez where it can, and Sitez gets
leaner before it gets new features. The site doesn't have to match the old one.

### 20. Simplify the site

Each gap the port found is settled by changing amitkaps.github.io first. Sitez changes only when
the site can't do without it.

- [ ] A title suffix (`About | Amit Kapoor`) that the layout writes. Plain titles may do.
- [ ] `og:image` and Twitter tags in the head.
- [ ] Excerpts. The site reads Markz and the file system itself to get them.
- [ ] Essays carry a `date` for order, but the site never shows it. Pages with the same `date`
      need a stable order, or the essays need another way to be ordered.
- [ ] Sitez's reset, which the first rules of `+style.css` undo. Either the site takes the reset,
      or the reset gets smaller.
- [ ] Preloading a font the stylesheet names.
- [ ] Markz: a quote closing after a single quote, and `\` as a line break. Those changes go to
      markz.
- [ ] `sitez check` reformats JavaScript in code fences, which a page may show on purpose.
- [ ] Deploy from Cloudflare's git integration, as idea.md describes, in place of
      `wrangler-action` in CI. The CI then only checks.

### 21. A leaner core

Sitez does less, and depends on less. Two measures say whether it worked, taken at the start and
at the end, from the 0.2.0 baseline below.

- **Install:** a site's `node_modules`, 137 MB for amitkaps.github.io.
- **Code:** Sitez's source without tests, 3,258 lines, and idea.md, 2,952 words. A page's
  JavaScript, with amitkaps.github.io's `common` at 4.6 KB.

- [ ] Fewer and smaller dependencies, judged by what a site installs and what a page loads. A
      site's `node_modules` is 137 MB today, and almost all of it comes through `vite-plus`. Sitez
      uses only Vite's API at build and oxfmt and oxlint in `check`. Measured alone, `vite` is
      31 MB with Rolldown, oxlint 15 MB and oxfmt 16 MB.
  - Sitez depends on `vite`, `oxlint`, `oxfmt` and `@amitkaps/markz`, about 62 MB. `vite-plus`
    becomes a devDependency, for building and testing Sitez itself, so no site installs its
    tests or type-aware linting. Go from there.
  - `htl` and `@preact/signals-core` move into `src/runtime/`, keeping their licenses, so Sitez
    owns the runtime a page loads. That page's JavaScript is measured before and after.
  - `check` runs oxfmt and oxlint as its own dependencies. Ruled out: Biome (60 MB measured, not lighter), and ESLint,
    Prettier or `tsc`, which add packages or a JavaScript runtime for what oxc does natively.
- [ ] Whether `sitemap.xml` stays. Every site gets it, with no way out, and search engines find a
      small site's pages by its links. A sitemap page for humans, written from `pages`, would be
      the site's own.
- [ ] Whether `feed.xml` stays. Any page with a `date` joins it, so `date` both orders pages and
      publishes them. amitkaps.com's essays are dated only for order.
- [ ] Remove `sitez deploy` and `deploy.ts`, once amitkaps.github.io has run on Cloudflare for a
      week. idea.md already has one way to deploy: Cloudflare builds the repo with its own
      Wrangler, as prose's site does ([docs/design.md#deploy](design.md#deploy)).
- [ ] Whatever else 20 shows that Sitez needn't do.
- [ ] A spike without Vite, last. Node 24 runs a site's modules and strips TypeScript itself, and its
      module hooks can do the resolver's job. The work is in dev, where changed code must rerun,
      perhaps in a fresh worker per rebuild, and in hashing unbundled browser modules. It gives
      up nothing idea.md promises, since a `.live` file imports a library by its URL, never from
      `node_modules`.
      Build amitkaps.github.io with it behind the same tests, and compare it with the
      three-dependency Sitez: lines added against the ~700 in `vite.ts`, `bundle.ts` and
      `dev.ts`, install size, and reload time in dev. Vite goes if it wins on all three.

### 22. Docs for users

idea.md is the spec, written for whoever builds Sitez. Users need a guide: install, the folders,
writing a page, a component, a live element, deploying, and every error with its fix.

- [ ] Decide what renders the guide. prose already reads this repo as a document, and Sitez
      building its own docs would test it on a second site.
- [ ] Write it once 20 and 21 settle what it describes.

## Parked

- **Writing.** Writing is the real block, more than building. An editor view for Sitez, or a
  separate package (`editz`), would make a page easy to write.
- **A feed for short ideas.** A feed fits short, dated notes better than essays. It waits on
  the editor, and on 21 deciding what the feed is.

## Open questions

- **Rendered bodies in `pages`.** Each entry could carry its page's HTML as well as its metadata,
  for a feed with full posts or an index with excerpts. The feed carries summaries until a site
  needs more.
- The rest are in [design.md](design.md#open-questions).
