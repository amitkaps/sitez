# Spike: `/teaching/` without Svelte

The test that decided Sitez 0.2: amitkaps.github.io's `/teaching/` page, built without Svelte
and measured against the live SvelteKit page. It held, and [design.md](../prose/design.md) was
rewritten from it. This folder is a throwaway: it goes when the rewrite lands (plan step 15).

```sh
node spike/build.js        # writes spike/dist/teaching/index.html
```

## What's here

- `runtime/` is the would-be runtime folder. `html.js` holds the template value, `render.js` the
  build's renderer, and `index.js` and `browser.js` the two halves of the flat `sitez` import.
- `site/` is the page in the new folders. `text/teaching.md` is the original Markdown, with the
  two elements where its `<!--@data-->` marker was. `code/` holds the layout, `ArticleHeader`,
  `TeachingGrid`, `FilterGrid` and `filter-grid.island.js`. `data/teachings.json` is
  `teachings.yml` converted, with entities decoded and empty values dropped.
- `build.js` is just enough build for this page. Markz writes the HTML, elements with a component
  are replaced by its output, and the layout wraps the result. Islands are found by scanning the
  HTML, and Vite bundles them.

## Results

Measured in Chrome, served gzipped, at 1280×900. "Slow" means 4× CPU throttling, 150 ms latency
and 200 KB/s.

|                         | SvelteKit (live) | Spike, island adds buttons | Spike, build writes buttons |
| ----------------------- | ---------------- | -------------------------- | --------------------------- |
| HTML (gzip)             | 6.1 KB           | 5.4 KB                     | 5.5 KB                      |
| JS (gzip)               | 205.8 KB         | 4.9 KB                     | 2.0 KB                      |
| Data in JS              | the whole site   | none                       | none                        |
| Load, slow              | 2.96 s           | 1.79 s                     | 1.82 s                      |
| Layout shift, slow      | 0.028            | 0.035                      | 0.028                       |
| Shift, slow, no fonts   | 0                | 0.019                      | 0                           |
| Filters (all/DS/talk/m) | 91/55/29/8       | 91/55/29/8                 | 91/55/29/8                  |

- **SvelteKit's 206 KB** is mostly one 170 KB chunk: the raw Markdown and YAML of every page,
  pulled in because `/teaching/`'s universal `load` imports `#lib`. That's the site's setup, not
  a floor. Fixed, with the load in `+page.server.ts`, it would be about 37 KB (estimated by
  subtracting that chunk, not built): about 31 KB of Svelte and Kit runtime plus the page's code,
  with the 2.6 KB of teaching data sent again as JSON for hydration. So the fair comparison is
  about 37 KB against 2 KB.
- **The shift left in every column is the web fonts swapping in**, which is the site's CSS
  (`font-display`), not the renderer. With fonts blocked, it disappears from SvelteKit and from
  the final spike.
- **An island that inserts markup races first paint.** The first spike's island prepended its
  buttons; on a slow load, its module ran just after first paint and pushed the grid down. Letting
  the build write the buttons, with the island only wiring them, removed the shift. It also
  dropped htl from the bundle, since the island no longer calls `html`.
- **Build:** 150–200 ms for the page, including loading the modules through Vite.

## Findings

1. **One tag, component and island.** `FilterGrid.js` writes `<filter-grid>` and its buttons at
   build time, and `filter-grid.island.js` upgrades that tag in the browser. That's how an island
   with controls avoids layout shift, so having both files for one name is a pattern, not an error.
2. **Template values need a brand, not a class.** The site's code loads `sitez` through Vite's
   module runner, while the build loads it through Node, so there are two copies of the module, and
   `instanceof` fails between them. `Symbol.for("sitez.template")` works across both.
3. **The renderer follows htl's rules for attributes.** In `href=${link}`, `undefined` drops the
   attribute and `true` leaves it bare. 26 of the 91 items have no link, and they come out with no
   `href`. A value written where an attribute name goes fails the build.
4. **oxfmt formats the HTML inside `html` templates**, as Prettier does, and oxlint passes. What's
   still missing next to Svelte is editor completion inside the strings.
5. **Markz's `html()` has no hook for elements.** The spike replaced elements in Markz's output
   with a regular expression. The real build needs markers, as `prose.ts` already uses for raw
   blocks, or an element hook in Markz.
6. **A layout can't add to `<head>`.** The live site preloads two fonts and links its icons from
   the layout's `<svelte:head>`. The spike hard-codes them. Answered since: `Head.js`, resolved
   like a layout.
7. **The indentation in templates goes into the HTML.** It costs little once gzipped (5.5 KB
   against SvelteKit's 6.1 KB), so no minifier is needed.
8. **Build errors name the file, not the line.** A handler found at build time says which file it
   came from. The line would have to come from a stack trace.
