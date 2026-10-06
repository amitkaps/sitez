# Plan

The order of the work, with what's done in one line each and what's next in order. The spec is
[idea.md](idea.md), and "rule N" means its rule N. How it's built is [sitez.md](sitez.md) and
[elementz.md](elementz.md).

Each step ends in something a fixture site shows, so it's done when its fixture builds and its
tests pass. Error cases are fixtures too. Work that belongs to one file is a pending `@prose`
chunk there, not a line here.

## Done

- **0.1** ([`v0.1.0`](https://github.com/amitkaps/sitez/tree/v0.1.0)). Sitez on Svelte, with
  islands hydrated from the server render. Steps 0 to 10.
- **The spike.** amitkaps.github.io's `/teaching/` without Svelte loaded 2 KB of JavaScript
  against 206 KB ([spike/](https://github.com/amitkaps/sitez/tree/465e738/spike)).
- **11–17.** `text/`, `code/` and `data/`, `html` and its renderer, elements named in `code/`,
  live elements, Svelte gone, and redirects.
- **18–19, 0.2.0.** amitkaps.github.io ported, and `@amitkaps/sitez` released through staged
  npm publishing. next.amitkaps.com builds with it on Cloudflare.
- **20–21, a leaner core.** Sitez became a Vite plugin with no CLI. A site's `node_modules` went
  from 137 MB to 31 MB, and a page's script to 0.3 KB.
- **22, 0.3.0.** `code/index.html` frames every page, metadata is explicit, sitemap and feed went,
  and `_` names are skipped everywhere. amitkaps.github.io's `next` runs 0.3.0.
- **The docs for step 25.** idea.md, sitez.md and elementz.md describe one file per element.

## Next

### 25. One file per element

An element is one file, `@name.html` ([elementz.md](elementz.md)). The code goes in
`src/elementz/`, which imports nothing from the rest of Sitez. amitkaps.github.io's `code/notes`
is the test.

- [ ] Fix the slot's fallback first, in today's `elements.ts`. `<slot>No note</slot>` ships the
      fallback and a stray `</slot>` after the content.
- [ ] `src/elementz/`: `html`, an element file read into its parts, the template evaluated with
      `attrs`, the host's context and its script's exports, the slot, and nesting. `elements.ts`,
      `markup.ts` and `runtime/` move into it.
- [ ] The runtime: a fresh `AbortController` per connection, and the cleanup on disconnect, in
      the site's one script.
- [ ] The plugin cuts each script into a module, with errors on the file's own lines.
- [ ] Element CSS in `@layer elements`, with the selector check.
- [ ] The failures in [elementz.md](elementz.md#what-the-build-checks), and the old names failing.
- [ ] Every fixture moves to one file, with an error fixture for each new failure.
- [ ] `@amitkaps/prose` reads an `.html` file part by part, as it reads `.svelte`.
- [ ] amitkaps.github.io moves its ten element files, their CSS and its classes to `setup`, and
      adds `elements` to its layer order. Its pages match before and after in a headless browser.

### 24. What Data Portraits showed

- [ ] An element that throws names the page and the tag that called it, not only its file.
- [ ] `url()` in a `style` attribute an element writes is checked, as a stylesheet's is.
- [ ] The report says what each element adds to the script, such as `notes-treemap 2.1 KB`.

### 23. Docs for users

- [ ] A guide for users: install, the folders, a page, an element, deploying, and every error with
      its fix. It's written once step 25 settles the element, and rendered by prose or by Sitez.

## Parked

- **Writing.** Writing is the real block, more than building. An editor view, or a separate
  package (`editz`), would make a page easy to write.
- **A feed for short ideas.** A feed fits short, dated notes better than essays. It waits on the
  editor.
- **Pagez** ([pagez.md](pagez.md)), once a page needs it, such as amitkaps.com/stories.
- **Markz fixes** found by the port: a quote closing after a single quote, and `\` as a line
  break. They go to markz.

## Open questions

- **Rendered bodies in `pages`.** Each entry could carry its page's HTML as well as its metadata,
  for a feed with full posts or an index with excerpts. It waits until a site needs more.
- The rest are in [sitez.md](sitez.md#open-questions) and
  [elementz.md](elementz.md#open-questions).
