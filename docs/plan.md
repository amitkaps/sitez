# Plan

Sitez is a Vite plugin that builds amitkaps.github.io, whose `next` branch deploys next.amitkaps.com from it. 0.4.0 is on npm as `@amitkaps/sitez`, and what each release changed is in its [notes on GitHub](https://github.com/amitkaps/sitez/releases). This plan says what's next, in order, and what works now. The detail lives in [design.md](design.md), [sitez.md](sitez.md), [elementz.md](elementz.md), the code's `@prose` and the tests.

## Next, in order

- [ ] **amitkaps.github.io on one file per element.** It moves its ten element files, their CSS and its classes to `setup`, and adds `elements` to its layer order. Its pages match before and after in a headless browser. Then Sitez releases 0.4.0.
- [ ] **What Data Portraits showed.**
  - An element that throws names the page and the tag that called it, not only its file.
  - `url()` in a `style` attribute an element writes is checked, as a stylesheet's is.
  - The report says what each element adds to the script, such as `notes-treemap 2.1 KB`.
- [ ] **Docs for users.** A guide: install, the folders, a page, an element, deploying, and every error with its fix. It's written once the element settles, and rendered by prose or by Sitez.

## Where it is

- **A Vite+ plugin.** A site runs `vp dev`, `vp build` and `vp preview`, with `vite-plus` as Sitez's peer, so it needs no override ([sitez.md](sitez.md#toolchain)).
- **Pages from `code/index.html`.** The frame is a complete HTML page with one `<slot>`, and Sitez writes only the head tags that follow from a page's own `title` and `description` ([sitez.md](sitez.md#the-frame)).
- **One file per element.** An element is `@name.html`, with its template, its CSS in `@layer elements` and its `setup(el, { signal })`. Its code is `src/elementz/`, which imports nothing from the rest of Sitez ([elementz.md](elementz.md)).
- **Names for when code runs.** `.html`, `.html.js` and `.browser.js`, with elements global and `_` names skipped in every folder.
- **Little JavaScript.** Svelte went after a spike of `/teaching/` loaded 2 KB of JavaScript against 206 KB ([spike/](https://github.com/amitkaps/sitez/tree/465e738/spike)). A page loads script only for the elements with behavior.
- **Redirects.** A page lists its old URLs, and the build writes a page at each.
- **Markz and prose.** Text keeps quotes and dashes as typed, and the build fails on a metadata value YAML reads differently, in a key Sitez reads. Prose finds an element's `@prose` in its `<script>` and `<style>`.
- **The docs by layer.** design.md holds the rules for one file, and Sitez is the top of four layers, markz, elementz, pagez and sitez ([sitez.md](sitez.md#where-sitez-sits)).
- **craftz.** Sitez follows craftz's rules, on Vite+ and TypeScript 7.

## Later

- **Pagez** ([its design](https://github.com/amitkaps/pagez/blob/main/docs/design.md)), in its own repository now, with [its own plan](https://github.com/amitkaps/pagez/blob/main/docs/plan.md). Sitez renders its pages through Pagez once it's built.
- **Writing.** Writing is the real block, more than building. An editor view, or a separate package (`editz`), would make a page easy to write.
- **A feed for short ideas.** A feed fits short, dated notes better than essays. It waits on the editor.
- **Markz fix** found by the port: `\` as a line break. It goes to markz.

## Open questions

- **Rendered bodies in `pages`.** Each entry could carry its page's HTML as well as its metadata, for a feed with full posts or an index with excerpts. It waits until a site needs more.
- The rest are in [sitez.md](sitez.md#open-questions) and [elementz.md](elementz.md#open-questions).
