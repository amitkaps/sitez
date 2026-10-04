import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { checkCode, discover, nearest } from "./discover.ts";
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

  test("skips other files, and anything under a dot", () => {
    const root = site(
      "text/index.md",
      "text/.drafts/idea.md",
      "text/.DS_Store",
      "code/+layout.js",
      "code/@call-out.ts",
      "code/notes.txt",
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

  test("points a JSON file in text/ to data/", () => {
    const error = catchError(() => discover(site("text/talks.json")));
    expect(error.message).toBe(
      "text/ holds only Markz (.md), so this file wouldn't reach the site. Move it to data/talks.json, and read it from a component with data.",
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

describe("checkCode", () => {
  test("accepts elements, the files read by name, and modules", () => {
    const root = site(
      "code/+layout.js",
      "code/+layout.ts",
      "code/+style.css",
      "code/@call-out.js",
      "code/@call-out.live.js",
      "code/blog/@chart-view-2d.ts",
      "code/blog/+layout.js",
      "code/format.js",
      "code/_old.js",
      "code/Layout.js",
      "code/.cache/+oops.js",
    );
    expect(() => checkCode(root)).not.toThrow();
  });

  test.each(["@callout.js", "@Call-Out.js", "@call-out.css", "@call-out.island.js", "@-x.js"])(
    "fails on an @ file that isn't an element's: %s",
    (name) => {
      const root = site(`code/${name}`);
      const error = catchError(() => checkCode(root));
      expect(relative(root, error.file)).toBe(`code/${name}`);
      expect(error.message).toMatch(/^an @ file renders an element/);
    },
  );

  test.each(["+layuot.js", "+head.js", "+style.scss", "+layout.live.js"])(
    "fails on a + file Sitez doesn't read: %s",
    (name) => {
      const root = site(`code/blog/${name}`);
      const error = catchError(() => checkCode(root));
      expect(relative(root, error.file)).toBe(`code/blog/${name}`);
      expect(error.message).toMatch(
        /^Sitez reads \+layout\.js and \+style\.css and no other \+ file/,
      );
    },
  );

  test("fails on a +style.css below code/", () => {
    const root = site("code/+style.css", "code/blog/+style.css");
    const error = catchError(() => checkCode(root));
    expect(relative(root, error.file)).toBe("code/blog/+style.css");
    expect(error.message).toMatch(/^a site has one stylesheet/);
  });
});

describe("nearest", () => {
  const root = site("code/+layout.js", "code/blog/+layout.ts", "code/blog/@call-out.live.js");
  const found = (url: string, name = "+layout") => relative(root, nearest(root, url, name) ?? root);

  test("is the nearest .js or .ts of the name up the tree from the URL", () => {
    expect(found("/")).toBe("code/+layout.js");
    expect(found("/about/")).toBe("code/+layout.js");
    expect(found("/blog/")).toBe("code/blog/+layout.ts");
    expect(found("/blog/2026/hello/")).toBe("code/blog/+layout.ts");
    expect(found("/blogroll/")).toBe("code/+layout.js");
  });

  test("finds an element's live file as it finds its component", () => {
    expect(found("/blog/hello/", "@call-out.live")).toBe("code/blog/@call-out.live.js");
    expect(nearest(root, "/about/", "@call-out.live")).toBeUndefined();
  });

  test("fails on a .js and a .ts of one name", () => {
    const both = site("code/+layout.js", "code/+layout.ts");
    const error = catchError(() => nearest(both, "/", "+layout"));
    expect(relative(both, error.file)).toBe("code/+layout.ts");
    expect(error.message).toBe("+layout.js is beside it, and a name has one file. Remove one.");
  });

  test("is none when the site has no layout", () => {
    expect(nearest(site("text/index.md"), "/", "+layout")).toBeUndefined();
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
