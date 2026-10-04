# Sitez

**Sitez is a zero-config static site generator. Markz goes in `text/`, JavaScript in `code/`,
JSON in `data/` and files in `public/`. Run `sitez build`, get complete HTML.**

## Promises

1. **Four folders and two files.** `text/` is what you write, and `code/` is what renders and
   styles it. `data/` is the JSON the code reads, and `public/` is files copied as they are.
   `site.md` is the site's metadata, and `package.json` names the Sitez that builds it. There is
   no configuration.
2. **A text file is a page.** Its path is its URL. There is no route file.
3. **Every page is complete HTML.** The build does the work so the browser doesn't.
4. **Links are checked.** Text links to files, and Sitez turns them into URLs. A broken link
   anywhere on a page fails the build.
5. **JavaScript only where a page is interactive, and you see what every page costs.**

Sitez holds a line at static pages, written as text, with elements that render at build time and
behave in the browser. Anything that needs more is a different tool.

## Folders

```text
site/
├── site.md                  the site's metadata
├── package.json             the version of Sitez
├── text/
│   ├── index.md             → /
│   ├── about.md             → /about/
│   └── blog/
│       ├── index.md         → /blog/
│       ├── hello.md         → /blog/hello/
│       └── again.md         → /blog/again/
├── code/
│   ├── +style.css           the site's stylesheet
│   ├── +layout.js           wraps every page, and adds to its <head>
│   ├── @call-out.js         renders {@call-out} in text
│   ├── @tag-filter.js       writes <tag-filter> and its buttons
│   ├── @tag-filter.live.js  wires the buttons in the browser
│   ├── format.js            a module the code imports
│   └── blog/
│       ├── +layout.js       wraps /blog/*
│       └── @post-list.js    renders {@post-list} under /blog/
├── data/
│   └── talks.json           read by the code
└── public/
    └── favicon.svg          → /favicon.svg
```

**A folder is named for the kind of file written in it**, so a file's extension says where it
goes.

| Folder    | Holds                                                           | Because                                     |
| --------- | --------------------------------------------------------------- | ------------------------------------------- |
| `text/`   | `.md`                                                           | words, read as they are and on GitHub       |
| `code/`   | `.js` or `.ts`, `+style.css`, and the fonts and images it names | what runs or styles, processed by the build |
| `data/`   | `.json`                                                         | values the code reads                       |
| `public/` | anything                                                        | copied as it is, `.html` included           |

Any other file in `text/` fails the build, naming it and pointing to `public/`, or to `data/` for
JSON.

**Inside `code/`, the folder gives a file its scope and the first character of its name gives its
role.**

| Name                       | Is                                                   |
| -------------------------- | ---------------------------------------------------- |
| `@name.js`                 | an element's markup, rendered at build time (rule 5) |
| `@name.live.js`            | an element's behavior, run in the browser (rule 6)   |
| `+layout.js`, `+style.css` | a file Sitez reads by name                           |
| anything else              | a module the code imports, never output              |

`@` is the same mark as Markz's `{@name}`, so an element's files are found by its name. `.ts`
works wherever `.js` does, and a `.js` and a `.ts` of the same name fail the build. An unknown `+`
file fails, so a misspelled `+layuot.js` is never silently ignored. So does an `@` file without a
hyphen, which no element could use.

## The rules

1. **A text file is a page.** Every `.md` in `text/` is one URL, from its path. `index.md` is the
   folder's own URL, so `about.md` and `about/index.md` are two files for one URL, which is an
   error. `text/404.md` is the page a host serves for a URL that doesn't exist. It is written as
   `404.html`, and nothing links to it. Nothing in `code/` or `data/` is copied to the output.
2. **Layouts resolve up the tree.** Sitez finds `+layout.js` up the tree from the page's URL.
   `code/blog/+layout.js` wraps `/blog/` and everything below it, and anything outside it gets
   `code/+layout.js`. Components resolve the same way, so where a file sits says what it belongs
   to.

   ```js
   // code/+layout.js
   import { html } from "sitez";

   export const head = () => html`<link rel="icon" href="/favicon.svg" />`;

   export default ({ children, site }) => html`
     <header><a href="/">${site.name}</a></header>
     <main>${children}</main>
   `;
   ```

   A layout gets the page's HTML as `children`, and `page`, `pages` and `site` as a component
   does. Its `head` export adds to the page's `<head>` ([Metadata](#metadata)).

