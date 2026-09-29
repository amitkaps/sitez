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
  starts, not before. Markz comes from its v0.1.0 release tarball until it is on npm.

## Open work, in order

Each step ends in something a fixture site shows, so the step is done when its fixture builds and
its tests pass, not when the code is written. Error cases are fixtures too: a site that must fail,
with the message it must fail with.

### 0. Spikes

The design rests on four things nobody has shown work together. Each spike is a throwaway script
in `spike/`, deleted when its answer is folded into `design.md`.

- [ ] **Async server rendering.** A page whose `<script>` awaits a slow import renders complete
      HTML with Svelte's experimental async `render`. Closes design.md's open question, or reopens
      rule 5.
- [ ] **Islands from compiled output.** Compile a set of components (handler, `bind:`,
      transition, `{@attach}`, `$effect`, `onMount`, an `on…` prop, a spread) and find a signal in
      the compiled output (or the compiler's AST) that tells each apart from a static one. List
      what it misses.
- [ ] **Hydrating an island with children.** `hydrate` a server-rendered component whose children
      came from `createRawSnippet` and props from `devalue`, with no hydration mismatch.
- [ ] **Vite+ without a config.** Start the dev server and run a build from code, with the Svelte
      plugin and a virtual entry per page, from a folder with no `vite.config.ts` or
      `package.json`.

### 2. Pages (rules 1, 2, 5; metadata)

The `landing` fixture builds, then `blog` without its components.

- [ ] The site test: build every site in `test/sites/`, compare `dist/` with a snapshot, and
      check each `error-…` site fails with its `error.txt`.
- [ ] Discovery: every `.md` in `prose/`, every lowercase `.svelte` in `pattern/`, to a URL. Fails
      on two files for one URL, on `prose/site.md`, on a page named like a pattern.
- [ ] Metadata: the Markz block, `title` from the first heading, `summary` from the first
      paragraph; `export const metadata` from a Svelte page's module script, else its first
      `<h1>`. `draft` drops a page from `build`.
- [ ] Rendering: a prose page becomes a Svelte component, then every page renders with the
      nearest `Layout.svelte` up the tree, given `page`, `prose` and `site`. No layout means the
      page's HTML alone.
- [ ] Output: `dist/{url}/index.html`, `public/` copied as is.

Decide here: how a prose page reaches Svelte. The likely route is generating a `.svelte`
component from the Markz AST, so rule 3's components, islands inside prose and HMR all come from
Svelte rather than a second renderer. Markz's `html()` takes no options, so either Sitez renders
the AST itself or markz grows a hook; the second is a markz decision.

### 3. Components in prose (rule 3)

- [ ] `{@call-out}` renders `CallOut.svelte`, found up the tree from the page's URL; attributes
      are props, the body is children. No component: Markz's own HTML for the element.
- [ ] Markz's warnings are printed during `build` with file and line, and don't fail it.

### 4. Links (rule 4)

- [ ] Rewrite from the AST: `.md` targets to URLs (with `#fragment` kept), other repo files to
      `{repo}/blob/main/{path}`, code blocks untouched.
- [ ] Fail on a link to a missing page, a missing file, a draft, or a repo file with no `repo` in
      `site.md`, with the source position.
- [ ] Links in Svelte pages: decide whether `href`s in patterns are checked too (against the built
      URL set, after rendering). Promise 4 says prose; leave a `@note` if it should say more.

### 5. The site's own files (metadata)

- [ ] In `<head>`: `<title>`, meta description, canonical URL, Open Graph tags, from `page` and
      `site`.
- [ ] `sitemap.xml`, and `feed.xml` from pages with a `date`, newest first. Both need `url` in
      `site.md`; without it the build says so rather than writing relative URLs.

### 6. Styling and CSS bundling

- [ ] The baseline stylesheet: reset, text, links, code, images, tables, `<details>`, `popover`,
      `<dialog>`, and `@view-transition { navigation: auto }`.
- [ ] `public/style.css` after it; scoped component styles collected per page.
- [ ] Split into `common.css` and the page's `index.css`, content-hashed. A page links only what
      it uses.

### 7. Islands (rule 6)

The `blog` fixture's `TagFilter` hydrates; the error fixtures fail with their messages.

- [ ] Detection from step 0's signal; the island is the outermost interactive component below a
      page or layout.
- [ ] Fails: browser behavior in a page or layout (naming the component to move it into), a
      function prop (naming it), an island inside an island's children.
- [ ] Output: the `<sitez-island>` marker with `devalue` props and server-rendered HTML; children
      passed back through `createRawSnippet`.
- [ ] Client: one small entry that hydrates every marker on the page; `common.js` and the page's
      `index.js`, content-hashed. A page with no islands loads no JavaScript.

### 8. Build report

- [ ] Per page: html, css, js gzipped, and build time; the `common` row; page count, total time
      and the list of islands. Sorted by URL.

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

### 12. Release

- [ ] Publish `sitez` 0.1.0 to npm; check `npx sitez build` and `mise use -g npm:sitez` on a
      clean machine.
- [ ] Cloudflare: build the Markz site with `npx sitez build` from its git integration.

## Open questions

- **Rendered bodies in `prose`.** Whether each entry carries its page's HTML (for a feed with
  full posts, or an index with excerpts) as well as its metadata. Decide at step 5, when the feed
  needs it.
- The rest are in [design.md](design.md#open-questions).
