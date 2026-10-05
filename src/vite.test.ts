/** @prose
 * # Resolving `sitez`
 *
 * A site's `import "@amitkaps/sitez"` gets the running Sitez's runtime, even when the site installs
 * its own copy. Only build code gets it, and the browser can't.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, expect, test } from "vite-plus/test";
import { render } from "./runtime/render.ts";
import { runtime, siteServer } from "./vite.ts";

const root = mkdtempSync(join(tmpdir(), "sitez-"));
for (const [file, content] of Object.entries({
  "site.md": "---\nurl: https://example.com\n---\n",
  "code/card.js":
    'import { html } from "@amitkaps/sitez";\nexport default (title) => html`<li>${title}</li>`;\n',
  "node_modules/@amitkaps/sitez/package.json":
    '{ "name": "@amitkaps/sitez", "type": "module", "main": "index.js" }',
  "node_modules/@amitkaps/sitez/index.js": "export const html = () => 'the site’s own copy';\n",
})) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}
const site = await siteServer(root);
afterAll(() => site.close());

test("build code gets the build-time runtime, whose templates the build renders", async () => {
  const card = (await site.load(join(root, "code/card.js"))).default as (t: string) => unknown;
  expect(await render(card("Fish & Chips"))).toBe("<li>Fish &amp; Chips</li>");
});

test("only build code gets the runtime, and a live file's import fails", async () => {
  const { client, ssr } = site.vite.environments;
  const importer = join(site.real, "code/@tag-filter.live.js");
  expect((await ssr!.pluginContainer.resolveId("@amitkaps/sitez", importer))?.id).toBe(
    join(runtime, "index.ts"),
  );
  await expect(client!.pluginContainer.resolveId("@amitkaps/sitez", importer)).rejects.toThrow(
    "whose html renders at build time",
  );
});
