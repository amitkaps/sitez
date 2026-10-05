# Sitez

**Sitez is a static site generator, a Vite plugin with no options. Markz goes in `text/`, HTML,
CSS and JavaScript in `code/`, JSON in `data/` and files in `public/`. Run `vite build`, get
complete HTML.**

## Promises

1. **Four folders and three files.** `text/` is what you write, and `code/` is what frames,
   renders and styles it. `data/` is the JSON the code reads, and `public/` is files copied as
   they are. `site.md` holds the site's URL and metadata, `package.json` names the Sitez that
   builds it, and `vite.config.js` adds it to Vite. Sitez takes no options.
2. **A text file is a page.** Its path is its URL. There is no route file.
3. **Every page is complete HTML.** The build does the work so the browser doesn't.
4. **What a page shows is written where you can see it.** The frame is `code/index.html`, and a
   page's heading is in its text. Sitez adds only what is the same on every site, such as the
   canonical URL, and never fills in a value the site didn't write.
5. **Links are checked.** Text links to files, and Sitez turns them into URLs. A broken link
   anywhere on a page fails the build.
6. **JavaScript only where a page is interactive, and you see what every page costs.**

Sitez holds a line at static pages, written as text, with elements that render at build time and
behave in the browser. Anything that needs more is a different tool.

## Folders

```text
site/
├── site.md                     the site's URL and metadata
├── package.json                the version of Sitez, and the commands
├── vite.config.js              adds Sitez to Vite
├── text/
│   ├── index.md                → /
│   ├── about.md                → /about/
│   └── blog/
│       ├── index.md            → /blog/
│       ├── hello.md            → /blog/hello/
│       └── again.md            → /blog/again/
├── code/
│   ├── index.html              every page starts here
│   ├── style.css               linked from index.html
│   ├── @call-out.html          writes {@call-out} in text
│   ├── @tag-filter.html.js     writes <tag-filter> and its buttons
│   ├── @tag-filter.browser.js  wires the buttons in the browser
│   ├── format.js               a module the code imports
│   └── blog/
│       └── @post-list.html.js  writes {@post-list}, kept with the blog's code
├── data/
│   └── talks.json              read by the code
└── public/
    └── favicon.svg             → /favicon.svg
```

**A folder is named for the kind of file written in it**, so a file's extension says where it
goes.

| Folder    | Holds                                                                   | Because                                    |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `text/`   | `.md`                                                                   | words, read as they are and on GitHub      |
| `code/`   | `index.html`, elements, `.js` or `.ts`, `.css`, and the files CSS names | what frames, runs or styles, built by Vite |
| `data/`   | `.json`                                                                 | values the code reads                      |
| `public/` | anything                                                                | copied as it is, `.html` included          |

Any other file in `text/` fails the build, naming it and pointing to `public/`, or to `data/` for
JSON. A file or folder whose name starts with `_` is skipped in every folder. It is never built,
copied or linked to.

**Inside `code/`, a file's name gives its role.** Subfolders only organize, so an element's name
means the same wherever its files sit.

| Name               | Is                                                   |
| ------------------ | ---------------------------------------------------- |
| `index.html`       | the HTML every page starts from (rule 2)             |
| `@name.html`       | an element's markup, written as it is (rule 5)       |
| `@name.html.js`    | an element's markup, computed at build time (rule 5) |
| `@name.browser.js` | an element's behavior, run in the browser (rule 6)   |
| anything else      | a module the code imports, or CSS `index.html` links |

`@` is the same mark as Markz's `{@name}`, so an element's files are found by its name. Its suffix
says when it runs. `.html` and `.html.js` run once, when the site is built, and `.browser.js` runs
in every visitor's browser. `.ts` works wherever `.js` does, and a `.js` and a `.ts` of the same
name fail the build. So do an `@name.js` with no suffix, an `@name.html` beside an `@name.html.js`,
two files for one element in different folders, and an `@` file without a hyphen, which no element
could use.

## The rules

