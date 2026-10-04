# Sitez

**Sitez is a zero-config static site generator: Markz in `text/`, JavaScript in `code/`, files in
`public/`. Run `sitez build`, get complete HTML.**

## Promises

1. **Three folders and a file.** `text/` is what you write, `code/` is what builds and styles it,
   `public/` is files copied as they are, and `site.md` is the site's metadata. A fourth folder,
   `data/`, holds JSON when the code needs some. There is no configuration.
2. **A file is a page.** Its path is its URL. There is no route file.
3. **Every page is complete HTML.** The build does the work so the browser doesn't.
4. **Links are checked.** Text links to files, Sitez turns them into URLs, and a broken link
   anywhere on a page fails the build.
5. **JavaScript only where a page is interactive, and you see what every page costs.**

The line Sitez holds: static pages, islands and text. Anything that needs more is a different
tool.

## Folders

```text
site/
├── site.md                  the site's metadata
├── text/
│   ├── index.md             → /
│   ├── about.md             → /about/
│   └── blog/
│       ├── hello.md         → /blog/hello/
│       └── again.md         → /blog/again/
├── code/
│   ├── style.css            the site's stylesheet
│   ├── Head.js              added to every page's <head>
│   ├── Layout.js            wraps every page
│   ├── CallOut.js           renders {@call-out} in text
│   ├── tag-filter.island.js interactive, so an island
│   ├── _format.js           a module the code imports
│   └── blog/
│       ├── index.js         → /blog/
│       └── Layout.js        wraps /blog/*
├── data/
│   └── talks.json           imported by the code
└── public/
    └── favicon.svg          → /favicon.svg
```

**A folder is named for the kind of file written in it**, so a file's extension says where it
goes:

| Folder    | Holds                                                      | Because                                     |
| --------- | ---------------------------------------------------------- | ------------------------------------------- |
| `text/`   | `.md`                                                      | words, read as they are and on GitHub       |
| `code/`   | `.js` or `.ts`, `.css`, and the fonts and images CSS names | what runs or styles, processed by the build |
| `data/`   | `.json`                                                    | values the code imports                     |
| `public/` | anything                                                   | copied as it is, `.html` included           |

Any other file in `text/` fails the build, naming it and pointing to `public/`. Inside `code/`,
the folder gives a file its scope and the name gives its role: lowercase is a page, capitalized is
a layout or component, `.island.js` is an island and `_` is a module.

## The rules

1. **A file is a page.** Every `.md` in `text/` and every lowercase `.js` or `.ts` in `code/` is
   one URL, from its path. `index` is the folder's own URL. Two files for one URL is an error.
   `text/404.md` (or `code/404.js`) is the page a host serves for a URL that doesn't exist, so it
   is written as `404.html`, and nothing links to it. A file in `code/` whose name starts with `_`
   is a module for the code to import, and an island is never a page: neither is copied to the
   output. `data/` is the same for JSON.
2. **Capitalized files are layouts and components.** Sitez finds them up the tree from the page's
   URL: `code/blog/Layout.js` wraps `/blog/` and everything below it, and anything outside it gets
   `code/Layout.js`. `Head.js` and components resolve the same way, so where a file sits says what
   it belongs to.
3. **A Markz element is an HTML element first.** `{@call-out type="note"}` is written as
   `<call-out type="note">`, a valid HTML element that CSS can style, and that may be all it
   needs. When the markup has to change, `code/CallOut.js` (found up the tree, as a layout is)
   renders it instead, with its attributes as props and its body as children. When it needs
   behavior, `code/call-out.island.js` makes it an island (rule 6). Markz requires the hyphen, so
   an element name always maps to these file names.
