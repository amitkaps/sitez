import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { SiteError } from "./errors.ts";
import { findRoot } from "./root.ts";

const sites = join(import.meta.dirname, "../tests/sites");

describe("findRoot", () => {
  test("is the folder holding site.md", () => {
    expect(findRoot(join(sites, "blog"))).toBe(join(sites, "blog"));
  });

  test("is found from any folder inside the site", () => {
    expect(findRoot(join(sites, "blog/text/blog"))).toBe(join(sites, "blog"));
    expect(findRoot(join(sites, "blog/code"))).toBe(join(sites, "blog"));
  });

  test("works for a site with no text/", () => {
    expect(findRoot(join(sites, "landing/code"))).toBe(join(sites, "landing"));
  });

  test("fails with no site.md anywhere above, showing what to write", () => {
    const empty = mkdtempSync(join(tmpdir(), "sitez-"));
    const error = catchError(() => findRoot(empty));
    expect(error.file).toBe(empty);
    expect(error.message).toMatch(/^no site\.md here or in any folder above/);
    expect(error.message).toContain("name: My site");
  });

  test("fails on text/site.md, found from inside text/", () => {
    const site = join(sites, "error-reserved-site-md");
    const error = catchError(() => findRoot(join(site, "text")));
    expect(error.file).toBe(join(site, "text/site.md"));
    const expected = readFileSync(join(site, "error.txt"), "utf8").trim();
    expect(`text/site.md: ${error.message}`).toBe(expected);
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
