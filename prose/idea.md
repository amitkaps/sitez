# Sitez

**Sitez is a zero-config static site generator: Markz in `prose/`, Svelte in `pattern/`, files in
`public/`. Run `sitez build`, get complete HTML.**

## Promises

1. **Three folders and a file.** `prose/` is content, `pattern/` is presentation, `public/` is
   files copied as they are, and `site.md` is the site's metadata. There is no configuration.
2. **A file is a page.** Its path is its URL. There is no route file.
3. **Every page is complete HTML.** The build does the work so the browser doesn't.
4. **Links are checked.** Prose links to files, Sitez turns them into URLs, and a broken link
   anywhere on a page fails the build.
5. **JavaScript only where a page is interactive, and you see what every page costs.**

The line Sitez holds: static pages, islands and prose. Anything that needs more is a different
tool.

## Three folders

```text
site/
├── site.md               the site's metadata
├── prose/
│   ├── index.md          → /
│   ├── about.md          → /about/
│   └── blog/
│       ├── hello.md      → /blog/hello/
│       └── again.md      → /blog/again/
├── pattern/
│   ├── style.css         the site's stylesheet
│   ├── Layout.svelte     wraps every page
│   ├── CallOut.svelte    renders {@call-out} in prose
│   ├── TagFilter.svelte  interactive, so an island
│   └── blog/
│       ├── index.svelte  → /blog/
│       └── Layout.svelte wraps /blog/*
└── public/
    └── favicon.svg       → /favicon.svg
```

## The rules

1. **A file is a page.** Every `.md` in `prose/` and every lowercase `.svelte` in `pattern/` is one
   URL, from its path. `index` is the folder's own URL. Two files for one URL is an error.
   `prose/404.md` (or `pattern/404.svelte`) is the page a host serves for a URL that doesn't
   exist, so it is written as `404.html`, and nothing links to it.
   `.js` and `.ts` files in `pattern/` are modules for patterns to import: never pages, never
   copied to the output.
2. **Capitalized `.svelte` files are patterns a page uses, not pages.** Sitez finds them up the
   tree from the page's URL: `pattern/blog/Layout.svelte` wraps `/blog/` and everything below it,
   and anything outside it gets `pattern/Layout.svelte`. Components resolve the same way, so where
   a pattern sits says what it belongs to.
3. **Markz elements are components.** `{@call-out}` … `{/call-out}` in `prose/blog/hello.md`
   renders `pattern/blog/CallOut.svelte`, or `pattern/CallOut.svelte` if there isn't one, with its
   attributes as props and its body as children. Markz requires the
   hyphen, so an element name always maps to a component name. An element with no component is
   written as Markz writes it.
4. **Links follow files.** `[hello](blog/hello.md)` becomes `/blog/hello/`, so prose reads the
   same on GitHub and on the site. A link to a URL on the site, `[About](/about)`, is checked the
   same way; a path on the same domain that this site doesn't build is written in full, as any
   other site's would be. A link to another file in the repo, such as source code, goes
   to that file on GitHub, from `repo` in `site.md`; an image has to be in `public/`. Sitez knows
   every URL, so a link to a page or file that doesn't exist fails the build. A draft doesn't
   exist in `build`, so linking to one fails too, rather than shipping a broken link. Patterns
   write URLs, not files, and every link in a built page is checked the same way: a layout's
   `<a href="/blog">` fails, asking for `/blog/`, the URL as the site serves it.
5. **Patterns run at build time.** Pages and layouts get `page`, this page's URL and metadata;
   `prose`, the same for every prose page; and `site`, the metadata in `site.md`. So does a
   component a Markz element renders, since prose can't pass them: `{@essay-list /}` in
   `prose/essays.md` can list the essays. Other components get only the props they're passed.

   ```svelte
   <script>
   	let { page, prose, site } = $props();
   	const posts = prose.filter((p) => p.url.startsWith('/blog/') && p.date);
   </script>
   ```

   A Svelte page states its own metadata, as a prose page's block does:

   ```svelte
   <script module>
   	export const metadata = { title: 'Blog' };
   </script>
   ```

   Its `<script>` can import any module and compute with it, including `await` for slow work,
   which is how a page gets data that isn't prose. The build waits for all of it.

6. **A component with browser behavior is an island.** Browser behavior is an event handler, a
   binding, an effect, a transition, an action or attachment, or an `on…` prop passed to a child.
   Such a component also ships its JavaScript and hydrates its HTML as the page loads, along with
   everything inside it; the patterns around it stay HTML. There is nothing to mark.

   - **Pages and layouts are never islands.** Browser behavior in one fails the build, naming
     the component to move it into.
   - **Props are data.** Strings, numbers, objects, arrays and dates cross into the browser. A
     function doesn't, and passing one fails the build, naming the prop. An island gets `page` or
     `site` only if it reads them, and reading `prose` fails, since every page's metadata would
     ship with it: compute what it needs outside it and pass that in.
   - **Children are HTML.** An island's children are rendered at build time and handed to it
     finished, so an interactive wrapper can hold prose: `{@tab-set}` … `{/tab-set}`. An island
     inside another island's children fails the build.

7. **HTML before JavaScript.** Pages link with `<a>`, and Sitez's reset turns on cross-document
   View Transitions. `<details>`, `popover` and `<dialog>` open, close and toggle without
   JavaScript, so many interactive pieces don't need an island.

