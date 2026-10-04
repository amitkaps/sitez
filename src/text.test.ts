/** @prose
 * # A text page's HTML
 *
 * Markz's HTML with its links rewritten, its elements written around their components' output and
 * its raw blocks written as they are. A fake `render` shows what each component is called with.
 */
import { parse } from "@amitkaps/markz";
import { describe, expect, test } from "vite-plus/test";
import { textHtml } from "./text.ts";

const components: Record<string, string> = {
  "call-out": "CallOut.js",
  "key-word": "KeyWord.js",
};
const hrefs: Record<string, string> = { "about.md": "/about/", "about.md#team": "/about/#team" };
const data: Record<string, unknown> = { "rows.json": [1, 2] };
const text = (source: string) =>
  textHtml("/site/text/index.md", parse(source), {
    component: (name) => components[name],
    link: (destination) =>
      destination === "gone.md"
        ? { problem: "gone.md isn't there." }
        : { href: hrefs[destination] ?? destination },
    data: (path) =>
      path in data ? { value: data[path] } : { problem: `data="${path}" isn't there.` },
    render: async (file, attributes, children, data) =>
      `[${file} ${JSON.stringify(attributes)}${children === undefined ? "" : `|${children}|`}${data ? JSON.stringify(data.value) : ""}]`,
  });

describe("textHtml", () => {
  test("is Markz HTML, braces and all", async () => {
    expect(await text("A {brace} and `${x}`.")).toBe("<p>A {brace} and <code>${x}</code>.</p>\n");
  });

  test("writes an element around its component's output, which gets its attributes and content", async () => {
    expect(await text("{@call-out type=note .a .b}\nBody.\n{/call-out}")).toBe(
      '<call-out class="a b" type="note">[CallOut.js {"type":"note","class":"a b"}|<p>Body.</p>\n|]</call-out>\n',
    );
  });

  test("renders nested components innermost first", async () => {
    expect(await text("{@call-out}\nA [t]{@key-word} and [u]{@key-word}.\n{/call-out}")).toBe(
      "<call-out>[CallOut.js {}|<p>A <key-word>[KeyWord.js {}|t|]</key-word> and <key-word>[KeyWord.js {}|u|]</key-word>.</p>\n|]</call-out>\n",
    );
  });

  test("gives an element with no content no children", async () => {
    expect(await text("{@call-out /}")).toBe("<call-out>[CallOut.js {}]</call-out>\n");
  });

  test("writes a bare attribute bare, and escapes a value", async () => {
    expect(await text('{@call-out open title="a & \\"b\\"" /}')).toContain(
      '<call-out open title="a &amp; &quot;b&quot;">',
    );
  });

  test("gives a component its data, and leaves the attribute out of the page", async () => {
    expect(await text('{@call-out data="rows.json" type=note /}')).toBe(
      '<call-out type="note">[CallOut.js {"type":"note"}[1,2]]</call-out>\n',
    );
  });

  test("fails on a data path that isn't there, naming its line", async () => {
    await expect(text('Intro.\n\n{@call-out data="gone.json" /}')).rejects.toThrow(
      'line 3: data="gone.json" isn\'t there.',
    );
  });

  test("leaves a data attribute on an element with no component as written", async () => {
    expect(await text("{@chart-view data=rows.json /}")).toBe(
      '<chart-view data="rows.json"></chart-view>\n',
    );
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
