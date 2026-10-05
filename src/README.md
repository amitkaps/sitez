# src

Sitez itself: a Vite plugin, and the stages a site goes through on its way to `dist/`. Each
stage gets a file here, or a folder once it needs more than one, as its step in
[plan.md](../docs/plan.md) starts.

- `plugin.ts` is `sitez()`, the plugin a site adds to its `vite.config.js`, which has no options.
- `discover.ts` decides which files are pages, at which URLs, which names in `code/` Sitez reads,
  and which file of a name, such as a layout, is nearest to each.
- `metadata.ts` is what a page knows about itself, the site and every page.
- `text.ts` turns a Markz page into HTML, its elements written around the site's components.
- `data.ts` reads the JSON in `data/` that an element's `data` attribute names.
- `warnings.ts` is how Markz's warnings reach the author, with the file, the line, and what to
  write instead.
- `links.ts` is where a link in text goes, and whether it's there.
- `live.ts` finds the live elements a page uses, from its HTML, and the `.live` file of each.
- `vite.ts` is what the plugin's parts share: the site's modules in Vite's module runner, and the
  import rule between build code and browser code.
- `render.ts` renders a layout or component module, a layout's `head`, and the document around
  them.
- `site.ts` is what `build` and `dev` share: reading the site, and rendering one page.
- `head.ts` is what a page's `<head>` says about it, from its metadata.
- `sitemap.ts` writes `sitemap.xml` and `feed.xml`.
- `bundle.ts` builds what the browser downloads besides the HTML: the site's one stylesheet, and
  the live elements' JavaScript.
- `build.ts` is the plugin's build half: it renders every page, writes `dist/`, and makes
  `vite preview` serve it as a static host would.
- `report.ts` is what `build` prints: what each page costs to send and to build.
- `dev.ts` is the plugin's dev server half, rendering each page as it's asked for.
- `runtime/` is what a site's own code loads: the `sitez` import and its renderer, and the reset.
- `errors.ts` is how a mistake in a site becomes a message naming the file and what to change.