## Metadata

Markz reads a metadata block at the top of a document. Sitez fills in what it leaves out: `title`
defaults to the first heading and `summary` to the first paragraph, so most pages need no block.
A Svelte page without `metadata` gets its title from its first `<h1>`.

```md
---
title: Shorter title
date: 2026-09-29
draft: true
---
```

- `date` puts a page in the RSS feed.
- `draft` keeps it out of `build`, not out of `dev`.
- `title` is the page's `<title>` and `summary` its description: Sitez writes both into the
  page's `<head>`, so a page's head changes with its metadata, not its patterns.

Sitez checks the keys it reads: a `draft: yes` or a `date: Sept 1` fails the build, naming the
file and the key, rather than publishing a draft or misdating a post. Any other key is the site's
own and passes through to its patterns unchecked.

Site-wide metadata lives in `site.md` at the root, in the same Markz metadata block:

```md
---
name: Amit Kapoor
url: https://amitkaps.com
repo: https://github.com/amitkaps/site
lang: en
---

Notes for whoever maintains the site. Sitez reads only the block above.
```

`lang` is the language of every page, `en` unless it says otherwise. `url` is required: the sitemap, the feed and every page's canonical link are full addresses, so
`build` fails without it rather than writing relative ones.

It is also how Sitez finds the site: the folder holding `site.md` is the root, from wherever
`sitez` runs inside it. So `site.md` is reserved: `prose/site.md` is an error, not a page. It
works for a site with no `prose/` at all.

From that, Sitez writes `<title>`, the meta description, canonical URLs, Open Graph tags,
`sitemap.xml` and `feed.xml`; Twitter reads the Open Graph tags. A pattern's `<svelte:head>` can add anything else, but writing one
of those tags itself fails, naming the metadata key that sets it.

## Styling

A site has one stylesheet, and every page links it. It starts with Sitez's reset, a typographic
starting point for plain HTML: `system-ui` text, readable line heights, `box-sizing`, images that
fit their column, form controls in the page's font, and code in a monospace one. It has no
colors, no theme and no design of its own. It is `@layer reset`, so any rule a site writes
overrides it.

`pattern/style.css`, if there is one, is the site's own design and follows the reset, then each
component's scoped `<style>`. There is no other styling mechanism. Like everything in `pattern/`,
it is processed, not copied: a font or image it names with `url()` is bundled with a hashed name,
and one that isn't there fails the build.

```css
@font-face {
	font-family: 'Inter';
	src: url('./fonts/Inter.woff2') format('woff2');
}
```

## The CLI

```bash
sitez dev      # serve with live reload
sitez build    # write dist/
sitez preview  # serve dist/ as it will be deployed
sitez check    # format, lint and type-check
sitez deploy   # publish dist/
```

`dist/` is ordinary static files and can be hosted anywhere. `build` ends with what each page
costs to send, gzipped, and to build:

```text
page        html    css    js   time
/           4 KB    —      —   12 ms
/blog/      6 KB  1 KB  5 KB   20 ms
/quality/  90 KB  2 KB 14 KB   1.2 s
common            3 KB 12 KB
42 pages in 1.8 s · islands: ThemeToggle, TagFilter, QualityReport
```

`common` is what pages share and the browser downloads once. A page that grows heavy or slow is
visible where the cost is.

`sitez deploy` publishes to GitHub Pages when the repo's remote is on GitHub. Cloudflare needs no
Sitez command: connect the repo in Cloudflare and set the build command to `npx sitez build`.

## Not in v1

Hydrating whole pages, islands inside islands, delaying islands (until visible, until idle),
Markz expressions (`${…}` stays code, as Markz writes it), dynamic routes, pagination, tags,
image processing, i18n, content schemas, themes, plugins and settings in `site.md` beyond
metadata.

Each one is a way to add configuration, which is the thing Sitez removes. A site that needs a
client router, `load`, endpoints or server output should use SvelteKit.

## Tests of the idea

Three sites, run against the rules.

**A personal blog** (home, about, posts, RSS). Fits. `prose/blog/*.md` with `date`, a
`pattern/blog/index.svelte` listing `prose` filtered to `/blog/`, one `Layout.svelte`, and
`site.md` with a name and URL. No route file, no metadata on pages that start with a heading.

**A landing page.** Fits. `pattern/index.svelte`, `public/` and `site.md`. No `prose/` needed.

**The Markz site** (markz.amitkaps.com, today SvelteKit on a Worker). Fits, with two changes.
The repo root is the site root: its `prose/` is already the site's content, all five files of it,
so the `[slug]` route, `entries` list and `SOURCES` table disappear. Titles and summaries come from
metadata defaults. Links between the docs follow rule 4, and `grammar.md`'s link to
`../test/harness/cases.ts` goes to GitHub through `repo` in `site.md`, as `pages.ts` does by hand
today.

- **The Quality page** runs the test harness at build time, then filters rows in the browser. The
  page's `<script>` awaits the harness during the build (rule 5). Its interactive body moves into
  `QualityReport.svelte`, which is an island because it has event handlers, and the page passes
  it `rows`, `edges` and `quality` as data (rule 6).
- **The home page is `prose/markz.md`,** not `index.md`, so it is renamed.

How Sitez is built is in [design.md](design.md).
