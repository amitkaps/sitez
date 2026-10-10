# Plan

Where Sitez is and what comes next, in order. Finished work gets a line or two, newest first.
The detail lives in [idea.md](idea.md), [sitez.md](sitez.md), [elementz.md](elementz.md), the
code's `@prose`, the tests and `git log`.

## Where it is

Sitez is a Vite plugin that builds amitkaps.github.io, whose `next` branch deploys
next.amitkaps.com from it. The latest release is 0.3.0, on npm as `@amitkaps/sitez` and as a
GitHub release tarball. Since then an element is one file, which amitkaps.github.io hasn't moved
to yet.

### Since 0.3.0

- **Markz 0.4.0, and the standard's toolchain.** Text keeps the quotes and dashes as typed, so
  `There's` stays straight. Markz skips a value YAML reads differently, like `draft: yes`, with a
  warning, and Sitez still fails the build on one in a key it reads. Vite+ 1.1.0, TypeScript 7,
  and the `fix` and `verify` scripts, as [ship](https://ship.amitkaps.com) has them.
- **Markz 0.3.0 and prose 0.4.0.** Prose reads an `.html` file part by part, so an element's
  `@prose` in its `<script>` and `<style>` is found. Markz closes a quote after a single quote.
- **One file per element.** An element is `@name.html`, and its code is `src/elementz/`, which
  imports nothing from the rest of Sitez. Each part is a module on the file's own lines. Element
  CSS ships once, in `@layer elements`. `setup(el, { signal })` replaces the class, and rendering
  is synchronous. The slot's fallback shows only when there is no content, and Sitez 0.3's names
  fail, saying where their code goes.
- **What Data Portraits showed.** Its nine charts became elements drawn with d3 at build time,
  and the port found three gaps, listed under Next.
- **One file per element, designed.** An element is `@name.html`, with a template the build
  writes, its CSS and its `setup` ([elementz.md](elementz.md)). Sitez is the top of four layers,
  markz, elementz, pagez and sitez ([sitez.md](sitez.md#where-sitez-sits)).
- **The docs split by layer.** design.md became sitez.md and elementz.md, idea.md's rules describe
  one file, and [pagez.md](pagez.md) keeps Pagez's idea in step.

### 0.3.0

- **Pages from `code/index.html`.** The frame is a complete HTML page with one `<slot>`, and Sitez
  writes only the head tags that follow from metadata ([sitez.md](sitez.md#the-frame)).
- **Explicit metadata.** A page gives its own `title` and `description`, and nothing is filled in
  from its text. The sitemap, the feed and the reset went.
- **Names for when code runs.** `.html`, `.html.js` and `.browser.js`, with elements global and
  `_` names skipped in every folder.
- **A Vite plugin.** The CLI, `check`, `preview` and `deploy` went. A site's `node_modules` went
  from 137 MB to 31 MB, and a page's script to 0.3 KB, one class per element with behavior.

### 0.2.0

- **Svelte goes.** A spike of amitkaps.github.io's `/teaching/` loaded 2 KB of JavaScript against
  206 KB ([spike/](https://github.com/amitkaps/sitez/tree/465e738/spike)). Sitez was rewritten
  around it: `text/`, `code/` and `data/`, `html` with its own renderer, elements named in
  `code/`, and live elements in one script.
- **Redirects.** A page lists its old URLs, and the build writes a page at each.
- **The real site.** amitkaps.github.io was ported, and a release on npm is staged for approval.

### 0.1.0

- **Sitez on Svelte** ([`v0.1.0`](https://github.com/amitkaps/sitez/tree/v0.1.0)). Islands
  hydrated from the server render. Its discovery, links, head, report and error fixtures carried
  over.

## Next, in order

- [ ] **amitkaps.github.io on one file per element.** It moves its ten element files, their CSS
      and its classes to `setup`, and adds `elements` to its layer order. Its pages match before
      and after in a headless browser. Then Sitez releases 0.4.0.
- [ ] **What Data Portraits showed.**
  - An element that throws names the page and the tag that called it, not only its file.
  - `url()` in a `style` attribute an element writes is checked, as a stylesheet's is.
  - The report says what each element adds to the script, such as `notes-treemap 2.1 KB`.
- [ ] **Docs for users.** A guide: install, the folders, a page, an element, deploying, and every
      error with its fix. It's written once the element settles, and rendered by prose or by
      Sitez.

## Later

- [ ] **Pagez** ([pagez.md](pagez.md)), once a page needs it, such as amitkaps.com/stories.
- [ ] **Writing.** Writing is the real block, more than building. An editor view, or a separate
      package (`editz`), would make a page easy to write.
- [ ] **A feed for short ideas.** A feed fits short, dated notes better than essays. It waits on
      the editor.
- [ ] **Markz fix** found by the port: `\` as a line break. It goes to markz.

## Open questions

- **Rendered bodies in `pages`.** Each entry could carry its page's HTML as well as its metadata,
  for a feed with full posts or an index with excerpts. It waits until a site needs more.
- The rest are in [sitez.md](sitez.md#open-questions) and
  [elementz.md](elementz.md#open-questions).
