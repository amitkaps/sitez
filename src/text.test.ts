/** @prose
 * # A text page's HTML
 *
 * Markz's HTML with its links rewritten, its elements written around what their templates write and
 * its raw blocks written as they are. A fake `render` shows what each element is called with.
 */
import { parse } from "@amitkaps/markz";
import { describe, expect, test } from "vite-plus/test";
import { textHtml } from "./text.ts";

const elements = new Set(["call-out", "key-word", "fact-box"]);
const hrefs: Record<string, string> = { "about.md": "/about/", "about.md#team": "/about/#team" };
const data: Record<string, unknown> = { "rows.json": [1, 2] };
const text = (source: string) =>
  textHtml("/site/text/index.md", parse(source), {
    element: (name) => elements.has(name),
    link: (destination) =>
      destination === "gone.md"
        ? { problem: "gone.md isn't there." }
        : { href: hrefs[destination] ?? destination },
    data: (path) =>
      path in data ? { value: data[path] } : { problem: `data="${path}" isn't there.` },
    render: async (name, attributes, content, data) =>
      name === "fact-box"
        ? "<div-ider></div-ider><DIV>fact</DIV>"
        : `[${name} ${JSON.stringify(attributes)}${content === undefined ? "" : `|${content}|`}${data ? JSON.stringify(data.value) : ""}]`,
  });

describe("textHtml", () => {
  test("is Markz HTML, braces and all", async () => {
    expect(await text("A {brace} and `${x}`.")).toBe("<p>A {brace} and <code>${x}</code>.</p>\n");
  });

  test("writes an element around what its template writes, which gets its attributes and content", async () => {
    expect(await text("{@call-out type=note .a .b}\nBody.\n{/call-out}")).toBe(
      '<call-out class="a b" type="note">[call-out {"type":"note","class":"a b"}|<p>Body.</p>\n|]</call-out>\n',
    );
  });

  test("renders nested elements innermost first", async () => {
    expect(await text("{@call-out}\nA [t]{@key-word} and [u]{@key-word}.\n{/call-out}")).toBe(
      "<call-out>[call-out {}|<p>A <key-word>[key-word {}|t|]</key-word> and <key-word>[key-word {}|u|]</key-word>.</p>\n|]</call-out>\n",
    );
  });

  test("gives an element with no content none", async () => {
    expect(await text("{@call-out /}")).toBe("<call-out>[call-out {}]</call-out>\n");
  });

  test("writes a bare attribute bare, and escapes a value", async () => {
    expect(await text('{@call-out open title="a & \\"b\\"" /}')).toContain(
      '<call-out open title="a &amp; &quot;b&quot;">',
    );
  });

  test("gives an element its data, and leaves the attribute out of the page", async () => {
    expect(await text('{@call-out data="rows.json" type=note /}')).toBe(
      '<call-out type="note">[call-out {"type":"note"}[1,2]]</call-out>\n',
    );
  });

  test("fails on a data path that isn't there, naming its line", async () => {
    await expect(text('Intro.\n\n{@call-out data="gone.json" /}')).rejects.toThrow(
      'line 3: data="gone.json" isn\'t there.',
    );
  });

  test("leaves a data attribute on an element with no file as written", async () => {
    expect(await text("{@chart-view data=rows.json /}")).toBe(
      '<chart-view data="rows.json"></chart-view>\n',
    );
  });

  test("fails on an inline element whose output would end its paragraph, naming the tag", async () => {
    await expect(text("Intro.\n\nA [fact]{@fact-box}.")).rejects.toThrow(
      "line 3: {@fact-box} is used inline, but its template writes a <div>, which ends a paragraph.",
    );
  });

  test("lets a leaf or container write block HTML", async () => {
    expect(await text("{@fact-box /}")).toBe(
      "<fact-box><div-ider></div-ider><DIV>fact</DIV></fact-box>\n",
    );
  });

  test("leaves an element with no file, and element syntax in code, as Markz writes them", async () => {
    expect(await text("{@chart-view data=a.csv /}\n\n`<call-out>`")).toBe(
      '<chart-view data="a.csv"></chart-view>\n<p><code>&lt;call-out&gt;</code></p>\n',
    );
  });

  test("does not render an element whose name starts with another element's name", async () => {
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
