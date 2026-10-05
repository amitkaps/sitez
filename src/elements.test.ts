/** @prose
 * # Elements in HTML
 *
 * What an element does in `index.html` and in another element's output, which is what it does in
 * text. Elements with markup files are rendered innermost first, and what an element writes is
 * read for elements too. Each failure names the file that wrote the tag.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import type { Elements } from "./discover.ts";
import { renderElements, type ElementSite } from "./elements.ts";
import { SiteError } from "./errors.ts";
import { html } from "./runtime/html.ts";

const dir = mkdtempSync(join(tmpdir(), "sitez-"));
mkdirSync(join(dir, "code"));

const elements: Elements = new Map();
const modules: Record<string, Record<string, unknown>> = {};
/** A static element, from a file of its markup. */
function markup(tag: string, source: string) {
  const file = join(dir, "code", `@${tag}.html`);
  writeFileSync(file, source);
  elements.set(tag, { markup: { file, kind: "html" } });
}
/** A function element, called with the props an element gets. */
function written(tag: string, fn: (props: any) => unknown) {
  const file = join(dir, "code", `@${tag}.html.js`);
  modules[file] = { default: fn };
  elements.set(tag, { markup: { file, kind: "js" } });
}

markup("site-note", "<aside><b>Note</b><slot></slot></aside>\n");
markup("site-plain", "<hr>\n");
written(
  "site-box",
  ({ children, ...rest }) => html`<div data-props=${Object.keys(rest).join(",")}>${children}</div>`,
);
written(
  "site-card",
  ({ title, data }) =>
    html`<h2>${title}</h2>
      <site-note>${data?.length ?? 0} rows</site-note>`,
);
written("site-a", () => html`<site-b></site-b>`);
written("site-b", () => html`<site-a></site-a>`);
elements.set("site-plain-tag", {});

const site: ElementSite = {
  elements,
  load: async (file) => modules[file]!,
  data: (path) =>
    path === "rows.json" ? { value: [1, 2, 3] } : { problem: `data="${path}" isn't there.` },
  props: { page: { url: "/about/" }, pages: [], site: {} },
};
const render = (source: string) => renderElements(site, source, join(dir, "code/index.html"), []);
const fails = async (source: string) => {
  try {
    await render(source);
  } catch (error) {
    if (error instanceof SiteError) return error;
    throw error;
  }
  throw new Error("expected a SiteError");
};

describe("renderElements", () => {
  test("writes an element around what its markup file writes, with its attributes", async () => {
    expect(await render('<main><site-plain class="x" hidden></site-plain></main>')).toBe(
      '<main><site-plain class="x" hidden><hr></site-plain></main>',
    );
  });

  test("puts an element's content where its slot is, rendered, and its function gets the page's props", async () => {
    expect(await render('<site-note><site-box id="b"><em>hi</em></site-box></site-note>')).toBe(
      '<site-note><aside><b>Note</b><site-box id="b"><div data-props="id,page,pages,site"><em>hi</em></div></site-box></aside></site-note>',
    );
  });

  test("renders what an element writes, for the elements in it", async () => {
    const out = await render('<site-card title="Cards" data="rows.json" />');
    expect(out.replace(/\s*\n\s*/g, "")).toBe(
      '<site-card title="Cards"><h2>Cards</h2><site-note><aside><b>Note</b>3 rows</aside></site-note></site-card>',
    );
  });

  test("renders content once, so an element in an element of the same name is its own", async () => {
    expect(await render("<site-note><site-note>x</site-note></site-note>")).toBe(
      "<site-note><aside><b>Note</b><site-note><aside><b>Note</b>x</aside></site-note></aside></site-note>",
    );
  });

  test("leaves plain tags, comments and scripts as they are, but renders what a plain tag holds", async () => {
    expect(
      await render(
        '<!-- <site-plain></site-plain> --><site-plain-tag><site-plain></site-plain></site-plain-tag><script>"<site-plain>"</script><p>no-tag</p>',
      ),
    ).toBe(
      '<!-- <site-plain></site-plain> --><site-plain-tag><site-plain><hr></site-plain></site-plain-tag><script>"<site-plain>"</script><p>no-tag</p>',
    );
  });

  test("gives an element with no content no children, and one with only space none", async () => {
    expect(await render("<site-box> </site-box>")).toBe(
      '<site-box><div data-props="page,pages,site"></div></site-box>',
    );
  });

  test("fails on an element that is never closed, naming the file", async () => {
    const error = await fails("<main><site-note>text</main>");
    expect(error.file).toBe(join(dir, "code/index.html"));
    expect(error.message).toBe(
      "<site-note> is never closed. Write </site-note> after its content, or <site-note /> if it has none.",
    );
    expect((await fails("<site-note><site-box>x</site-note>")).message).toMatch(
      /^<site-box> is never closed/,
    );
  });

  test("fails on an element that ends up inside itself, naming the chain and the file that wrote it", async () => {
    const error = await fails("<site-a></site-a>");
    expect(error.file).toBe(join(dir, "code/@site-b.html.js"));
    expect(error.message).toBe(
      "this writes <site-a>, which ends up inside itself: <site-a> → <site-b> → <site-a>. Remove one of them, or the element would never finish.",
    );
  });

  test("fails on content with no slot, and on two slots", async () => {
    markup("site-bare", "<p>No place.</p>");
    markup("site-twice", "<slot></slot><slot></slot>");
    expect((await fails("<site-bare>x</site-bare>")).message).toBe(
      "<site-bare> is given content, and this has no <slot></slot> for it. Write one where the content goes.",
    );
    expect(await render("<site-bare></site-bare>")).toBe("<site-bare><p>No place.</p></site-bare>");
    expect((await fails("<site-twice></site-twice>")).message).toMatch(/^this has 2 slots/);
  });

  test("fails on an attribute named like a prop, and on data that isn't there", async () => {
    expect((await fails('<site-box page="x"></site-box>')).message).toBe(
      "<site-box> has a page attribute, but every element already gets page, pages, site and children. Rename the attribute.",
    );
    expect((await fails('<site-card data="gone.json" />')).message).toBe(
      `<site-card> data="gone.json" isn't there.`,
    );
  });
});
