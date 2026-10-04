/** @prose
 * # The renderer's cases
 *
 * One row for each place a value can go, with what the build writes there, then the templates the
 * build refuses. A rule in design.md's runtime section has its case here. The tables are left
 * unformatted, since oxfmt would reflow the HTML inside them, and each row is exact.
 */
import { describe, expect, test } from "vite-plus/test";
import { html, raw } from "./html.ts";
import { define } from "./index.ts";
import { render, TemplateError } from "./render.ts";

const link = { url: "/blog/", title: "Fish & Chips" };

describe("render", () => {
  // oxfmt-ignore
  test.each<[string, unknown, string]>([
    // Text
    ["a string, escaped", html`<p>${`<b>"Tom" & 'Jerry'</b>`}</p>`, "<p>&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;</p>"],
    ["a number", html`<p>${42}</p>`, "<p>42</p>"],
    ["null, undefined and false, as nothing", html`<p>${null}${undefined}${false}</p>`, "<p></p>"],
    ["true, as the word", html`<p>${true}</p>`, "<p>true</p>"],
    ["a nested template, as HTML", html`<ul>${html`<li>${link.title}</li>`}</ul>`, "<ul><li>Fish &amp; Chips</li></ul>"],
    ["an array, as each of its items", html`<ul>${["a", "b"].map((x) => html`<li>${x}</li>`)}</ul>`, "<ul><li>a</li><li>b</li></ul>"],
    ["an array of strings, escaped", html`<p>${["<", ">"]}</p>`, "<p>&lt;&gt;</p>"],
    ["raw HTML, as it is", html`<main>${raw("<p>Hi</p>")}</main>`, "<main><p>Hi</p></main>"],
    ["a value after a <, as text", html`<p>1 < ${2}</p>`, "<p>1 < 2</p>"],

    // Attributes
    ["an attribute's value, quoted", html`<a href=${link.url}>x</a>`, `<a href="/blog/">x</a>`],
    ["an attribute's value, escaped", html`<a title=${link.title}>x</a>`, `<a title="Fish &amp; Chips">x</a>`],
    ["a quoted value, escaped", html`<a title="${`"hi"`}">x</a>`, `<a title="&quot;hi&quot;">x</a>`],
    ["part of a quoted value", html`<a class="card ${"wide"}">x</a>`, `<a class="card wide">x</a>`],
    ["part of a single-quoted value", html`<a title='${"it's"}'>x</a>`, `<a title='it&#39;s'>x</a>`],
    ["part of an unquoted value, as entities", html`<a href=/a/${"b c"}>x</a>`, `<a href=/a/b&#32;c>x</a>`],
    ["null, dropping the attribute", html`<a href=${null}>x</a>`, `<a>x</a>`],
    ["undefined, dropping the attribute", html`<a class="c" href=${undefined} id="i">x</a>`, `<a class="c" id="i">x</a>`],
    ["false, dropping the attribute", html`<input disabled=${false} />`, `<input />`],
    ["true, leaving it bare", html`<input disabled=${true} />`, `<input disabled />`],
    ["an empty string, kept", html`<img alt=${""} />`, `<img alt="" />`],
    ["a number, quoted", html`<td colspan=${2}></td>`, `<td colspan="2"></td>`],
    ["null in a quoted value, as nothing", html`<a class="${null}">x</a>`, `<a class="">x</a>`],
    ["several attributes across lines", html`<a\n  href=${"/"}\n  hidden=${false}\n  id=${"x"}\n>x</a>`, `<a\n  href="/"\n  id="x"\n>x</a>`],

    // Raw text and comments
    ["a value in <script>, as it is", html`<script type="application/ld+json">${JSON.stringify({ a: "<b>" })}</script>`, `<script type="application/ld+json">{"a":"<b>"}</script>`],
    ["a value in <style>, as it is", html`<style>a > b { color: ${"red"} }</style><p>${"<"}</p>`, `<style>a > b { color: red }</style><p>&lt;</p>`],
    ["text after </script>, escaped again", html`<script>1 < 2</script>${"<"}`, `<script>1 < 2</script>&lt;`],
    ["a value in a comment, dropped", html`<!-- ${"note"} --><p>${"x"}</p>`, `<!--  --><p>x</p>`],
    ["a value after a doctype", html`<!doctype html><p>${"&"}</p>`, `<!doctype html><p>&amp;</p>`],

    // Values that aren't templates
    ["a string on its own, escaped", "a & b", "a &amp; b"],
    ["null on its own, as nothing", null, ""],
  ])("%s", async (_, value, expected) => {
    expect(await render(value)).toBe(expected);
  });

  test("awaits promises, nested and in arrays", async () => {
    const later = <T>(value: T) => new Promise<T>((done) => setTimeout(() => done(value), 5));
    const card = async (title: string) => html`<li>${later(title)}</li>`;
    // oxfmt-ignore
    const page = html`<h1>${later("Talks")}</h1><ul>${[card("a"), later(card("b"))]}</ul><a href=${later("/x/")}>x</a>`;
    expect(await render(page)).toBe(
      `<h1>Talks</h1><ul><li>a</li><li>b</li></ul><a href="/x/">x</a>`,
    );
  });

  test("renders a template whose function is async", async () => {
    // oxfmt-ignore
    const list = async ({ pages }: { pages: string[] }) => html`<ul>${pages.map((p) => html`<li>${p}</li>`)}</ul>`;
    expect(await render(list({ pages: ["/"] }))).toBe("<ul><li>/</li></ul>");
  });
});

describe("render fails", () => {
  // oxfmt-ignore
  test.each<[string, unknown, RegExp]>([
    ["a function in text", html`<button>${() => {}}</button>`, /holds a function.*island/],
    ["a function as an attribute", html`<button onclick=${() => {}}>x</button>`, /holds a function.*island/],
    ["a function in an array", html`<ul>${[() => {}]}</ul>`, /holds a function/],
    ["a promise of a function", html`<p>${Promise.resolve(() => {})}</p>`, /holds a function/],
    ["a value where an attribute's name goes", html`<a ${"href"}="/">x</a>`, /attribute's name goes/],
    ["an object spread as attributes", html`<a ${{ href: "/" }}>x</a>`, /attribute's name goes/],
    ["a value as a tag's name", html`<${"div"}>x</div>`, /tag's name/],
    ["a value right after a tag's name", html`<div${"x"}>x</div>`, /tag's name/],
    ["a template in an attribute", html`<a title=${html`<b>x</b>`}>x</a>`, /template can't go in an attribute/],
    ["a plain object in text", html`<p>${{ title: "x" }}</p>`, /object where text goes/],
    ["a plain object in an attribute", html`<a title=${{ title: "x" }}>x</a>`, /object where text goes/],
    ["a closing tag in <script>", html`<script>${"</script><p>"}</script>`, /holds <\/script>/],
  ])("on %s", async (_, value, message) => {
    const error = await render(value).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(TemplateError);
    expect((error as Error).message).toMatch(message);
  });
});

test("define fails at build time, naming the island's file", () => {
  expect(() => define("tag-filter", () => {})).toThrow("code/tag-filter.island.js");
});
