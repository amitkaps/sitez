# elementz

The element layer: one `@name.html` file, read into its parts, rendered at build time and run in
the browser ([elementz.md](../../docs/elementz.md)). Nothing here imports the rest of Sitez, so
the folder can become a package of its own once a second host, such as Pagez, wants it. Sitez
is its host, and gives it modules through Vite and data from `data/`.

The package builds `index.ts` with its types (`dist/elementz/`).

- `index.ts` is the `sitez` import, `html`, which only build code imports. An element's browser
  `<script>` imports nothing from Sitez.

The host imports the rest.

- `file.ts` reads an element file into its parts, checks it, and writes each part as a module.
- `style.ts` checks that an element's CSS starts with its tag.
- `elements.ts` renders the elements in a piece of HTML, inside-out, each in its tag and with its
  content in its slot.
- `html.ts` is the template value that `html` makes, and `render.ts` turns it into HTML.
- `markup.ts` finds the tags in a piece of HTML, for the element file, the host's frame and an
  element's output.
- `runtime.ts` is `define`, all of elementz that reaches the browser.
- `errors.ts` is a mistake in a file, which names it.
