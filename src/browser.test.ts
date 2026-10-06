/** @prose
 * # What a page's elements ship
 *
 * Which elements a page's HTML uses that ship CSS or behavior. A tag counts only when it's a real
 * start tag of an element with a `<style>` or a `<script>`. That script imports a library by URL
 * inside its setup, never at the top.
 */
import { expect, test } from "vite-plus/test";
import { usedElements } from "./browser.ts";
import { readElement, type ElementFile } from "./elementz/file.ts";

const setup = "<script>export default () => {};</script>";
const elements = new Map<string, ElementFile>();
for (const [tag, source] of [
  ["tag-filter", setup],
  ["fold-out", `<style>fold-out { display: block }</style>${setup}`],
  ["key-word", "<style>key-word { font-style: italic }</style>"],
  ["call-out", "<template><aside><slot></slot></aside></template>"],
] as const) {
  elements.set(tag, readElement(`/site/code/@${tag}.html`, [], source));
}
const found = (html: string) =>
  usedElements(elements, html).map(
    (used) => `${used.tag}${used.setup ? " setup" : ""}${used.style ? " style" : ""}`,
  );

test("finds each tag that ships something once, sorted by tag, whatever else the page has", () => {
  expect(
    found(
      '<tag-filter class="x"><key-word>a</key-word></tag-filter><tag-filter></tag-filter><fold-out></fold-out><call-out type=note></call-out><p>text</p>',
    ),
  ).toEqual(["fold-out setup style", "key-word style", "tag-filter setup"]);
});

test("ignores a tag in text that shows HTML, in a comment, and in a script or a style", () => {
  expect(
    found(
      '<p>&lt;tag-filter&gt;</p><!-- <tag-filter> --><script>document.write("<tag-filter>")</script><style>tag-filter::before { content: "<key-word>" }</style><code>tag-filter</code>',
    ),
  ).toEqual([]);
});

test("fails on a library imported by URL at the top of a script, but not inside setup", () => {
  const at = (script: string) =>
    new Map([
      ["url-box", readElement("/site/code/@url-box.html", [], `<script>\n${script}\n</script>`)],
    ]);
  expect(() =>
    usedElements(
      at('import f from "https://cdn.example.com/f.js";\nexport default () => f();'),
      "<url-box></url-box>",
    ),
  ).toThrow("line 2: this imports https://cdn.example.com/f.js at the top");
  expect(() =>
    usedElements(
      at('export default async () => await import("https://cdn.example.com/f.js");'),
      "<url-box></url-box>",
    ),
  ).not.toThrow();
});
