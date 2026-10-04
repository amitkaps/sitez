/** @prose
 * # Rendering pages and layouts
 *
 * What the build does with a module's default export, and a layout's `head`: where a layout's
 * `children` go, and the modules it refuses, each failure naming the file.
 */
import { describe, expect, test } from "vite-plus/test";
import { renderHead, renderLayout, renderModule } from "./render.ts";
import { html } from "./runtime/html.ts";

const props = { page: { url: "/" }, pages: [], site: {} };

describe("renderModule", () => {
  test("renders the default export's template, trimmed", async () => {
    const page = { default: ({ page }: typeof props) => html` <p>${page.url}</p> ` };
    expect(await renderModule("code/@card.js", page, props)).toBe("<p>/</p>");
  });

  test("fails on a module with no default export to call", async () => {
    await expect(renderModule("code/@card.js", { metadata: {} }, props)).rejects.toThrow(
      "this component has no default export to render.",
    );
  });

  test("fails on a template the renderer refuses, in its words", async () => {
    const page = { default: () => html`<button onclick=${() => {}}>x</button>` };
    await expect(renderModule("code/@card.js", page, props)).rejects.toThrow(
      /^a template holds a function/,
    );
  });
});

describe("renderLayout", () => {
  const layout = (times: number) => ({
    default: ({ children }: { children: unknown }) =>
      html`<main>${Array.from({ length: times }, () => children)}</main>`,
  });

  test("puts the page's HTML where the layout writes its children", async () => {
    expect(await renderLayout("code/+layout.js", layout(1), props, "<h1>$&</h1>")).toBe(
      "<main><h1>$&</h1></main>",
    );
  });

  test.each([
    [0, "this layout doesn't render its page. Write ${children} where / goes."],
    [2, "this layout renders its page 2 times. Keep one ${children}."],
  ])("fails when it renders its children %i times", async (times, message) => {
    await expect(renderLayout("code/+layout.js", layout(times), props, "x")).rejects.toThrow(
      message,
    );
  });
});

describe("renderHead", () => {
  const link = html`<link rel="icon" href="/favicon.svg" />`;

  test("renders the layout's head export, trimmed", async () => {
    const layout = {
      head: ({ page }: typeof props) => html` <meta name="p" content=${page.url} /> `,
    };
    expect(await renderHead("code/+layout.js", layout, props)).toBe(
      '<meta name="p" content="/" />',
    );
  });

  test("adds nothing for a layout with no head", async () => {
    expect(await renderHead("code/+layout.js", { default: () => link }, props)).toBe("");
  });

  test("fails on a head that isn't a function", async () => {
    await expect(renderHead("code/+layout.js", { head: link }, props)).rejects.toThrow(
      "head is exported but isn't a function.",
    );
  });

  test("fails on a tag Sitez writes from metadata", async () => {
    const layout = { head: () => html`<title>Mine</title>` };
    await expect(renderHead("code/+layout.js", layout, props)).rejects.toThrow(
      "this writes a <title>, but Sitez writes it from metadata.",
    );
  });
});