1. **A text file is a page.** Every `.md` in `text/` is one URL, from its path. `index.md` is the
   folder's own URL, so `about.md` and `about/index.md` are two files for one URL, which is an
   error. `text/404.md` is the page a host serves for a URL that doesn't exist. It is written as
   `404.html`, and nothing links to it. Nothing in `code/` or `data/` is copied to the output as
   it is.

2. **Every page starts from `code/index.html`.** It is a complete HTML page with no template
   syntax. Opened in a browser, it shows the site with an empty spot where a page goes. The page
   goes in its one `<slot></slot>`.

   ```html
   <!doctype html>
   <html lang="en">
     <head>
       <meta charset="utf-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1" />
       <title>Amit Kapoor</title>
       <meta name="description" content="Essays, workshops and talks on data and story." />
       <link rel="stylesheet" href="./style.css" />
       <link rel="icon" href="/favicon.svg" />
     </head>
     <body>
       <header><a href="/">Amit Kapoor</a></header>
       <main><slot></slot></main>
       <footer>Handcrafted by Amit Kapoor</footer>
     </body>
   </html>
   ```

   `index.html` and Sitez share the head, and each tag has one owner.

   | In the head                            | `index.html`                     | Sitez                                                    |
   | -------------------------------------- | -------------------------------- | -------------------------------------------------------- |
   | `<html lang>`, `charset`, `viewport`   | writes them                      |                                                          |
   | `<title>`, `<meta name="description">` | writes them, with the site's own | puts the page's `title` and `description` in their place |
   | stylesheets                            | links them                       | bundles them, with hashed names                          |
   | canonical, `og:*`, `twitter:*`         |                                  | writes them from the page's metadata and URL             |
   | the script                             |                                  | adds it to pages with an element that has behavior       |
   | everything else                        | writes it                        |                                                          |

   An `index.html` missing a tag from its column fails the build, and so does one with no
   `<slot>` or two. So does one that writes a canonical, `og:` or `twitter:` tag, which Sitez
   writes for every page. Sitez checks nothing else in it.

   One `index.html` frames every page. A section that looks different gets there through an
   element that reads `page`, such as a nav that marks where the reader is.

3. **A Markz element is an HTML element first.** `{@call-out type="note"}` is written as
   `<call-out type="note">`. That's a valid HTML element that CSS can style, and it may be all it
   needs. An element can have files for its markup, its behavior, both or neither.

   | Files in `code/`                        | The element                                                   |
   | --------------------------------------- | ------------------------------------------------------------- |
   | none                                    | is plain HTML, styled by CSS                                  |
   | `@call-out.html` or `@call-out.html.js` | has its markup written at build time                          |
   | `@call-out.browser.js`                  | has behavior, on the markup the text writes                   |
   | a markup file and a `.browser.js`       | has its markup written by the build, and wired in the browser |

   Markz requires the hyphen, so every element name maps to these file names. A tag without one,
   like `{@section}`, is plain HTML.

4. **Links follow files.** `[hello](blog/hello.md)` becomes `/blog/hello/`, so text reads the
   same on GitHub and on the site.
   - A link to a URL on the site (`[About](/about)`) is checked the same way. A path on the same
     domain that this site doesn't build is written in full, as any other site's would be.
   - A link to another file in the repo, such as source code, goes to that file on GitHub, from
     `repo` in `site.md`. An image has to be in `public/`.
   - Sitez knows every URL, so a link to a page or file that doesn't exist fails the build. A
     draft doesn't exist in `build`, so linking to one fails too, rather than shipping a broken
     link.
   - Code writes URLs, not files, and every link in a built page is checked the same way.
     `index.html`'s `<a href="/blog">` fails, asking for `/blog/`, the URL as the site serves it.

