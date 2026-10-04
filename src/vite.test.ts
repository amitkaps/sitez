/** @prose
 * # Resolving `sitez`
 *
 * A site's `import "sitez"` gets the running Sitez's runtime, the build-time half on the server and
 * the browser half in the client, even when the site installs its own copy.
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
    'import { html } from "sitez";\nexport default (title) => html`<li>${title}</li>`;\n',
  "node_modules/sitez/package.json": '{ "name": "sitez", "type": "module", "main": "index.js" }',
  "node_modules/sitez/index.js": "export const html = () => 'the site’s own copy';\n",
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

test("the browser gets the browser runtime", async () => {
  const { client, ssr } = site.vite.environments;
  const importer = join(site.real, "code/@tag-filter.live.js");
  expect((await client!.pluginContainer.resolveId("sitez", importer))?.id).toBe(
    join(runtime, "browser.ts"),
  );
  expect((await ssr!.pluginContainer.resolveId("sitez", importer))?.id).toBe(
    join(runtime, "index.ts"),
  );
});
