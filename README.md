# sitez

A static site generator, and a Vite plugin with no options. Markz goes in `text/`, and every page
builds to complete HTML. [docs/idea.md](docs/idea.md) says what it promises.

A site adds Sitez to its `vite.config.js` and runs Vite's own commands.

```js
// vite.config.js
import sitez from "@amitkaps/sitez/vite";

export default { plugins: [sitez()] };
```

```json
{
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "devDependencies": { "@amitkaps/sitez": "0.2.0", "vite": "^8.0.0" }
}
```

Read [AGENTS.md](AGENTS.md) before changing the code. `pnpm check` and `pnpm test` must pass.
