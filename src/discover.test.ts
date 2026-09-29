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
  test("gives every prose file and lowercase Svelte file a URL from its path", () => {
    const root = site(
      "prose/index.md",
      "prose/about.md",
      "prose/blog/index.md",
      "prose/blog/hello.md",
      "pattern/tags.svelte",
      "pattern/blog/archive.svelte",
    );
    expect(urls(root)).toEqual([
      "/ prose/index.md",
      "/about/ prose/about.md",
      "/blog/ prose/blog/index.md",
      "/blog/archive/ pattern/blog/archive.svelte",
      "/blog/hello/ prose/blog/hello.md",
      "/tags/ pattern/tags.svelte",
    ]);
  });

  test("skips patterns, modules, other files and anything under a dot", () => {
    const root = site(
      "prose/index.md",
      "prose/notes.txt",
      "prose/.drafts/idea.md",
      "pattern/Layout.svelte",
      "pattern/CallOut.svelte",
      "pattern/data.ts",
      "pattern/.cache/page.svelte",
    );
    expect(urls(root)).toEqual(["/ prose/index.md"]);
  });

  test("works with no prose/ or no pattern/", () => {
    expect(urls(site("pattern/index.svelte"))).toEqual(["/ pattern/index.svelte"]);
    expect(urls(site())).toEqual([]);
  });

  test.each([
    ["prose/about.md", "pattern/about.svelte", "/about/"],
    ["prose/blog.md", "prose/blog/index.md", "/blog/"],
    ["prose/index.md", "pattern/index.svelte", "/"],
  ])("fails on two files for one URL: %s and %s", (first, second, url) => {
    const root = site(first, second);
    const error = catchError(() => discover(root));
    expect(relative(root, error.file)).toBe(second);
    expect(error.message).toBe(
      `${url} also comes from ${first}. A URL has one file: rename or remove one of them.`,
    );
  });

  test("fails on prose/site.md, but not on a site.md deeper in prose/", () => {
    const error = catchError(() => discover(site("prose/site.md")));
    expect(error.message).toMatch(/^site\.md is reserved/);
    expect(urls(site("prose/notes/site.md"))).toEqual(["/notes/site/ prose/notes/site.md"]);
  });
});

describe("nearest", () => {
  const root = site("pattern/Layout.svelte", "pattern/blog/Layout.svelte");
  const layout = (url: string) => relative(root, nearest(root, url, "Layout") ?? root);

  test("is the nearest Layout.svelte up the tree from the URL", () => {
    expect(layout("/")).toBe("pattern/Layout.svelte");
    expect(layout("/about/")).toBe("pattern/Layout.svelte");
    expect(layout("/blog/")).toBe("pattern/blog/Layout.svelte");
    expect(layout("/blog/2026/hello/")).toBe("pattern/blog/Layout.svelte");
    expect(layout("/blogroll/")).toBe("pattern/Layout.svelte");
  });

  test("is none when the site has no layout", () => {
    expect(nearest(site("prose/index.md"), "/", "Layout")).toBeUndefined();
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