5. **Elements render at build time.** An element's markup file writes the inside of its tag, and
   Sitez writes the element around it, with its attributes. So CSS and the element's
   `.browser.js` always find it, and nothing moves when the page loads.

   `@call-out.html` is markup as it is. The element's content goes where its `<slot>` is, as a
   page does in `index.html`.

   ```html
   <!-- code/@call-out.html -->
   <aside><strong>Note</strong><slot></slot></aside>
   ```

   `@post-list.html.js` is a function that returns the markup, for markup that depends on
   something. It is written with `html` from `sitez`, which escapes every value it interpolates.
   It gets the element's attributes, and its content as `children`. It also gets three things
   every page has. `page` is this page's URL and metadata, `pages` is the same for every page, and
   `site` is the metadata in `site.md`.

   ```js
   // code/blog/@post-list.html.js renders {@post-list} in text/blog/index.md
   import { html } from "@amitkaps/sitez";

   export default ({ pages }) => html`
     <ul>
       ${pages
         .filter((p) => p.url.startsWith("/blog/") && p.date)
         .sort((a, b) => (a.date < b.date ? 1 : -1))
         .map((p) => html`<li><a href=${p.url}>${p.title}</a></li>`)}
     </ul>
   `;
   ```

   - **An element is the same everywhere.** One written in text, in `index.html` or in another
     element's markup renders the same way. Elements inside elements render first, and an element
     that ends up inside itself fails the build.
   - **Content needs a place.** An `.html` element given content with no `<slot>` fails, and so
     does one with two.
   - **Data comes in as an attribute.** `{@card-grid data="talks.json"}` reads
     `data/talks.json` and passes the parsed JSON as `data`. A path that isn't there fails the
     build, as a broken link does. The attribute isn't written to the page. Code can also import
     from `data/` itself.
   - **The build waits.** A function can be `async`, and a template can hold promises.
   - **A function in a template fails the build,** naming the file. At build time it could only
     be an event handler, and those belong to `.browser.js` files.
   - **An attribute named `page`, `pages`, `site` or `children` fails,** since every element
     already gets those.
   - **An element inside a paragraph returns inline HTML.** A `<div>` or `<ul>` from
     `[term]{@key-word}` would end the paragraph early, so it fails the build, naming the element
     and the tag.

6. **Browser behavior lives in `.browser.js` files.** `code/@tag-filter.browser.js` is the
   behavior of `<tag-filter>`, a custom element, and runs only in the browser. Its default export
   is the element's class. The file's name says which tag it is, so Sitez defines the class under
   that tag and the file never names it. It ships only to pages whose HTML has a `<tag-filter>`. A
   page with no such element loads no JavaScript.

   ```js
   // code/@tag-filter.browser.js
   export default class extends HTMLElement {
     connectedCallback() {
       for (const b of this.querySelectorAll("button")) b.onclick = () => this.show(b.value);
     }
     show(tag) {
       for (const post of this.querySelectorAll("[data-tag]"))
         post.hidden = !!tag && post.dataset.tag !== tag;
     }
   }
   ```

   A class is the web platform's own way to write an element, so the file says what it is with
   nothing from Sitez. `connectedCallback` runs again when the element moves in the page, so
   setup that mustn't run twice checks first.

   - **Behavior enhances HTML the build wrote.** A `.browser.js` file finds its content and
     controls in the page and adds behavior. Whatever it shows is written at build time, so
     nothing moves when its script runs. Its markup file writes that markup when the text doesn't
     (`@tag-filter.html.js` writes the buttons).
   - **It reads its children and its attributes.** No data is sent to it besides the page's HTML,
     so nothing is sent twice.
   - **It works on the DOM.** It imports nothing from Sitez, whose `html` renders at build time.
   - **Its default export is its element's class, and nothing else.** The class is written in the
     export, or made by a call to a library that makes one. A file with no default export, a
     default that is a value, a bare function or a name, or any other export fails the build.
     Code two files share goes in a module.
   - **The two sides stay apart.** Build-time code that imports a `.browser.js` file fails the
     build, naming the import. So does a `.browser.js` file that imports an `.html.js` file or
     `sitez`.
   - **Behavior is small.** Every `.browser.js` a site's pages use goes in one script, which a
     page with such an element loads.
   - **Libraries come from npm.** A `.browser.js` file imports the site's own `code/` and the
     ES-module packages in its `package.json`, and the script bundles them. A large library, such
     as D3, loads with `await import("d3")` inside the element, so only a page where the element
     is fetches it. A library imported by URL at the top fails the build, since every page with
     an element that has behavior would fetch it.

