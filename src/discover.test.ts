import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { discover, readElements, skipped } from "./discover.ts";
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
  test("gives every text file a URL from its path, and nothing in code/ one", () => {
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
      "/blog/hello/ text/blog/hello.md",
    ]);
  });

  test("skips anything under a dot or an underscore", () => {
    const root = site(
      "text/index.md",
      "text/.drafts/idea.md",
      "text/.DS_Store",
      "text/_ideas.md",
      "text/_old/about.md",
      "text/blog/_next.md",
      "code/@call-out.html.ts",
      "code/notes.txt",
      "data/talks.json",
    );
    expect(urls(root)).toEqual(["/ text/index.md"]);
  });

  test("knows a skipped path by a name starting with an underscore, wherever it is", () => {
    expect(skipped("/site/public", "/site/public/_headers")).toBe(true);
    expect(skipped("/site/public", "/site/public/a/_b/c.txt")).toBe(true);
    expect(skipped("/site/public", "/site/public/a_b.txt")).toBe(false);
    expect(skipped("/site/_public", "/site/_public/a.txt")).toBe(false);
  });

  test("fails on a file in text/ that isn't Markz, pointing to public/", () => {
    const root = site("text/index.md", "text/blog/photo.png");
    const error = catchError(() => discover(root));
    expect(relative(root, error.file)).toBe("text/blog/photo.png");
    expect(error.message).toBe(
      "text/ holds only Markz (.md), so this file wouldn't reach the site. Move it to public/blog/photo.png, and link to it from there.",
    );
  });

  test("points a JSON file in text/ to data/", () => {
    const error = catchError(() => discover(site("text/talks.json")));
    expect(error.message).toBe(
      "text/ holds only Markz (.md), so this file wouldn't reach the site. Move it to data/talks.json, and read it from an element with data.",
    );
  });

  test("works with no text/", () => {
    expect(urls(site("code/index.js"))).toEqual([]);
    expect(urls(site())).toEqual([]);
  });

  test("fails on two files for one URL, naming the second", () => {
    const root = site("text/blog.md", "text/blog/index.md");
    const error = catchError(() => discover(root));
    expect(relative(root, error.file)).toBe("text/blog/index.md");
    expect(error.message).toBe(
      "/blog/ also comes from text/blog.md. A URL has one file: rename or remove one of them.",
    );
  });

  test("fails on text/site.md, but not on a site.md deeper in text/", () => {
    const error = catchError(() => discover(site("text/site.md")));
    expect(error.message).toMatch(/^site\.md is reserved/);
    expect(urls(site("text/notes/site.md"))).toEqual(["/notes/site/ text/notes/site.md"]);
  });
});

describe("readElements", () => {
  const read = (root: string) =>
    [...readElements(root)]
      .toSorted(([a], [b]) => (a < b ? -1 : 1))
      .map(([tag, file]) => `${tag} ${relative(root, file)}`);

  test("finds each element's file by its name, in any folder", () => {
    const root = site(
      "code/@call-out.html",
      "code/blog/@tag-filter.html",
      "code/blog/archive/@chart-view-2d.html",
    );
    expect(read(root)).toEqual([
      "call-out code/@call-out.html",
      "chart-view-2d code/blog/archive/@chart-view-2d.html",
      "tag-filter code/blog/@tag-filter.html",
    ]);
  });

  test("leaves modules, other files, and anything under a dot or an underscore", () => {
    const root = site(
      "code/index.html",
      "code/style.css",
      "code/format.js",
      "code/Layout.js",
      "code/notes.txt",
      "code/.cache/@call-out.js",
      "code/_old/@call-out.js",
      "code/_old/@call-out.html.js",
      "code/@call-out.html",
    );
    expect(read(root)).toEqual(["call-out code/@call-out.html"]);
  });

  test.each(["@callout.html", "@Call-Out.html", "@-x.html", "@call-out-.html"])(
    "fails on an @ file that has no tag's name: %s",
    (name) => {
      const root = site(`code/${name}`);
      const error = catchError(() => readElements(root));
      expect(relative(root, error.file)).toBe(`code/${name}`);
      expect(error.message).toMatch(/^an @ file is an element's, named for its tag/);
    },
  );

  test("fails on a name HTML keeps", () => {
    expect(catchError(() => readElements(site("code/@font-face.html"))).message).toBe(
      "<font-face> is a name HTML keeps for its own elements. Rename the element.",
    );
  });

  test.each([
    ["@call-out", "An element is one file, @call-out.html. Rename it"],
    ["@call-out.js", "An element is one file, @call-out.html. Rename it"],
    ["@call-out.html.js", "so this goes into its <template>"],
    ["@call-out.html.ts", "so this goes into its <template>"],
    ["@call-out.browser.js", "so this becomes its top-level <script>"],
    ["@call-out.live.js", "so this becomes its top-level <script>"],
    ["@call-out.css", "so this becomes its top-level <style>"],
    ["@call-out.island.js", "An element is one file, @call-out.html. Rename it"],
  ])("fails on a name that isn't @name.html: %s", (name, message) => {
    const root = site(`code/blog/${name}`);
    const error = catchError(() => readElements(root));
    expect(relative(root, error.file)).toBe(`code/blog/${name}`);
    expect(error.message).toContain(message);
  });

  test.each(["+layout.js", "+layout.ts"])("fails on %s, which is the frame now", (name) => {
    const root = site(`code/blog/${name}`);
    const error = catchError(() => readElements(root));
    expect(relative(root, error.file)).toBe(`code/blog/${name}`);
    expect(error.message).toMatch(
      /^Sitez no longer reads a layout. The page's frame is code\/index.html/,
    );
  });

  test("fails on +style.css, which index.html links now", () => {
    const root = site("code/+style.css");
    expect(catchError(() => readElements(root)).message).toMatch(
      /^Sitez no longer reads \+style.css. Rename it style.css, and link it from code\/index.html/,
    );
  });

  test("lets any other + file be a module", () => {
    expect(read(site("code/+head.js", "code/+style.scss"))).toEqual([]);
  });

  test("fails on one element in two files, wherever they sit, naming the second", () => {
    const root = site("code/@call-out.html", "code/blog/@call-out.html");
    const error = catchError(() => readElements(root));
    expect(relative(root, error.file)).toBe("code/blog/@call-out.html");
    expect(error.message).toBe(
      "<call-out> is also in code/@call-out.html. Elements are global, so a name has one file wherever it sits. Remove one, or rename the element.",
    );
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
