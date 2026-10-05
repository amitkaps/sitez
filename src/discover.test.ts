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
      .map(([tag, files]) => [
        tag,
        files.markup && `${files.markup.kind} ${relative(root, files.markup.file)}`,
        files.browser && relative(root, files.browser),
      ]);

  test("finds an element's markup and behavior by its name, in any folder", () => {
    const root = site(
      "code/@call-out.html",
      "code/@card-grid.html.ts",
      "code/@card-grid.browser.js",
      "code/blog/@tag-filter.html.js",
      "code/blog/archive/@chart-view-2d.browser.ts",
    );
    expect(read(root)).toEqual([
      ["call-out", "html code/@call-out.html", undefined],
      ["card-grid", "js code/@card-grid.html.ts", "code/@card-grid.browser.js"],
      ["chart-view-2d", undefined, "code/blog/archive/@chart-view-2d.browser.ts"],
      ["tag-filter", "js code/blog/@tag-filter.html.js", undefined],
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
    expect(read(root)).toEqual([["call-out", "html code/@call-out.html", undefined]]);
  });

  test.each(["@callout.html.js", "@Call-Out.html", "@-x.html", "@call-out-.html"])(
    "fails on an @ file that has no tag's name: %s",
    (name) => {
      const root = site(`code/${name}`);
      const error = catchError(() => readElements(root));
      expect(relative(root, error.file)).toBe(`code/${name}`);
      expect(error.message).toMatch(/^an @ file is an element's, named for its tag/);
    },
  );

  test.each([
    ["@call-out", "an element's files are @call-out.html"],
    ["@call-out.js", "a name must say when the file runs. Rename it @call-out.html.js"],
    ["@call-out.ts", "a name must say when the file runs. Rename it @call-out.html.js"],
    ["@call-out.live.js", ".live.js is now .browser.js"],
    [
      "@call-out.css",
      "an element's files are @call-out.html, @call-out.html.js and @call-out.browser.js",
    ],
    ["@call-out.island.js", "an element's files are"],
  ])("fails on a name that doesn't say when it runs: %s", (name, message) => {
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

  test("fails on one element's markup in two files, wherever they sit, naming the second", () => {
    for (const other of [
      "code/blog/@call-out.html.js",
      "code/@call-out.html",
      "code/@call-out.html.ts",
    ]) {
      const root = site("code/@call-out.html.js", other);
      const error = catchError(() => readElements(root));
      expect(error.message).toMatch(/^<call-out>'s markup is also in /);
      expect(error.message).toContain(
        "a name has one markup file, @call-out.html or @call-out.html.js",
      );
    }
    const root = site("code/@call-out.html.js", "code/blog/@call-out.html.js");
    const error = catchError(() => readElements(root));
    expect(relative(root, error.file)).toBe("code/blog/@call-out.html.js");
    expect(error.message).toContain("is also in code/@call-out.html.js.");
  });

  test("fails on one element's behavior in two files", () => {
    const root = site("code/@tag-filter.browser.js", "code/blog/@tag-filter.browser.ts");
    const error = catchError(() => readElements(root));
    expect(relative(root, error.file)).toBe("code/blog/@tag-filter.browser.ts");
    expect(error.message).toMatch(
      /^<tag-filter>'s behavior is also in code\/@tag-filter.browser.js/,
    );
  });

  test("lets an element's markup and behavior sit in different folders", () => {
    expect(read(site("code/@tag-filter.html.js", "code/blog/@tag-filter.browser.js"))).toEqual([
      ["tag-filter", "js code/@tag-filter.html.js", "code/blog/@tag-filter.browser.js"],
    ]);
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