3. **A Markz element is an HTML element first.** `{@call-out type="note"}` is written as
   `<call-out type="note">`. That's a valid HTML element that CSS can style, and it may be all it
   needs. An element can have a file for its markup, one for its behavior, both or neither.

   | Files in `code/`    | The element                                                   |
   | ------------------- | ------------------------------------------------------------- |
   | neither             | is plain HTML, styled by CSS                                  |
   | `@call-out.js`      | has its markup written at build time                          |
   | `@call-out.live.js` | has behavior, on the markup the text writes                   |
   | both                | has its markup written by the build, and wired in the browser |

   Markz requires the hyphen, so every element name maps to these file names.

4. **Links follow files.** `[hello](blog/hello.md)` becomes `/blog/hello/`, so text reads the
   same on GitHub and on the site.
   - A link to a URL on the site (`[About](/about)`) is checked the same way. A path on the same
     domain that this site doesn't build is written in full, as any other site's would be.
   - A link to another file in the repo, such as source code, goes to that file on GitHub, from
     `repo` in `site.md`. An image has to be in `public/`.
   - Sitez knows every URL, so a link to a page or file that doesn't exist fails the build. A
     draft doesn't exist in `build`, so linking to one fails too, rather than shipping a broken
     link.
   - Code writes URLs, not files, and every link in a built page is checked the same way. A
     layout's `<a href="/blog">` fails, asking for `/blog/`, the URL as the site serves it.

5. **Components render at build time.** `@post-list.js` is a function that returns the inner HTML
   of `<post-list>`. Sitez writes the element around it, with its attributes. So CSS and the
   element's `.live` file always find it, and nothing moves when the page loads. The function is
   written with `html` from `sitez`, which escapes every value it interpolates. It gets the
   element's attributes and its content as `children`. It also gets three things every page has.
   `page` is this page's URL and metadata, `pages` is the same for every page, and `site` is the
   metadata in `site.md`. So `{@post-list /}` in `text/blog/index.md` can list the posts.

   ```js
   // code/blog/@post-list.js renders {@post-list} under /blog/
   import { html } from "sitez";

   export default ({ pages }) => html`
     <ul>
       ${pages
         .filter((p) => p.url.startsWith("/blog/") && p.date)
         .map((p) => html`<li><a href=${p.url}>${p.title}</a></li>`)}
     </ul>
   `;
   ```

   - **Data comes in as an attribute.** `{@card-grid data="talks.json"}` reads
     `data/talks.json` and passes the parsed JSON as `data`. A path that isn't there fails the
     build, as a broken link does. The attribute isn't written to the page. Code can also import
     from `data/` itself, as a layout listing talks would.
   - **The build waits.** A function can be `async`, and a template can hold promises.
   - **A function in a template fails the build,** naming the file. At build time it could only
     be an event handler, and those belong to `.live` files.
   - **An attribute named `page`, `pages`, `site` or `children` fails,** since every component
     already gets those.
   - **An element inside a paragraph returns inline HTML.** A `<div>` or `<ul>` from
     `[term]{@key-word}` would end the paragraph early, so it fails the build, naming the element
     and the tag.

