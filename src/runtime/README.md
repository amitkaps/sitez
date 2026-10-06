# runtime

What a site's own code loads: the `sitez` import. Nothing here imports the rest of Sitez, so the
folder can become a package of its own if something besides Sitez wants it ([elementz.md](../../docs/elementz.md#html)).

The package builds `index.ts` with its types (`dist/runtime/`).

- `index.ts` is the `sitez` import, which only build code makes. A `.browser.js` file imports
  nothing from Sitez.

The build imports the rest.

- `html.ts` is the template value that `html` makes.
- `render.ts` turns a template value into HTML.
