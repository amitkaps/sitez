/** @prose
 * # Reading an element file
 *
 * An element file read into its parts, each part as a module on the file's own lines, and every
 * check that needs only the file, each failing with the line.
 */
import { describe, expect, test } from "vite-plus/test";
import { elementStyle, readElement, setupModule, templateModule } from "./file.ts";

const file = "/site/code/@tag-filter.html";
const read = (source: string) => readElement(file, ["page", "pages", "site"], source);
const fails = (source: string) => {
  try {
    read(source);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected it to fail");
};

const full = `<!-- Filters posts by tag. -->
<template element="tag-filter">
  <script>
    export const tags = (pages) => pages.flatMap((p) => p.tags ?? []);
  </script>
  <p>\${tags(pages).map((t) => html\`<button>\${t}</button>\`)}</p>
</template>

<style>
  tag-filter {
    display: block;
  }
</style>

<script>
  export default (el, { signal }) => {
    el.addEventListener("click", () => {}, { signal });
  };
</script>
`;

describe("readElement", () => {
  test("reads each part, and the template's script apart from its markup", () => {
    const element = read(full);
    expect(element.name).toBe("tag-filter");
    expect(element.template!.script!.text).toContain("export const tags");
    expect(element.template!.markup.text.trim()).toMatch(/^<p>/);
    expect(element.style!.text).toContain("display: block");
    expect(element.script!.text).toContain("export default");
  });

  test("gives each part as a module whose lines are the file's", () => {
    const element = read(full);
    const line = (code: string, text: string) =>
      code.split("\n").findIndex((l) => l.includes(text)) + 1;
    const template = templateModule(element, ["page", "pages", "site"]);
    expect(line(template, "export const tags")).toBe(4);
    expect(line(template, "export default ({ attrs, html, page, pages, site }) => html`")).toBe(5);
    expect(line(template, "<p>")).toBe(6);
    expect(template).not.toContain("display: block");
    expect(line(setupModule(element), "addEventListener")).toBe(17);
    const style = elementStyle(element);
    expect(line(style, "@layer elements {")).toBe(9);
    expect(line(style, "display: block")).toBe(11);
  });

  test("takes every part as optional", () => {
    expect(read("").template).toBeUndefined();
    expect(read("<template><b>x</b></template>").template!.script).toBeUndefined();
    expect(read("<style>tag-filter { color: red }</style>").style).toBeDefined();
  });

  test.each([
    ["markup outside the template", "<p>x</p>", "line 1: <p> is outside the <template>."],
    [
      "text outside the template",
      "<template></template>\nhi",
      "line 2: this text is outside the <template>.",
    ],
    ["a second style", "<style></style><style></style>", "line 1: this is a second <style>."],
    ["an unclosed template", "\n<template><b>x</b>", "line 2: <template> is never closed."],
    ["a stray end tag", "</div>", "line 1: </div> closes nothing."],
    [
      "a template's script after its markup",
      "<template><p>x</p><script>export const a = 1;</script></template>",
      "the template's <script> comes after its markup",
    ],
    [
      "two scripts in a template",
      "<template><script></script><p>x</p><script></script></template>",
      "this is a second <script> in the <template>",
    ],
    [
      "an element name that isn't the file's",
      '<template element="tag-list"></template>',
      'write element="tag-filter" or leave it out',
    ],
    [
      "a named slot",
      '<template>\n<slot name="x"></slot></template>',
      "line 2: an element has one slot, with no name",
    ],
    [
      "a shadow root",
      '<template shadowrootmode="open"></template>',
      "shadowrootmode makes a shadow root",
    ],
    [
      "an export named like the scope",
      "<template><script>\nexport const page = 1;\n</script></template>",
      "line 2: this exports page, which the template already has (attrs, html, page, pages, site).",
    ],
    [
      "a default export in the template's script",
      "<template><script>export default 1;</script></template>",
      "the template's script has a default export",
    ],
    [
      "</script> in a string",
      '<script>\nconst a = "</script>";\nexport default () => a;\n</script>',
      "line 2: this </script> is inside the script's code",
    ],
    [
      "a browser script with no default",
      "<script>\nconst a = 1;\n</script>",
      "the <script> has no default export",
    ],
    [
      "a browser script that exports a class",
      "<script>\nexport default class extends HTMLElement {}\n</script>",
      "line 2: the <script> exports a class",
    ],
  ])("fails on %s", (_, source, message) => {
    expect(fails(source)).toContain(message);
  });

  test("reads </script> written <\\/script> in a string, and <template> in one, as code", () => {
    expect(() =>
      read('<script>\nconst a = "<\\/script><template>";\nexport default () => a;\n</script>'),
    ).not.toThrow();
  });
});

describe("an element's CSS", () => {
  test.each([
    ["the tag", "tag-filter { color: red }"],
    [
      "the tag with a descendant, a class and a list",
      "tag-filter li, tag-filter.wide, tag-filter:not(:defined) p { color: red }",
    ],
    ["nesting", "tag-filter { & .frame { color: red } .x, .y { color: blue } }"],
    [
      "rules in @media and @layer",
      "@media (width > 40rem) { tag-filter { color: red } } @layer x { tag-filter p { color: red } }",
    ],
    [
      "at-rules with no selectors",
      "@keyframes spin { from { rotate: 0 } to { rotate: 1turn } } @import url(x.css);",
    ],
    ["a brace in a string and a comment", 'tag-filter::before { content: "}" } /* li { } */'],
  ])("passes %s", (_, css) => {
    expect(() => read(`<style>${css}</style>`)).not.toThrow();
  });

  test.each([
    ["another selector", "\np { color: red }", "line 2: the rule p doesn't start with tag-filter."],
    [
      "one in a list",
      "tag-filter, .x { color: red }",
      "the rule .x doesn't start with tag-filter.",
    ],
    ["a longer name", "tag-filter-x { color: red }", "the rule tag-filter-x doesn't start"],
    ["one inside @media", "@media print { li { color: red } }", "the rule li doesn't start"],
  ])("fails on %s", (_, css, message) => {
    expect(fails(`<style>${css}</style>`)).toContain(message);
  });
});
