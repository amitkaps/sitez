# src

Sitez itself: the `sitez` command and the stages a site goes through on its way to `dist/`. Each
stage gets a file here, or a folder once it needs more than one, as its step in
[plan.md](../prose/plan.md) starts.

- `cli.ts` is the command: it finds the site and runs one of `dev`, `build`, `preview`, `check`
  and `deploy`.
- `root.ts` finds the site from wherever `sitez` runs.
- `discover.ts` decides which files are pages, at which URLs, and which pattern of a name, such
  as a layout, is nearest to each.
- `metadata.ts` is what a page knows about itself, the site and all the prose.
- `prose.ts` turns a Markz page into a Svelte component, its elements into the site's components.
- `warnings.ts` is how Markz's warnings reach the author: file, line, and what to write instead.
- `links.ts` is where a link in prose goes, and whether it's there.
- `vite.ts` is the Vite server Sitez runs for a site, with the config nobody writes.
- `render.ts` turns one page into a complete HTML document.
- `site.ts` is what `build` and `dev` share: reading the site, and rendering one page.
- `head.ts` is what a page's `<head>` says about it, from its metadata.
- `sitemap.ts` writes `sitemap.xml` and `feed.xml`.
- `islands.ts` decides which components are islands, from their source, and wraps each one the
  server render imports.
- `bundle.ts` builds what the browser downloads besides the HTML: the site's one stylesheet, and
  the islands' JavaScript.
- `build.ts` renders every page and writes `dist/`.
- `report.ts` is what `build` prints: what each page costs to send and to build.
- `dev.ts` serves the site while it's written, rendering each page as it's asked for.
- `preview.ts` serves `dist/` as a static host would.
- `check.ts` formats, lints and type-checks the site's files, and reports Markz's warnings.
- `deploy.ts` builds and publishes `dist/` to GitHub Pages.
- `runtime/` holds Sitez's files that a site's own build loads through Vite, such as the reset and the islands' runtime.
- `errors.ts` is how a mistake in a site becomes a message naming the file and what to change.
