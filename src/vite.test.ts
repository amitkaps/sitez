/** @prose
 * # The site's modules in Vite
 *
 * A site's `import "@amitkaps/sitez"` gets the build-time runtime, which renders the templates it
 * makes. Only build code gets it, and a `.browser.js` file's import of it fails. Vite resolves every other
 * import as Node does, from the site's own `node_modules`.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "vite";
import { afterAll, expect, test } from "vite-plus/test";
import { render } from "./runtime/render.ts";
import { siteServer } from "./vite.ts";

const root = mkdtempSync(join(tmpdir(), "sitez-"));
for (const [file, content] of Object.entries({
  "site.md": "---\nurl: https://example.com\n---\n",
  "vite.config.js": `import sitez from ${JSON.stringify(join(import.meta.dirname, "../tests/sitez.ts"))};\n\nexport default { plugins: [sitez()] };\n`,
  "code/card.js":
    'import { html } from "@amitkaps/sitez";\nimport { label } from "labels";\nexport default (title) => html`<li>${label}${title}</li>`;\n',
  "node_modules/labels/package.json": '{ "name": "labels", "type": "module", "main": "index.js" }',
  "node_modules/labels/index.js": "export const label = 'New: ';\n",
})) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}
const site = siteServer(
  await createServer({
    root,
    configLoader: "native",
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
  }),
);
afterAll(() => site.close());

test("build code gets the runtime, and the site's own packages", async () => {
  const card = (await site.load(join(root, "code/card.js"))).default as (t: string) => unknown;
  expect(await render(card("Fish & Chips"))).toBe("<li>New: Fish &amp; Chips</li>");
});

test("only build code gets the runtime, and a .browser.js file's import fails", async () => {
  const { client } = site.vite.environments;
  const importer = join(site.real, "code/@tag-filter.browser.js");
  await expect(client!.pluginContainer.resolveId("@amitkaps/sitez", importer)).rejects.toThrow(
    "whose html renders at build time",
  );
});
