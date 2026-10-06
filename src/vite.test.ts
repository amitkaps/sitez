/** @prose
 * # The site's modules in Vite
 *
 * A site's `import "@amitkaps/sitez"` gets `html`, whose templates the build renders. Only build
 * code gets it, and an element's browser `<script>` that imports it fails. Each part of an element
 * file is a module, with the file's own lines. Vite resolves every other import as Node does, from
 * the site's own `node_modules`.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "vite";
import { afterAll, expect, test } from "vite-plus/test";
import { html } from "./elementz/html.ts";
import { render } from "./elementz/render.ts";
import { partId, siteServer } from "./vite.ts";

const root = mkdtempSync(join(tmpdir(), "sitez-"));
for (const [file, content] of Object.entries({
  "site.md": "---\nurl: https://example.com\n---\n",
  "vite.config.js": `import sitez from ${JSON.stringify(join(import.meta.dirname, "../tests/sitez.ts"))};\n\nexport default { plugins: [sitez()] };\n`,
  "code/card.js":
    'import { html } from "@amitkaps/sitez";\nimport { label } from "labels";\nexport default (title) => html`<li>${label}${title}</li>`;\n',
  "code/@tag-list.html":
    '<template>\n  <script>\n    export const shout = (s) => s.toUpperCase();\n  </script>\n  <ul><li>${shout(attrs.first)}</li><li>${page.url}</li></ul>\n</template>\n\n<script>\n  export default (el) => el.toggleAttribute("ready");\n</script>\n',
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
  expect(render(card("Fish & Chips"))).toBe("<li>New: Fish &amp; Chips</li>");
});

test("an element's template is a module whose default export is its markup", async () => {
  const file = join(root, "code/@tag-list.html");
  const template = (await site.load(partId(file, "template"))).default as (s: object) => unknown;
  const scope = { attrs: { first: "a&b" }, page: { url: "/" }, pages: [], site: {}, html };
  expect(render(template(scope)).trim()).toBe("<ul><li>A&amp;B</li><li>/</li></ul>");
});

test("an element's part keeps the file's lines", async () => {
  const { client } = site.vite.environments;
  const id = partId(join(site.real, "code/@tag-list.html"), "setup");
  const { code } = (await client!.transformRequest(id))!;
  expect(code.split("\n").findIndex((line) => line.includes("toggleAttribute"))).toBe(8);
});

test("only build code gets html, and a browser script's import fails", async () => {
  const { client } = site.vite.environments;
  const importer = partId(join(site.real, "code/@tag-filter.html"), "setup");
  await expect(client!.pluginContainer.resolveId("@amitkaps/sitez", importer)).rejects.toThrow(
    "whose html renders at build time",
  );
});