7. **HTML before JavaScript.** Pages link with `<a>`, and one CSS rule
   (`@view-transition { navigation: auto }`) animates between them. `<details>`, `popover` and
   `<dialog>` open, close and toggle without JavaScript, so many interactive pieces need no
   `.browser.js` file.

## Metadata

Markz reads a metadata block at the top of a document. Sitez reads four keys from a page's block,
and fills in none of them from its text.

```md
---
title: Hello again
description: A second post, about writing less.
draft: true
date: 2026-09-29
---

# Hello again
```

- `title` is the page's `<title>`, in full. A page that wants the site's name in it writes it.
- `description` is its meta description.
- `draft` keeps it out of `build`, not out of `dev`.
- `redirects` lists the URLs a page used to have, such as `[/old-name/, /old-name.html]`. Sitez
  writes a page at each that sends the browser on, so a file can move without breaking links from
  elsewhere. An old URL that a page or another redirect has fails the build, and so does a link
  to one.

The block is metadata, not content, so nothing in it shows on the page by itself. The heading a
reader sees is the page's `# Hello again`. A page without `title` or `description` keeps
`index.html`'s.

Sitez checks the keys it reads. A `draft: yes` fails the build, naming the file and the key,
rather than publishing a draft. Any other key is the site's own and passes through to its code
unchecked, as `date` above does to `@post-list`.

Site-wide metadata lives in `site.md` at the root, in the same Markz metadata block.

```md
---
url: https://amitkaps.com
repo: https://github.com/amitkaps/site
author: Amit Kapoor
---

Notes for whoever maintains the site. Sitez reads only the block above.
```

`url` is required, since every page's canonical link and Open Graph URL are full addresses.
`repo` is where links to the repo's files go (rule 4). Any other key is the site's own, as
`site.author`.

`site.md` sits at the site's root, beside `vite.config.js`. So the name is reserved, and
`text/site.md` is an error, not a page.

## Styling

`index.html` links the site's CSS from `code/`, and Sitez adds nothing to it. A page with no CSS
gets the browser's own look.

Like everything in `code/`, CSS is processed, not copied. A linked stylesheet and the files it
`@import`s become one file with a hashed name. A font or image it names with `url()` is bundled
beside it, and one that isn't there fails the build.

```css
@font-face {
  font-family: "Inter";
  src: url("./fonts/Inter.woff2") format("woff2");
}
```

An element from text is `display: inline` until the site's CSS says otherwise, as for any custom
element. That includes an element whose markup file writes its markup. So `<call-out>` needs
`call-out { display: block }`, and without it the callout runs into its paragraph, visibly.

## Commands

Sitez is a Vite plugin, so a site runs Vite. `vite.config.js` adds Sitez, and `package.json`
holds the commands.

```js
// vite.config.js
import sitez from "@amitkaps/sitez/vite";

export default { plugins: [sitez()] };
```

```json
{
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "devDependencies": { "@amitkaps/sitez": "0.3.0", "vite": "^8.0.0" }
}
```

```bash
npm run dev      # serve with live reload
npm run build    # write dist/
npm run preview  # serve dist/ as it will be deployed
```

`dist/` is ordinary static files and can be hosted anywhere. `build` ends with what each page
costs to send, gzipped, and to build.

```text
page          html   time
/           4.0 KB  12 ms
/teaching/  5.5 KB  20 ms  filter-grid
/quality/    90 KB  1.2 s  raw <script>
common      3.0 KB css, 1.2 KB js, loads cdn.jsdelivr.net
42 pages in 1.8 s → dist · behavior: filter-grid, theme-toggle · sitez 0.3.0
```

`common` is the site's CSS and its one script, which the browser downloads once. A page with an
element that has behavior loads the script, and any other page loads no JavaScript. A page that
grows heavy or slow is visible where the cost is. A note says what the numbers can't, such as a
raw `<script>` that loads whatever it loads.

