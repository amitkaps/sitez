/** @prose
 * # A text page's HTML
 *
 * Markz's HTML with its links rewritten, its elements rendered by their components and its raw
 * blocks written as they are. A fake `render` shows what each component is called with.
 */
import { parse } from "@amitkaps/markz";
import { describe, expect, test } from "vite-plus/test";
import { componentName, textHtml } from "./text.ts";

const components: Record<string, string> = {
  "call-out": "CallOut.js",
  "key-word": "KeyWord.js",
};
const hrefs: Record<string, string> = { "about.md": "/about/", "about.md#team": "/about/#team" };
const text = (source: string) =>
  textHtml("/site/text/index.md", parse(source), {
    component: (name) => components[name],
    link: (destination) =>
      destination === "gone.md"
        ? { problem: "gone.md isn't there." }
        : { href: hrefs[destination] ?? destination },
    render: async (file, attributes, children) =>
      `[${file} ${JSON.stringify(attributes)}${children === undefined ? "" : `|${children}|`}]`,
  });

describe("textHtml", () => {
  test("is Markz HTML, braces and all", async () => {
    expect(await text("A {brace} and `${x}`.")).toBe("<p>A {brace} and <code>${x}</code>.</p>\n");
  });

  test("renders an element with a component, with its attributes and content", async () => {
    expect(await text("{@call-out type=note .a .b}\nBody.\n{/call-out}")).toBe(
      '[CallOut.js {"type":"note","class":"a b"}|<p>Body.</p>\n|]\n',
    );
  });

  test("renders nested components innermost first", async () => {
    expect(await text("{@call-out}\nA [t]{@key-word} and [u]{@key-word}.\n{/call-out}")).toBe(
      "[CallOut.js {}|<p>A [KeyWord.js {}|t|] and [KeyWord.js {}|u|].</p>\n|]\n",
    );
  });

  test("gives an element with no content no children", async () => {
    expect(await text("{@call-out /}")).toBe("[CallOut.js {}]\n");
  });

  test("fails on an attribute named like a prop every component gets", async () => {
    await expect(text("Intro.\n\n{@call-out pages=short /}")).rejects.toThrow(
      "line 3: {@call-out} has a pages attribute, but every component in text already gets page, pages, site and children.",
    );
  });

  test("leaves an element with no component, and element syntax in code, as Markz writes them", async () => {
    expect(await text("{@chart-view data=a.csv /}\n\n`<call-out>`")).toBe(
      '<chart-view data="a.csv"></chart-view>\n<p><code>&lt;call-out&gt;</code></p>\n',
    );
  });

  test("does not render an element whose name starts with a component name", async () => {
    expect(await text("{@call-out-box /}")).toBe("<call-out-box></call-out-box>\n");
  });

  test("writes raw HTML as it is, inside containers too", async () => {
    expect(await text('> ```=html\n> <script>go("</script>")</script>\n> ```')).toBe(
      '<blockquote>\n<script>go("</script>")</script>\n</blockquote>\n',
    );
  });

  test("writes each link and image as the URL it resolves to, leaving code alone", async () => {
    expect(await text("[About](about.md#team) and `[x](about.md)`.")).toBe(
      '<p><a href="/about/#team">About</a> and <code>[x](about.md)</code>.</p>\n',
    );
  });

  test("fails on a link that goes nowhere, naming its line", async () => {
    await expect(text("# Home\n\nSee [it](gone.md).")).rejects.toThrow(
      "line 3: gone.md isn't there.",
    );
  });
});

test("componentName capitalizes each part of the element name", () => {
  expect(componentName("call-out")).toBe("CallOut");
  expect(componentName("chart-view-2d")).toBe("ChartView2d");
});
