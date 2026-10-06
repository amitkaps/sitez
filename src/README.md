# src

Sitez itself: a Vite plugin, and the stages a site goes through on its way to `dist/`. Each
stage gets a file here, or a folder once it needs more than one, as its step in
[plan.md](../docs/plan.md) starts.

- `plugin.ts` is `sitez()`, the plugin a site adds to its `vite.config.js`, which has no options.
- `discover.ts` decides which files are pages, at which URLs, which files in `code/` are elements,
  and which names are mistakes.
- `metadata.ts` is what a page knows about itself, the site and every page.
- `head.ts` is `code/index.html`: its checks, and the head Sitez writes for each page.
- `text.ts` turns a Markz page into HTML, its elements written around what their templates write.
- `data.ts` reads the JSON in `data/` that an element's `data` attribute names.
- `warnings.ts` is how Markz's warnings reach the author, with the file, the line, and what to
  write instead.
- `links.ts` is where a link in text goes, and whether it's there.
- `browser.ts` finds the elements a page uses that ship CSS or behavior, from its HTML.
- `vite.ts` is what the plugin's parts share: the site's modules in Vite's module runner, each
  part of an element file as a module, and the import rule between build code and browser code.
- `render.ts` is what Sitez adds to a template's scope, and puts a page in its frame.
- `site.ts` is what `build` and `dev` share: reading the site, and rendering one page or redirect.
- `redirects.ts` reads the old URLs a page lists, and checks that each is free.
- `bundle.ts` builds what the browser downloads besides the HTML: the stylesheets `index.html`
  links, the elements' CSS, and the script of the elements with behavior.
- `build.ts` is the plugin's build half: it renders every page, writes `dist/`, and makes
  `vite preview` serve it as a static host would.
- `report.ts` is what `build` prints: what each page costs to send and to build.
- `dev.ts` is the plugin's dev server half, rendering each page as it's asked for.
- `elementz/` is the element layer: the element file, rendering elements, `html` and the
  browser's runtime. It imports nothing from the rest of Sitez.
- `errors.ts` is how a mistake in a site becomes a message naming the file and what to change.