6. **Browser behavior lives in `.live` files.** `code/@tag-filter.live.js` defines
   `<tag-filter>`, a custom element, and runs only in the browser. It ships only to pages whose
   HTML has a `<tag-filter>`. A page with no live element loads no JavaScript.

   ```js
   // code/@tag-filter.live.js
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

   - **A live element enhances HTML the build wrote.** It finds its content and controls in the
     page and adds behavior. Whatever it shows is written at build time, so nothing moves when
     its script runs. Its component writes that markup when the text doesn't (`@tag-filter.js`
     writes the buttons).
   - **A live element reads its children and its attributes.** No data is sent to it besides the
     page's HTML, so nothing is sent twice.
   - **The same `html` works in the browser.** In a `.live` file it makes DOM nodes, safely, where
     at build time it writes escaped HTML.
   - **The two sides stay apart.** Build-time code that imports a `.live` file fails the build,
     naming the import. So does a `.live` file that imports a component or a layout.

7. **HTML before JavaScript.** Pages link with `<a>`, and Sitez's reset turns on cross-document
   View Transitions. `<details>`, `popover` and `<dialog>` open, close and toggle without
   JavaScript, so many interactive pieces need no `.live` file.

## Metadata

Markz reads a metadata block at the top of a document, and Sitez fills in what it leaves out.
`title` defaults to the first heading and `summary` to the first paragraph, so most pages need no
block.

```md
---
title: Shorter title
date: 2026-09-29
draft: true
---
```

- `date` puts a page in the RSS feed.
- `draft` keeps it out of `build`, not out of `dev`.
- `redirects` lists the URLs a page used to have, such as `[/old-name/, /old-name.html]`. Sitez
  writes a page at each that sends the browser on, so a file can move without breaking links from
  elsewhere. An old URL that a page or another redirect has fails the build, and so does a link
  to one.
- `title` is the page's `<title>` and `summary` its description. Sitez writes both into the
  page's `<head>`, so a page's head changes with its metadata, not its code.

Sitez checks the keys it reads. A `draft: yes` or a `date: Sept 1` fails the build, naming the
file and the key, rather than publishing a draft or misdating a post. Any other key is the site's
own and passes through to its code unchecked.

Site-wide metadata lives in `site.md` at the root, in the same Markz metadata block.

```md
---
name: Amit Kapoor
url: https://amitkaps.com
repo: https://github.com/amitkaps/site
lang: en
---