4. **Links follow files.** `[hello](blog/hello.md)` becomes `/blog/hello/`, so text reads the
   same on GitHub and on the site. A link to a URL on the site, `[About](/about)`, is checked the
   same way; a path on the same domain that this site doesn't build is written in full, as any
   other site's would be. A link to another file in the repo, such as source code, goes
   to that file on GitHub, from `repo` in `site.md`; an image has to be in `public/`. Sitez knows
   every URL, so a link to a page or file that doesn't exist fails the build. A draft doesn't
   exist in `build`, so linking to one fails too, rather than shipping a broken link. Code writes
   URLs, not files, and every link in a built page is checked the same way: a layout's
   `<a href="/blog">` fails, asking for `/blog/`, the URL as the site serves it.
5. **Code runs at build time.** A page, layout or component is a function that returns HTML,
   written with `html` from `sitez`, which escapes every value it interpolates. Each gets `page`,
   this page's URL and metadata; `pages`, the same for every page; and `site`, the metadata in
   `site.md`. So `{@essay-list /}` in `text/essays.md` can list the essays.

   ```js
   // code/blog/index.js → /blog/
   import { html } from "sitez";

   export const metadata = { title: "Blog" };

   export default ({ pages }) => html`
     <ul>
       ${pages
         .filter((p) => p.url.startsWith("/blog/") && p.date)
         .map((p) => html`<li><a href=${p.url}>${p.title}</a></li>`)}
     </ul>
   `;
   ```

   A JS page states its own metadata with `metadata`, as a text page's block does. A function can
   be `async` and a template can hold promises, which is how a page gets data that isn't text: an
   import from `data/`, or anything it computes. The build waits for all of it. A function in a
   template fails the build, naming the file: at build time it could only be an event handler,
   and those belong to islands.

6. **Browser behavior lives in islands.** `code/tag-filter.island.js` defines `<tag-filter>`, a
   custom element, and runs only in the browser. A page whose HTML has no island tag loads no
   JavaScript.

   ```js
   // code/tag-filter.island.js
   import { define, effect, signal } from "sitez";

   define("tag-filter", (el) => {
     const active = signal("");
     for (const b of el.querySelectorAll("button")) b.onclick = () => (active.value = b.value);
     effect(() => {
       for (const post of el.querySelectorAll("[data-tag]"))
         post.hidden = !!active.value && post.dataset.tag !== active.value;
     });
   });
   ```

   - **An island enhances HTML the build wrote.** It finds its content and controls in the page
     and adds behavior. Whatever it shows is written at build time, by a component of the same
     name when it needs one (`TagFilter.js` writes `<tag-filter>` and its buttons), so nothing
     moves when its script runs.
   - **An island reads its children and its attributes.** No data is sent to it besides the
     page's HTML, so nothing is sent twice.
   - **The two sides stay apart.** Build-time code that imports an island, or an island that
     imports a page, layout or component, fails the build, naming the import.

7. **HTML before JavaScript.** Pages link with `<a>`, and Sitez's reset turns on cross-document
   View Transitions. `<details>`, `popover` and `<dialog>` open, close and toggle without
   JavaScript, so many interactive pieces don't need an island.

## Metadata

Markz reads a metadata block at the top of a document. Sitez fills in what it leaves out: `title`
defaults to the first heading and `summary` to the first paragraph, so most pages need no block.
A JS page without `metadata` gets its title from its first `<h1>`.

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
  page's `<head>`, so a page's head changes with its metadata, not its code.

Sitez checks the keys it reads: a `draft: yes` or a `date: Sept 1` fails the build, naming the
file and the key, rather than publishing a draft or misdating a post. Any other key is the site's
own and passes through to its code unchecked.

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

`lang` is the language of every page, `en` unless it says otherwise. `url` is required: the
sitemap, the feed and every page's canonical link are full addresses, so `build` fails without it
rather than writing relative ones.

It is also how Sitez finds the site: the folder holding `site.md` is the root, from wherever
`sitez` runs inside it. So `site.md` is reserved: `text/site.md` is an error, not a page. It works
for a site with no `text/` at all.

