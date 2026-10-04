import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { discover, nearest } from "./discover.ts";
import { SiteError } from "./errors.ts";

/** A site from a list of paths; every file gets the same few bytes. */
function site(...paths: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "sitez-"));
  for (const path of ["site.md", ...paths]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), "# x\n");
  }
  return root;
}

function urls(root: string) {
  return discover(root).map((page) => `${page.url} ${relative(root, page.file)}`);
}

describe("discover", () => {
  test("gives every text file and lowercase JS or TS file a URL from its path", () => {
    const root = site(
      "text/index.md",
      "text/about.md",
      "text/blog/index.md",
      "text/blog/hello.md",
      "code/tags.js",
      "code/blog/archive.ts",
    );
    expect(urls(root)).toEqual([
      "/ text/index.md",
      "/about/ text/about.md",
      "/blog/ text/blog/index.md",
      "/blog/archive/ code/blog/archive.ts",
      "/blog/hello/ text/blog/hello.md",
      "/tags/ code/tags.js",
    ]);
  });

  test("skips layouts, components, modules, islands, other files and anything under a dot", () => {
    const root = site(
      "text/index.md",
      "text/.drafts/idea.md",
      "text/.DS_Store",
      "code/Layout.js",
      "code/CallOut.ts",
      "code/_data.ts",
      "code/_card.js",
      "code/blog/_list.js",
      "code/tag-filter.island.js",
      "code/types.d.ts",
      "code/style.css",
      "code/page.svelte",
      "code/.cache/page.js",
      "data/talks.json",
    );
    expect(urls(root)).toEqual(["/ text/index.md"]);
  });

  test("fails on a file in text/ that isn't Markz, pointing to public/", () => {
    const root = site("text/index.md", "text/blog/photo.png");
    const error = catchError(() => discover(root));
    expect(relative(root, error.file)).toBe("text/blog/photo.png");
    expect(error.message).toBe(
      "text/ holds only Markz (.md), so this file wouldn't reach the site. Move it to public/blog/photo.png, and link to it from there.",
    );
  });

  test("works with no text/ or no code/", () => {
    expect(urls(site("code/index.js"))).toEqual(["/ code/index.js"]);
    expect(urls(site())).toEqual([]);
  });

  test.each([
    ["text/about.md", "code/about.js", "/about/"],
    ["text/blog.md", "text/blog/index.md", "/blog/"],
    ["text/index.md", "code/index.ts", "/"],
  ])("fails on two files for one URL: %s and %s", (first, second, url) => {
    const root = site(first, second);
    const error = catchError(() => discover(root));
    expect(relative(root, error.file)).toBe(second);
    expect(error.message).toBe(
      `${url} also comes from ${first}. A URL has one file: rename or remove one of them.`,
    );
  });

  test("fails on text/site.md, but not on a site.md deeper in text/", () => {
    const error = catchError(() => discover(site("text/site.md")));
    expect(error.message).toMatch(/^site\.md is reserved/);
    expect(urls(site("text/notes/site.md"))).toEqual(["/notes/site/ text/notes/site.md"]);
  });
});

describe("nearest", () => {
  const root = site("code/Layout.js", "code/blog/Layout.ts");
  const layout = (url: string) => relative(root, nearest(root, url, "Layout") ?? root);

  test("is the nearest Layout.js or Layout.ts up the tree from the URL", () => {
    expect(layout("/")).toBe("code/Layout.js");
    expect(layout("/about/")).toBe("code/Layout.js");
    expect(layout("/blog/")).toBe("code/blog/Layout.ts");
    expect(layout("/blog/2026/hello/")).toBe("code/blog/Layout.ts");
    expect(layout("/blogroll/")).toBe("code/Layout.js");
  });

  test("fails on a .js and a .ts of one name", () => {
    const both = site("code/Layout.js", "code/Layout.ts");
    const error = catchError(() => nearest(both, "/", "Layout"));
    expect(relative(both, error.file)).toBe("code/Layout.ts");
    expect(error.message).toBe("Layout.js is beside it, and a name has one file. Remove one.");
  });

  test("is none when the site has no layout", () => {
    expect(nearest(site("text/index.md"), "/", "Layout")).toBeUndefined();
  });
});

function catchError(fn: () => unknown): SiteError {
  try {
    fn();
  } catch (error) {
    if (error instanceof SiteError) return error;
    throw error;
  }
  throw new Error("expected a SiteError");
}
