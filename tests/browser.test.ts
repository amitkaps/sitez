/** @prose
 * # Elements with behavior in a browser
 *
 * Built pages loaded into happy-dom with their own scripts. Each element with behavior sets itself up once
 * on the HTML the build wrote, keeps those nodes, and responds to a click. The snapshots show
 * what a page ships, and this shows that it works.
 */
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Window } from "happy-dom";
import { expect, test } from "vite-plus/test";
import { buildSite } from "./build.ts";

const blogOutDir = await built("blog");
const elementsOutDir = await built("elements");

test("the blog index's tag-filter filters on a click", async () => {
  expect(readdirSync(blogOutDir).filter((file) => file.endsWith(".js"))).toHaveLength(1);
  await inBrowser(blogOutDir, "blog/index.html", async (document) => {
    const element = document.querySelector("tag-filter")!;
    const visible = () =>
      [...element.querySelectorAll("li")]
        .filter((li) => !li.hidden)
        .map((li) => li.textContent!.trim().split(" ")[0]);
    expect(visible()).toEqual(["Again", "Hello"]);

    const start = [...element.querySelectorAll("button")].find((b) => b.textContent === "start")!;
    start.click();
    await Promise.resolve();
    expect(visible()).toEqual(["Hello"]);
    expect(start.getAttribute("aria-pressed")).toBe("true");
  });
});

test("a fold-out shows its text as the build wrote it", async () => {
  // Two pages use fold-out, and both load the site's one script.
  const src = (page: string) =>
    /<script type="module" src="([^"]+)">/.exec(
      readFileSync(join(elementsOutDir, page), "utf8"),
    )?.[1];
  expect(src("docs/index.html")).toBe(src("index.html"));
  await inBrowser(elementsOutDir, "index.html", async (document) => {
    const element = document.querySelector("fold-out")!;
    const button = element.querySelector("button")!;
    const text = element.querySelector("div")!;
    const term = text.querySelector("dfn")!;
    expect(text.hidden).toBe(true);
    button.click();
    await Promise.resolve();
    expect(text.hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    // The text is the build's nodes, not a copy the script made.
    expect(element.querySelector("div")).toBe(text);
    expect(text.querySelector("dfn")).toBe(term);
  });
});

test("a page with no element that has behavior loads no script", () => {
  expect(readFileSync(join(blogOutDir, "about/index.html"), "utf8")).not.toContain("<script");
});

async function built(site: string): Promise<string> {
  const outDir = join(mkdtempSync(join(tmpdir(), "sitez-")), "dist");
  await buildSite(join(import.meta.dirname, "sites", site), outDir);
  return outDir;
}

/** @prose
 * Loads a built page into happy-dom and runs its script from `dist/`, as a browser would, with the
 * DOM as globals for the custom elements. Setting up must keep the build's nodes, and a second
 * `define` of a tag must not run `setup` again.
 */
async function inBrowser(
  outDir: string,
  page: string,
  check: (document: Document) => Promise<void>,
): Promise<void> {
  const html = readFileSync(join(outDir, page), "utf8");
  const script = /<script type="module" src="\/([^"]+)"><\/script>/.exec(html)?.[1];
  expect(script).toMatch(/\.[\w-]+\.js$/);

  const window = new Window({ url: `https://example.com/${page.replace(/index\.html$/, "")}` });
  const added = Object.getOwnPropertyNames(window).filter((key) => !(key in globalThis));
  const globals = globalThis as Record<string, unknown>;
  for (const key of added) globals[key] = (window as unknown as Record<string, unknown>)[key];
  try {
    window.document.write(html);
    const document = window.document as unknown as Document;
    const element = [...document.querySelectorAll("*")].find((el) => el.localName.includes("-"))!;
    const first = element.firstElementChild;
    await import(pathToFileURL(join(outDir, script!)).href);
    expect(element.firstElementChild).toBe(first);
    await check(document);
  } finally {
    for (const key of added) delete globals[key];
    await window.happyDOM.close();
  }
}
