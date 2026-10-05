/** @prose
 * # Rendering an element's module
 *
 * What the build does with a module's default export, and where a page goes in its frame. Each
 * failure names the file.
 */
import { describe, expect, test } from "vite-plus/test";
import { SLOT } from "./head.ts";
import { inFrame, renderModule } from "./render.ts";
import { html } from "./runtime/html.ts";

const props = { page: { url: "/" }, pages: [], site: {} };

describe("renderModule", () => {
  test("renders the default export's template, trimmed", async () => {
    const page = { default: ({ page }: typeof props) => html` <p>${page.url}</p> ` };
    expect(await renderModule("code/@card.html.js", page, props)).toBe("<p>/</p>");
  });

  test("fails on a module with no default export to call", async () => {
    await expect(renderModule("code/@card.html.js", { metadata: {} }, props)).rejects.toThrow(
      "this element has no default export to render.",
    );
  });

  test("fails on a template the renderer refuses, in its words", async () => {
    const page = { default: () => html`<button onclick=${() => {}}>x</button>` };
    await expect(renderModule("code/@card.html.js", page, props)).rejects.toThrow(
      /^a template holds a function/,
    );
  });
});

test("the page goes where the frame keeps its place, as it is", () => {
  expect(inFrame(`<main>${SLOT}</main>`, "<h1>$&</h1>")).toBe("<main><h1>$&</h1></main>");
});
