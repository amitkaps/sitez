# Plan

The order in which [design.md](design.md) gets built, and what each step must prove before the
next starts. The spec is [idea.md](idea.md); "rule N" means its rule N. This file holds only what
spans the codebase: the order of the work and items that touch several files. Once a file exists,
work that belongs to it is a pending `@prose` chunk there, not a line here. Finished steps shrink
to one line each.

## Done

- **Idea and design.** `prose/idea.md` (promises, rules, not in v1, three test sites),
  `prose/design.md` (toolchain, build, islands, bundling), `AGENTS.md`.
- **1. Skeleton.** The `sitez` package on Vite+ (`vp check`, `vp test`, `vp pack` to
  `dist/cli.js`), Node 26 and pnpm through `mise.toml`, CI on every PR; the CLI with its five
  commands, root finding from `site.md` and `SiteError` for the messages; the `blog`, `landing` and
  `error-reserved-site-md` sites in `test/sites/`. Each stage gets its file in `src/` as its step
  starts, not before. Markz comes from npm as `@amitkaps/markz`.
- **0. Spikes.** Async server rendering, island detection, hydrating islands with children, and
  Vite without a config all hold; their answers are in design.md, and the code is in `4343fcb`.
  Islands are read from the compiler's AST, not its output.
- **2. Pages.** `discover.ts` (URLs, two files for one URL, `prose/site.md`), `metadata.ts`
  (defaults, drafts, a Svelte page's `<h1>`), prose compiled as Svelte (`prose.ts`), rendering
  through Vite's module runner with the nearest layout (`vite.ts`, `render.ts`), and `build.ts`
  writing `dist/`. `test/sites.test.ts` builds every example site against `test/snapshots/`.
  Dropped: failing on "a page named like a pattern", since capitalization already decides.
- **Metadata checks.** `title`, `summary`, `date`, `draft` and a page's `url`, and `name`, `url`,
  `repo` in `site.md`, fail the build when wrong; no schema library, since site-specific keys are
  the site's to check.
- **3. Components in prose.** A Markz element renders the nearest component of its name
  (`discover.ts`'s `nearest`, shared with layouts), attributes as props and body as children;
  raw `=html` blocks are written verbatim rather than compiled (`prose.ts`). `build` prints Markz's
  warnings (`warnings.ts`). The `elements` site shows both, and `warnings.txt` snapshots them.
- **4. Links.** `links.ts`: page files to URLs, site links checked, `public/` files by path, other
  repo files to GitHub, images only from `public/`; a missing target, a draft or the 404 fails at
  its line. Rewritten in the view `html()` renders, so code is untouched. Every rendered page's
  `href` and `src` are checked too, so a layout's nav can't break.
- **5. The site's own files.** `head.ts` writes the head from metadata, with Twitter's card and
  `lang` (from `site.md`, `en` by default), and fails a `<svelte:head>` that writes those tags;
  `sitemap.ts` writes `sitemap.xml` and an RSS `feed.xml` of summaries; the 404 page is
  `404.html`; `url` in `site.md` is required. The social image is an open question in design.md.
- **6. Styling.** One stylesheet per site (`bundle.ts`): the reset as `@layer reset`
  (`src/runtime/reset.css`), `pattern/style.css`, then every rendered component's styles,
  content-hashed with the fonts and images it names; a `url()` that isn't there fails. The
  per-page CSS split was dropped: CSS is small, and one file is cached once.
- **7. Islands.** `islands.ts` reads browser behavior from the AST and wraps every imported
  component in the server render; `runtime/server.ts` decides per render what it is, writes the
  marker with `devalue` props, and fails a page or layout with behavior, a function prop, a
  handler through a spread, an island in an island's children and an island reading `prose`.
  Each page with islands gets its own entry, shared code goes in `common.js`, and
  `test/islands.test.ts` hydrates the built pages in happy-dom.

## Open work, in order

Each step ends in something a fixture site shows, so the step is done when its fixture builds and
its tests pass, not when the code is written. Error cases are fixtures too: a site that must fail,
with the message it must fail with.

### 8. Build report

- [ ] Per page: html, css, js gzipped, and build time; the `common` row; page count, total time
      and the list of islands. Sorted by URL.
- [ ] A notes column for what the numbers can't show, such as a raw `<script>` that may load
      more JavaScript than the build can count. Design it here.

### 9. Dev server

- [ ] `sitez dev` serves every page, drafts included, rendered on request.
- [ ] A page change reloads that page; CSS and islands hot-replace. A new or deleted file updates
      the URL set without a restart.
- [ ] Build errors show in the browser with the same message `build` prints.

### 10. The rest of the CLI

- [ ] `sitez preview`: serve `dist/` with the same URLs a static host gives.
- [ ] `sitez check`: oxfmt and oxlint over `prose/` and `pattern/`, `svelte-check`, Markz
      warnings. Exits non-zero on any problem.
- [ ] `sitez deploy`: push `dist/` to `gh-pages` with the user's git when the remote is GitHub;
      anything else says how to deploy instead.

### 11. The Markz site

idea.md's third test, run for real, on a branch of markz.

- [ ] Add `site.md`, rename `prose/markz.md` to `index.md`, move the patterns into `pattern/`,
      delete the SvelteKit routes, `pages.ts` and the Worker config.
- [ ] The Quality page awaits the harness at build time; `QualityReport.svelte` is an island.
- [ ] Compare with today's site page by page: same content, less JavaScript. Whatever Sitez
      couldn't do goes back into idea.md or "Not in v1".

### 11b. A personal site

A second real site, kept in its own private repo: flat, content-heavy, with data grids, a 404 page
and old `.html` URLs, where the Markz site is docs. Its notes stay in that repo.

- [ ] Port it on a branch: URLs from paths, raw HTML rewritten as Markz, data grids as element
      components (the filterable ones islands), its data as JSON beside the patterns.
- [ ] Compare with the current site page by page, as for the Markz site.

### 12. Release

- [ ] Publish `sitez` 0.1.0 to npm; check `npx sitez build` and `mise use -g npm:sitez` on a
      clean machine.
- [ ] Cloudflare: build the Markz site with `npx sitez build` from its git integration.

## Open questions

- **Rendered bodies in `prose`.** Whether each entry carries its page's HTML (for a feed with
  full posts, or an index with excerpts) as well as its metadata. The feed carries summaries
  until a site needs more.
- The rest are in [design.md](design.md#open-questions).
