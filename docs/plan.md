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

The port's gaps are settled, each by having the site do it or by Sitez doing less. Only the
Markz fixes are left, and those go to markz.

- [x] The title suffix, `og:image` and Twitter tags, the reset and the font preload. 22 settles
      them: a page writes its whole `title`, Sitez writes a fixed Open Graph and Twitter set with
      no image, the reset goes, and `code/index.html` writes the preload.
- [x] Excerpts and dates. 22 settles them: a card shows the page's `description`, and the element
      that lists pages sorts them by `date` itself, so Sitez reads neither.
- [x] oxfmt reformatting JavaScript in code fences, and deploying from Cloudflare's git
      integration. 21 settles them: formatting, linting and deploying are the site's own.
- [ ] Markz: a quote closing after a single quote, and `\` as a line break.

### 21. A leaner core

Sitez does less, and depends on less. Two measures say whether it worked, taken at the start and
at the end, from the 0.2.0 baseline below.

- **Install:** a site's `node_modules`, 137 MB for amitkaps.github.io.
- **Code:** Sitez's source without tests, 3,258 lines, and idea.md, 2,952 words. A page's
  JavaScript, with amitkaps.github.io's `common` at 4.6 KB.

- [x] Live elements with no runtime. A `.live` file default-exports its element and imports
      nothing from Sitez. `define`, `html` in the browser, htl and the signals core went, so a
      page's script is its elements and `define`, under 0.2 KB.
- [x] One script for the site. Every live element a page uses goes in `script.[hash].js`, which
      only a page with a live element loads. `common.js`, page scripts and `modulepreload` went.
      A library loads with `await import()` inside its element, and two live files for one tag fail.
- [x] A `.live` file default-exports its element's class, and may import npm packages. The
      script defines each with one `customElements.define`, and `define.ts` went. A module
      imported with `await import()` is a chunk of its own.
  - amitkaps.github.io's two `.live` files are classes, waiting for the release after 0.2.0.
- [ ] elementz, later, in its own repo as `@amitkaps/elementz`. `element(setup)` returns a light-DOM
      element class that runs `setup` once per element, and calls the cleanup it returns on
      disconnect. It adds signals or templates only when a page needs them.
- [x] Sitez as a Vite plugin (`docs/design.md#toolchain`). A site's `vite.config.js` adds
      `sitez()` from `@amitkaps/sitez/vite`, and its `package.json` runs `vite`, `vite build` and
      `vite preview`. `vite` is a peer dependency and `vite-plus` a devDependency.
  - `cli.ts`, `check.ts`, `preview.ts`, `deploy.ts` and `root.ts` went, with their tests and the
    `bin` entry. `vite.ts` lost the config nobody writes, the resolver and the cache folder, and
    `dev.ts` its server, which is now Vite's own.
  - The spike settled how `build` renders: the plugin starts a Vite server from the site's config
    file, as `build` did before, in Vite's `buildApp` hook. Vite's environments were ruled out.
  - The site-must-name-sitez check went, since the import in `vite.config.js` is the check.
  - Every fixture has a `vite.config.js`, and the tests run `createBuilder` and `createServer`.
    `dist/` is byte for byte what 0.2.0 built for them.
- [x] Measured again, with the packed tarball in the blog fixture. A site's `node_modules` is
      31 MB (`vite`, Sitez and markz) against 137 MB. Sitez's source without tests is 2,887
      lines against 3,258, and 3,344 when this step began. idea.md grew to 3,528 words from 2,952,
      with the plan for 22. The blog's script is 0.3 KB gzipped. amitkaps.github.io's `common`
      isn't remeasured, since the site moves in 22.
- [ ] Whatever else 20 shows that Sitez needn't do.

### 22. Pages from `code/index.html`

Sitez reads less and fills in nothing (promise 4). A page is `code/index.html` with the page in
its `<slot>`, elements are named for when they run, and metadata reaches only the head and the
code. It starts once 21's plugin works, since `index.html` is the HTML Vite builds from. The
design is in [design.md](design.md#the-frame) and [Names in `code/`](design.md#names-in-code).

- [x] `code/index.html` replaces `+layout.js`, its `head` export and layouts up the tree. The page
      goes in its one `<slot>`. Sitez puts the page's `title` and `description` in place of
      `index.html`'s, and writes the canonical link and the seven Open Graph and Twitter tags.
      `head.ts` shrinks to that.
  - Fails: no `lang`, `charset`, `viewport`, `<title>` or description, a slot count other than
    one, and a hand-written canonical, `og:` or `twitter:` tag. Each message shows the line.
  - `head.ts` is the frame's checks and the head. `markup.ts` is a tag scanner, and `elements.ts`
    renders the elements in `index.html` and in an element's output.
- [x] CSS is what `index.html` links, bundled with hashed names. `+style.css` as a reserved name
      and the reset (`src/runtime/reset.css`) go. The script is still added by Sitez.
- [x] Metadata is explicit. A page's block gives `title`, `description`, `draft` and `redirects`,
      with no defaults from the first heading or paragraph. `summary` becomes `description`.
      `page` is the block and `url`. `site.md` requires `url`, reads `repo`, and passes every
      other key through as `site.*`. `name` and `lang` are no longer read.
- [x] Names for when code runs. `@name.js` becomes `@name.html.js` and `.live.js` becomes
      `.browser.js`. `@name.html` is a static element whose content goes in its `<slot>`.
  - Elements are global. Two files for one element fail, and so do a bare `@name.js` and an
    `@name.html` beside an `@name.html.js`.
  - Elements in `index.html` and in an element's output render like those in text, until none is
    left. An element that ends up inside itself fails, naming the chain.
  - The `+` sigil goes. A leftover `+layout.js` or `+style.css` fails, naming what replaces it.
- [x] A redirect page is `index.html` rendered with the page it reaches, a link in its slot and a
      refresh in its head.
- [x] `sitemap.xml` and `feed.xml` go, with `sitemap.ts`.
- [x] A file or folder whose name starts with `_` is skipped in every folder: never built,
      copied or linked to. That includes `public/`, which keeps a site from shipping Cloudflare's
      `_headers` and `_redirects`. The question is open in [design.md](design.md#open-questions).
- [x] Every fixture moves to the new names, with an error fixture for each new failure. An
      `error.txt` is a file snapshot now, so `vp test -u` writes it and the diff is the review.
- [x] amitkaps.github.io moves on a branch, `sitez-22`, unpushed. Its `+layout.js`, `heading.js`
      and `head` export become `code/index.html`. Each page writes its `# Title` and tagline, the
      grids become `.html.js`, the two `.live` files `.browser.js`, and `+style.css` loses the
      rules that undid the reset.
  - Its pages' text and styles match 0.2's, checked against a headless browser. The few rules the
    reset gave it that it relied on are in its `style.css` now.
  - Before it can merge, Sitez 0.3.0 is published, and the site's lockfile is made again.

### 23. Docs for users

idea.md is the spec, written for whoever builds Sitez. Users need a guide: install, the folders,
writing a page, an element, behavior, deploying, and every error with its fix.

- [ ] Decide what renders the guide. prose already reads this repo as a document, and Sitez
      building its own docs would test it on a second site.
- [ ] Write it once 20, 21 and 22 settle what it describes.

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