**A site names its version of Sitez.** `package.json` names Sitez and Vite, and the lockfile
beside it pins the rest. `npm install` puts those versions in the site, so your machine and the
host always build with the same Sitez. The report's last line names the version that ran. An npm
library the site's code imports goes in the same `package.json`, at build time or in a
`.browser.js` file.

**Formatting and linting are the site's own.** A site that wants them adds oxfmt and oxlint to
its `package.json` and a script for each. oxfmt formats `text/` in Markz's canonical form, and
formats the HTML inside `html` templates. Markz's warnings print with `build`, and never fail it.

**A config file is a door.** A site can add other Vite plugins to `vite.config.js`. Sitez
promises nothing about how they behave with it, and a site with none builds as this page says.

**A site deploys from its host, not from Sitez.** Sitez's host is Cloudflare. Create a Worker from
the repo in Cloudflare, with `npm run build` as its build command and `npx wrangler deploy` as
its deploy command. Every push to the production branch deploys. Cloudflare installs from the
lockfile first, so it builds with the site's own version. A `wrangler.jsonc` in the repo points
the Worker at `dist/` and serves `404.html` for a missing address, and the domain is set in
Cloudflare.

## Not in v1

- Behavior that renders from data. A JSON child comes when a site needs one.
- Rendering pages in the browser.
- Delaying behavior (until visible, until idle).
- Markz expressions. `${…}` stays code, as Markz writes it.
- Template syntax in `index.html`, and a second frame for a section.
- A sitemap, a feed, and a social image (`og:image`).
- Dynamic routes, pagination and tags.
- Image processing, i18n and content schemas.
- Options for Sitez, themes, and settings in `site.md`.
- A deploy command, and steps for hosts other than Cloudflare. Each host has its own one-time
  setup, which a command can't cover.

Each one would be an option, and Sitez takes none. A site that needs a client router, `load`,
endpoints or server output should use SvelteKit.

## Parked ideas

Ideas with a shape already, kept here until a site needs them. None is a promise.

- **Pages from data.** `text/talks/{slug}.md`, with `data: talks.json` in its metadata, would make
  one page per row at `/talks/<slug>/`. Each row's fields would be its page's metadata, checked as
  any page's are. A slug would have to be present, unique, and only `a–z`, `0–9` and hyphens.
  Sitez wouldn't make slugs from titles. A template would have one placeholder. Without Markz
  expressions, its body could only hold elements that read `page`.
- **CSV in `data/`,** read as rows, as JSON is.
- **`npm create @amitkaps/sitez`** would write a starter site: `site.md`, `package.json`,
  `vite.config.js`, `code/index.html`, and a first page in `text/`.
- **A dashboard at `/__sitez/`,** so nobody needs the terminal to understand their site. `dev`
  would open it. It would list every page with its cost and build time, the elements that shaped
  it, the data it read, its links in and out, and its errors. Recently edited pages would sit at
  the top.

## Tests of the idea

Three sites, run against the rules.

**A personal blog** (home, about, posts). It fits. It has `text/blog/*.md` with `date`, and a
`text/blog/index.md` holding `{@post-list /}`. `code/blog/@post-list.html.js` lists `pages`
filtered to `/blog/` and sorted by `date`. One `index.html` frames it, and `site.md` has its URL.
There's no route file, and each post writes its own heading.

**A landing page.** It fits, with a `text/index.md` whose sections are elements, `public/` and
`site.md`.

**amitkaps.github.io** (amitkaps.com, today SvelteKit on Cloudflare). It fits. It is flat and
content-heavy, with card grids, a 404 page and old `.html` URLs. Its pages become `text/`, its
YAML becomes JSON in `data/`, and the grids become elements given `data`. The workshops, talks
and teaching grids filter by category. So each is a `filter-grid`, whose `.html.js` writes the
buttons and whose `.browser.js` wires them. The teaching page was built this way first. It loads
2 KB of JavaScript, where the SvelteKit page loads 206 KB.

How Sitez is built is in [design.md](design.md).
