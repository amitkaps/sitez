/** @prose
 * # Elements in HTML
 *
 * What an element does in a frame and in another element's output, which is what it does in text.
 * Elements render innermost first, their content goes in their slot or its fallback shows, and what
 * an element writes is read for elements too. Each failure names the file that wrote the tag. The
 * host here imports each template module from a data URL, where Sitez loads it through Vite.
 */
import { describe, expect, test } from "vite-plus/test";
import { renderElements, type Host } from "./elements.ts";
import { FileError } from "./errors.ts";
import { readElement, templateModule, type ElementFile } from "./file.ts";

const scope = ["page"];
const elements = new Map<string, ElementFile>();
function element(name: string, source: string) {
  elements.set(name, readElement(`/site/code/@${name}.html`, scope, source));
}

element("site-note", "<template><aside><b>Note</b><slot></slot></aside></template>");
element("site-plain", "<template><hr></template>");
element("site-empty", "<template><p><slot>Nothing yet.</slot></p></template>");
element(
  "site-box",
  "<template><div data-attrs=${Object.keys(attrs).join()} data-url=${page.url}><slot></slot></div></template>",
);
element(
  "site-card",
  "<template>\n<script>\nexport const count = (rows) => rows?.length ?? 0;\n</script>\n<h2>${attrs.title}</h2><site-note>${count(attrs.data)} rows</site-note>\n</template>",
);
element("site-a", "<template><site-b></site-b></template>");
element("site-b", "<template><site-a></site-a></template>");
element("site-bare", "<template><p>No place.</p></template>");
element("site-twice", "<template><slot></slot>${html`<slot></slot>`}</template>");
element("site-wait", "<template>${Promise.resolve(1)}</template>");
element("site-only", "<script>export default () => {};</script>");

/** A template module, imported as it is from a data URL. */
const evaluate = (element: ElementFile): Promise<Record<string, unknown>> =>
  import(`data:text/javascript,${encodeURIComponent(templateModule(element, scope))}`);

const host: Host = {
  elements,
  load: evaluate,
  data: (path) =>
    path === "rows.json" ? { value: [1, 2, 3] } : { problem: `data="${path}" isn't there.` },
  context: { page: { url: "/about/" } },
};
const render = (source: string) => renderElements(host, source, "/site/code/index.html", []);
const fails = async (source: string) => {
  try {
    await render(source);
  } catch (error) {
    if (error instanceof FileError) return error;
    throw error;
  }
  throw new Error("expected a FileError");
};

describe("renderElements", () => {
  test("writes an element around what its template writes, with its attributes", async () => {
    expect(await render('<main><site-plain class="x" hidden></site-plain></main>')).toBe(
      '<main><site-plain class="x" hidden><hr></site-plain></main>',
    );
  });

  test("puts an element's content where its slot is, and its template gets attrs and the host's context", async () => {
    expect(
      await render('<site-note><site-box id="b" page="p"><em>hi</em></site-box></site-note>'),
    ).toBe(
      '<site-note><aside><b>Note</b><site-box id="b" page="p"><div data-attrs="id,page" data-url="/about/"><em>hi</em></div></site-box></aside></site-note>',
    );
  });

  test("shows a slot's fallback only when the element has no content", async () => {
    expect(await render("<site-empty></site-empty>")).toBe(
      "<site-empty><p>Nothing yet.</p></site-empty>",
    );
    expect(await render("<site-empty>Done.</site-empty>")).toBe(
      "<site-empty><p>Done.</p></site-empty>",
    );
  });

  test("renders what an element writes, with its data parsed, for the elements in it", async () => {
    expect(await render('<site-card title="Cards" data="rows.json" />')).toBe(
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
        '<!-- <site-plain></site-plain> --><site-plain-tag><site-plain></site-plain></site-plain-tag><script>"<site-plain>"</script>',
      ),
    ).toBe(
      '<!-- <site-plain></site-plain> --><site-plain-tag><site-plain><hr></site-plain></site-plain-tag><script>"<site-plain>"</script>',
    );
  });

  test("writes the content of an element with no template as it is", async () => {
    expect(await render("<site-only><b>x</b></site-only>")).toBe("<site-only><b>x</b></site-only>");
  });

  test("fails on an element that is never closed, naming the file", async () => {
    const error = await fails("<main><site-note>text</main>");
    expect(error.file).toBe("/site/code/index.html");
    expect(error.message).toBe(
      "<site-note> is never closed. Write </site-note> after its content, or <site-note /> if it has none.",
    );
  });

  test("fails on an element that ends up inside itself, naming the chain and the file that wrote it", async () => {
    const error = await fails("<site-a></site-a>");
    expect(error.file).toBe("/site/code/@site-b.html");
    expect(error.message).toBe(
      "this writes <site-a>, which ends up inside itself: <site-a> → <site-b> → <site-a>. Remove one of them, or the element would never finish.",
    );
  });

  test("fails on content with no slot, on two slots, and on a promise", async () => {
    expect((await fails("<site-bare>x</site-bare>")).message).toBe(
      "<site-bare> is given content, and its template has no <slot></slot> for it. Write one where the content goes.",
    );
    expect(await render("<site-bare></site-bare>")).toBe("<site-bare><p>No place.</p></site-bare>");
    expect((await fails("<site-twice></site-twice>")).message).toMatch(/writes 2 slots/);
    const error = await fails("<site-wait></site-wait>");
    expect(error.file).toBe("/site/code/@site-wait.html");
    expect(error.message).toMatch(/^a template holds a promise/);
  });

  test("fails on data that isn't there", async () => {
    expect((await fails('<site-card data="gone.json" />')).message).toBe(
      `<site-card> data="gone.json" isn't there.`,
    );
  });
});
