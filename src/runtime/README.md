# runtime

What a site's own code loads: the `sitez` import, and Sitez's files its build takes in through
Vite. Nothing here imports the rest of Sitez, so the folder can become a package of its own if
something besides Sitez wants it ([design.md](../../docs/design.md#the-runtime)).

The package builds one of these files with its types (`dist/runtime/`).

- `index.ts` is the `sitez` import, which only build code makes. A live element's file imports
  nothing from Sitez.

The build imports the rest.

- `html.ts` is the template value that `html` makes.
- `render.ts` turns a template value into HTML.

The other files are copied into the package as they are.

- `reset.css` is the quiet, readable look every site's stylesheet begins with, for the site to
  override.
- `oxfmtrc.json` is the style `sitez check` formats a site's files in, which is oxfmt's defaults.
  Naming it keeps a config further up the tree from applying.