From that, Sitez writes `<title>`, the meta description, canonical URLs, Open Graph tags,
`sitemap.xml` and `feed.xml`; Twitter reads the Open Graph tags. `Head.js` adds anything else to
the head, such as icons and font preloads, and is given `page`, `pages` and `site` like a layout.
Writing one of Sitez's own tags there fails, naming the metadata key that sets it.

## Styling

A site has one stylesheet, and every page links it. It starts with Sitez's reset, a quiet look
for plain HTML, so a page with no CSS of its own already reads well: one centered column about
sixty characters wide in `system-ui`, a type scale with balanced headings, pretty paragraphs and
a softer standfirst under the title, soft ink on off-white paper that follows the reader's light
or dark setting, and tables, forms, code, quotes and figures that look finished. It is `@layer
reset`, so any rule a site writes overrides it, however specific; a full-width layout starts with
`body { width: auto }`.

`code/style.css`, if there is one, is the site's own design and follows the reset. It can
`@import` other files, and there is no other styling mechanism. An element from text is
`display: inline` until the site's CSS says otherwise, as for any custom element, so a block
element the site hasn't styled runs into its paragraph, visibly. Like everything in `code/`, the
stylesheet is processed, not copied: a font or image it names with `url()` is bundled with a
hashed name, and one that isn't there fails the build.

```css
@font-face {
  font-family: "Inter";
  src: url("./fonts/Inter.woff2") format("woff2");
}
```

## The CLI

```bash
sitez dev      # serve with live reload
sitez build    # write dist/
sitez preview  # serve dist/ as it will be deployed
sitez check    # fix what's safe (format, lint fixes), then report the rest
sitez deploy   # publish dist/
```

`dist/` is ordinary static files and can be hosted anywhere. `build` ends with what each page
costs to send, gzipped, and to build:

```text
page          html      js   time
/           4.0 KB       —  12 ms
/teaching/  5.5 KB  2.0 KB  20 ms
/quality/    90 KB   14 KB  1.2 s  raw <script>
common      3.0 KB css, 1.5 KB js
42 pages in 1.8 s → dist · islands: filter-grid, theme-toggle
```

A page's `js` is what only it loads; `common` is the stylesheet and what pages share, which the
browser downloads once. A page that grows heavy or slow is visible where the cost is, and a note
says what the numbers can't: a raw `<script>` loads whatever it loads.

`sitez deploy` publishes to GitHub Pages when the repo's remote is on GitHub. Cloudflare needs no
Sitez command: connect the repo in Cloudflare and set the build command to `npx sitez build`.

## Not in v1

Islands that render from data (a JSON child comes when a site needs one), rendering pages in the
browser, delaying islands (until visible, until idle), Markz expressions (`${…}` stays code, as
Markz writes it), dynamic routes, pagination, tags, image processing, i18n, content schemas,
themes, plugins and settings in `site.md` beyond metadata.

Each one is a way to add configuration, which is the thing Sitez removes. A site that needs a
client router, `load`, endpoints or server output should use SvelteKit.

## Tests of the idea

Three sites, run against the rules.

**A personal blog** (home, about, posts, RSS). Fits. `text/blog/*.md` with `date`, a
`code/blog/index.js` listing `pages` filtered to `/blog/`, one `Layout.js`, and `site.md` with a
name and URL. No route file, no metadata on pages that start with a heading.

**A landing page.** Fits. `code/index.js`, `public/` and `site.md`. No `text/` needed.

**amitkaps.github.io** (amitkaps.com, today SvelteKit on Cloudflare). Fits: flat, content-heavy,
with card grids, a 404 page and old `.html` URLs. Its pages become `text/`, its YAML becomes JSON
in `data/`, and the grids become components. The workshops, talks and teaching grids filter by
category, so each is wrapped in a `filter-grid` island whose buttons its component writes. The
teaching page was built this way first: 2 KB of JavaScript, where the SvelteKit page loads
206 KB.

How Sitez is built is in [design.md](design.md).
