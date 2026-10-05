/** @prose
 * # Finding a page's elements with behavior
 *
 * Which `.browser.js` files a page's HTML loads. A tag counts only when it's a real start tag with a
 * `.browser.js` file. That file's exports are its element's class alone, and it imports a library
 * by URL inside the class.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { expect, test } from "vite-plus/test";
import type { Elements } from "./discover.ts";
import { checkBrowser, findBrowser } from "./browser.ts";

const root = mkdtempSync(join(tmpdir(), "sitez-"));
const elements: Elements = new Map();
for (const [tag, path] of [
  ["tag-filter", "code/@tag-filter.browser.js"],
  ["fold-out", "code/blog/@fold-out.browser.ts"],
  ["key-word", "code/@key-word.browser.js"],
]) {
  const file = join(root, path!);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "export default class extends HTMLElement {}\n");
  elements.set(tag!, { browser: file });
}
elements.set("call-out", { markup: { file: join(root, "code/@call-out.html.js"), kind: "js" } });
const found = (html: string) =>
  findBrowser(elements, html).map((found) => `${found.tag} ${relative(root, found.file)}`);

test("finds each tag with a .browser.js file once, sorted by tag, whatever else the page has", () => {
  expect(
    found(
      '<tag-filter class="x"><key-word>a</key-word></tag-filter><tag-filter></tag-filter><call-out type=note></call-out><p>text</p>',
    ),
  ).toEqual(["key-word code/@key-word.browser.js", "tag-filter code/@tag-filter.browser.js"]);
});

test("finds an element's behavior wherever its file sits, since elements are global", () => {
  expect(found("<fold-out></fold-out>")).toEqual(["fold-out code/blog/@fold-out.browser.ts"]);
});

test("ignores a tag in text that shows HTML, in a comment, and in a script or a style", () => {
  expect(
    found(
      '<p>&lt;tag-filter&gt;</p><!-- <tag-filter> --><script>document.write("<tag-filter>")</script><style>tag-filter::before { content: "<key-word>" }</style><code>tag-filter</code>',
    ),
  ).toEqual([]);
});

test("is none for a page with no custom elements", () => {
  expect(found("<h1>Hello</h1><p>No elements.</p>")).toEqual([]);
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
])("a .browser.js file may default-export %s", (_, code) => {
  expect(() => checkBrowser(browserFile(code))).not.toThrow();
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
])("a .browser.js file with %s fails", (_, code, message) => {
  expect(() => checkBrowser(browserFile(code))).toThrow(message);
});

function browserFile(code: string): string {
  const file = join(root, "code", `@x-${Math.random().toString(36).slice(2)}.browser.ts`);
  writeFileSync(file, code);
  return file;
}
