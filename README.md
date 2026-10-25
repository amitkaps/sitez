# sitez

> Sitez is no longer worked on, and this repository is archived. [Pagez](https://pagez.amitkaps.com) takes its ideas further.

A static site generator, and a Vite plugin with no options, read at [sitez.amitkaps.com](https://sitez.amitkaps.com). Markz goes in `text/`, and every page builds to complete HTML. [The docs](docs/README.md) say what it promises, how to use it and how it's built.

A site adds Sitez to its `vite.config.js` and runs [Vite+](https://viteplus.dev)'s commands.

```js
// vite.config.js
import sitez from "@amitkaps/sitez/vite";

export default { plugins: [sitez()] };
```

```sh
vp dev       # serves the site while it's written
vp build     # writes it to dist/
```

Sitez needs Node 26 or newer, the Node it's built and tested on. [Usage](docs/usage.md) has the rest.
