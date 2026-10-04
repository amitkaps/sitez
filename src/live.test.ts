/** @prose
 * # Finding a page's live elements
 *
 * Which `.live` files a page's HTML loads. A tag counts only when it's a real start tag with a
 * `.live` file up the tree from the page's URL.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { expect, test } from "vite-plus/test";
import { findLive } from "./live.ts";

const root = mkdtempSync(join(tmpdir(), "sitez-"));
for (const path of [
  "code/@tag-filter.live.js",
  "code/blog/@fold-out.live.ts",
  "code/@call-out.js",
  "code/@key-word.live.js",
]) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), "");
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
