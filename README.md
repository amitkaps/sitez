# sitez

A static site generator, and a Vite plugin with no options. Markz goes in `text/`, and every page
builds to complete HTML. [The docs](docs/README.md) say what it promises, how to use it and how it's built.

A site adds Sitez to its `vite.config.js` and runs [Vite+](https://viteplus.dev)'s commands.

```js
// vite.config.js
import sitez from "@amitkaps/sitez/vite";

export default { plugins: [sitez()] };
```

```json
{
  "scripts": { "dev": "vp dev", "build": "vp build", "preview": "vp preview" },
  "devDependencies": { "@amitkaps/sitez": "0.4.0", "vite-plus": "^1.1.0" }
}
```

Sitez needs Node 26 or newer, the Node it's built and tested on. [Usage](docs/usage.md) has the rest.

Read [AGENTS.md](AGENTS.md) before changing the code. `pnpm check` and `pnpm test` must pass.
