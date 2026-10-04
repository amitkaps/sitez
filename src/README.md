# src

Sitez itself: the `sitez` command and the stages a site goes through on its way to `dist/`. Each
stage gets a file here, or a folder once it needs more than one, as its step in
[plan.md](../docs/plan.md) starts.

- `cli.ts` is the command: it finds the site and runs one of `dev`, `build`, `preview`, `check`
  and `deploy`.
- `root.ts` finds the site from wherever `sitez` runs.
- `discover.ts` decides which files are pages, at which URLs, which names in `code/` Sitez reads,
  and which file of a name, such as a layout, is nearest to each.
- `metadata.ts` is what a page knows about itself, the site and every page.
- `text.ts` turns a Markz page into HTML, its elements written around the site's components.
- `data.ts` reads the JSON in `data/` that an element's `data` attribute names.
- `warnings.ts` is how Markz's warnings reach the author, with the file, the line, and what to
  write instead.
- `links.ts` is where a link in text goes, and whether it's there.
- `live.ts` finds the live elements a page uses, from its HTML, and the `.live` file of each.
- `vite.ts` is the Vite server Sitez runs for a site, with the config nobody writes.
- `render.ts` renders a layout or component module, a layout's `head`, and the document around
  them.
- `site.ts` is what `build` and `dev` share: reading the site, and rendering one page.
- `head.ts` is what a page's `<head>` says about it, from its metadata.
- `sitemap.ts` writes `sitemap.xml` and `feed.xml`.
- `islands.ts` is Sitez 0.1's Svelte islands, unused since pages became JS. It goes in step 15.
- `bundle.ts` builds what the browser downloads besides the HTML: the site's one stylesheet, and
  the live elements' JavaScript.
- `build.ts` renders every page and writes `dist/`.
- `report.ts` is what `build` prints: what each page costs to send and to build.
- `dev.ts` serves the site while it's written, rendering each page as it's asked for.
- `preview.ts` serves `dist/` as a static host would.
- `check.ts` formats, lints and type-checks the site's files, and reports Markz's warnings.
- `deploy.ts` builds and publishes `dist/` to GitHub Pages.
- `runtime/` is what a site's own code loads: the `sitez` import and its renderer, and the reset.
- `errors.ts` is how a mistake in a site becomes a message naming the file and what to change.
