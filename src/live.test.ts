/** @prose
 * # Finding a page's live elements
 *
 * Which `.live` files a page's HTML loads. A tag counts only when it's a real start tag with a
 * `.live` file up the tree from the page's URL. A live file's exports are its element's class
 * alone, and it imports a library by URL inside the class.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { expect, test } from "vite-plus/test";
import { checkLive, findLive } from "./live.ts";

const root = mkdtempSync(join(tmpdir(), "sitez-"));
for (const path of [
  "code/@tag-filter.live.js",
  "code/blog/@fold-out.live.ts",
  "code/@call-out.js",
  "code/@key-word.live.js",
]) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), "export default class extends HTMLElement {}\n");
}
const found = (url: string, html: string) =>
  findLive(root, url, html).map((live) => `${live.tag} ${relative(root, live.file)}`);

test("finds each tag with a live file once, sorted by tag, whatever else the page has", () => {
  expect(
    found(
      "/",
      '<tag-filter class="x"><key-word>a</key-word></tag-filter><tag-filter></tag-filter><call-out type=note></call-out><p>text</p>',
    ),
  ).toEqual(["key-word code/@key-word.live.js", "tag-filter code/@tag-filter.live.js"]);
});

test("finds a live file as it finds a component, up the tree from the URL", () => {
  expect(found("/blog/hello/", "<fold-out></fold-out>")).toEqual([
    "fold-out code/blog/@fold-out.live.ts",
  ]);
  expect(found("/about/", "<fold-out></fold-out>")).toEqual([]);
});

test("ignores a tag in text that shows HTML, in a comment, and in a script or a style", () => {
  expect(
    found(
      "/",
      '<p>&lt;tag-filter&gt;</p><!-- <tag-filter> --><script>document.write("<tag-filter>")</script><style>tag-filter::before { content: "<key-word>" }</style><code>tag-filter</code>',
    ),
  ).toEqual([]);
});

test("is none for a page with no custom elements", () => {
  expect(found("/", "<h1>Hello</h1><p>No elements.</p>")).toEqual([]);
});

test.each([
  ["a class", "export default class extends HTMLElement {}"],
  [
    "a named class, in TypeScript",
    "export default class Filter extends HTMLElement { n: number = 1; }",
  ],
  [
    "a call that makes the class",
    'import { element } from "./element.js";\nexport default element((el) => {});',
  ],
  [
    "imports and code beside it",
    'import { slug } from "./slug.js";\nconst n = 1;\nexport default class extends HTMLElement {}',
  ],
  [
    "a library it imports inside",
    'export default class extends HTMLElement { async connectedCallback() { await import("https://cdn.example.com/f.js"); } }',
  ],
])("a live file may default-export %s", (_, code) => {
  expect(() => checkLive(live(code))).not.toThrow();
});

test.each([
  [
    "no export",
    "customElements.define('x-y', class extends HTMLElement {});",
    "has no default export",
  ],
  ["a value", "export default 42;", "isn't a class written in the export"],
  ["an arrow", "export default (el) => {};", "is a function, which Sitez no longer wraps"],
  [
    "a function",
    "export default function (el) {}",
    "Set the element up in its connectedCallback()",
  ],
  [
    "a name",
    "class Filter extends HTMLElement {}\nexport default Filter;",
    "isn't a class written in the export",
  ],
  [
    "a name as default",
    "class Filter extends HTMLElement {}\nexport { Filter as default };",
    "isn't a class written in the export",
  ],
  [
    "a named export too",
    "export const label = 'Go';\nexport default class extends HTMLElement {}",
    "this exports label.",
  ],
  [
    "a library imported at the top",
    'import f from "https://cdn.example.com/f.js";\nexport default class extends HTMLElement {}',
    'await import("https://cdn.example.com/f.js")',
  ],
  [
    "a re-export",
    "export * from './x.js';\nexport default class extends HTMLElement {}",
    "this exports everything from ./x.js.",
  ],
])("a live file with %s fails", (_, code, message) => {
  expect(() => checkLive(live(code))).toThrow(message);
});

function live(code: string): string {
  const file = join(root, "code", `@x-${Math.random().toString(36).slice(2)}.live.ts`);
  writeFileSync(file, code);
  return file;
}