Notes for whoever maintains the site. Sitez reads only the block above.
```

`lang` is the language of every page, and it's `en` unless it says otherwise. `url` is required.
The sitemap, the feed and every page's canonical link are full addresses, so `build` fails
without it rather than writing relative ones.

`site.md` is also how Sitez finds the site. The folder holding it is the root, from wherever
`sitez` runs inside it. So the name is reserved, and `text/site.md` is an error, not a page.

From that metadata, Sitez writes `<title>`, the meta description, canonical URLs and Open Graph
tags. Twitter reads the Open Graph tags. It also writes `sitemap.xml` and `feed.xml`. The nearest
`+layout.js` adds anything else to the head with a `head` export, such as icons and font
preloads. It is given `page`, `pages` and `site`. Writing one of Sitez's own tags there fails,
naming the metadata key that sets it. A site with no layout adds nothing to the head.

## Styling

A site has one stylesheet, and every page links it. It starts with Sitez's reset, a quiet look
for plain HTML, so a page with no CSS of its own already reads well.

- One centered column about sixty characters wide, in `system-ui`.
- A type scale with balanced headings, pretty paragraphs and a softer standfirst under the title.
- Soft ink on off-white paper that follows the reader's light or dark setting.
- Tables, forms, code, quotes and figures that look finished.

The reset is `@layer reset`, so any rule a site writes overrides it, however specific. A
full-width layout starts with `body { width: auto }`.

`code/+style.css`, if there is one, is the site's own design and follows the reset. It can
`@import` other files, and there is no other styling mechanism. A `+style.css` anywhere else
fails the build, since a site has one stylesheet. Like everything in `code/`, it is processed, not
copied. A font or image it names with `url()` is bundled with a hashed name, and one that isn't
there fails the build.

```css
@font-face {
  font-family: "Inter";
  src: url("./fonts/Inter.woff2") format("woff2");
}
```

An element from text is `display: inline` until the site's CSS says otherwise, as for any custom
element. That includes an element whose component writes its markup. So `<call-out>` needs
`call-out { display: block }`, and without it the callout runs into its paragraph, visibly.

## The CLI

```bash
sitez dev      # serve with live reload
sitez build    # write dist/
sitez preview  # serve dist/ as it will be deployed
sitez check    # fix what's safe (format, lint fixes), then report the rest
sitez deploy   # publish dist/
```

`dist/` is ordinary static files and can be hosted anywhere. `build` ends with what each page
costs to send, gzipped, and to build.

```text
page          html      js   time
/           4.0 KB       —  12 ms
/teaching/  5.5 KB  2.0 KB  20 ms
/quality/    90 KB   14 KB  1.2 s  raw <script>
common      3.0 KB css, 1.5 KB js
42 pages in 1.8 s → dist · live: filter-grid, theme-toggle · sitez 0.2.0
```

A page's `js` is what only it loads. `common` is the stylesheet and what pages share, which the
browser downloads once. A page that grows heavy or slow is visible where the cost is. A note says
what the numbers can't, such as a raw `<script>` that loads whatever it loads.

**A site names its version of Sitez.** Its `package.json` holds one line that matters, and the
lockfile beside it pins the rest.

```json
{ "devDependencies": { "sitez": "0.2.0" } }
```

`npm install` puts that version in the site, and `npx sitez build` or `pnpm sitez build` runs it.
Nothing is installed globally, so your machine and the host always build with the same Sitez. A
site whose `package.json` doesn't name `sitez` fails every command, naming the line to add. The
report's last line names the version that ran. An npm library the site's code imports goes in the
same `package.json`. A site in a folder of a larger repo can use the repo's `package.json`, the nearest
one above it.

`sitez deploy` publishes to GitHub Pages when the repo's remote is on GitHub. Cloudflare needs no
Sitez command. Connect the repo in Cloudflare and set the build command to `npx sitez build`. It
installs from the lockfile first, so it builds with the site's own version.

## Not in v1

- Live elements that render from data. A JSON child comes when a site needs one.
- Rendering pages in the browser.
- Delaying live elements (until visible, until idle).
- Markz expressions. `${…}` stays code, as Markz writes it.
- Dynamic routes, pagination and tags.
- Image processing, i18n and content schemas.
- Themes, plugins, and settings in `site.md` beyond metadata.

Each one is a way to add configuration, which is the thing Sitez removes. A site that needs a
client router, `load`, endpoints or server output should use SvelteKit.

## Parked ideas

Ideas with a shape already, kept here until a site needs them. None is a promise.

- **Pages from data.** `text/talks/{slug}.md`, with `data: talks.json` in its metadata, would make
  one page per row at `/talks/<slug>/`. Each row's fields would be its page's metadata, checked as
  any page's are. A slug would have to be present, unique, and only `a–z`, `0–9` and hyphens. Sitez
  wouldn't make slugs from titles. A template would have one placeholder. Without Markz expressions,
  its body could only hold components that read `page`.
- **CSV in `data/`,** read as rows, as JSON is.
- **`sitez create .`** would write a starter site: `site.md`, a `package.json` naming the running
  version, and a first page in `text/`.
- **A dashboard at `/__sitez/`,** so nobody needs the terminal to understand their site. `sitez dev`
  would open it. It would list every page with its cost and build time, the `+`, `@` and `.live`
  files that shaped it, the data it read, its links in and out, and its errors. Recently edited
  pages would sit at the top.

## Tests of the idea

Three sites, run against the rules.

**A personal blog** (home, about, posts, RSS). It fits. It has `text/blog/*.md` with `date`, and
a `text/blog/index.md` holding `{@post-list /}`. `code/blog/@post-list.js` lists `pages` filtered
to `/blog/`. One `+layout.js` wraps it, and `site.md` has a name and URL. There's no route file,
and no metadata on pages that start with a heading.

**A landing page.** It fits, with a `text/index.md` whose sections are components, `public/` and
`site.md`.

**amitkaps.github.io** (amitkaps.com, today SvelteKit on Cloudflare). It fits. It is flat and
content-heavy, with card grids, a 404 page and old `.html` URLs. Its pages become `text/`, its
YAML becomes JSON in `data/`, and the grids become components given `data`. The workshops, talks
and teaching grids filter by category. So each is a `filter-grid`, whose component writes the
buttons and whose `.live` file wires them. The teaching page was built this way first. It loads
2 KB of JavaScript, where the SvelteKit page loads 206 KB.

How Sitez is built is in [design.md](design.md).
