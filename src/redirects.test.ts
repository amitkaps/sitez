/** @prose
 * # Redirects
 *
 * Which old URLs a page can list, and the failures that name the page listing one. The page Sitez
 * writes at each is in the example blog's snapshots.
 */
import { describe, expect, test } from "vite-plus/test";
import type { PageData } from "./metadata.ts";
import { readRedirects, redirectFile, redirectUrl } from "./redirects.ts";

const page = (name: string, url: string, redirects?: PageData["redirects"]) => ({
  file: `/site/text/${name}.md`,
  data: { url, redirects } as PageData,
});

describe("redirectUrl", () => {
  test("reads a path as the URL a host serves, a page's or an old .html", () => {
    expect(redirectUrl("/old")).toBe("/old/");
    expect(redirectUrl("/old/")).toBe("/old/");
    expect(redirectUrl("/old.html")).toBe("/old.html");
  });

  test("has none for what a page can't stand in for", () => {
    for (const path of ["old/", "//cdn/x", "/feed.rss", "/a?b", "https://x.com/old/"]) {
      expect(redirectUrl(path)).toBeUndefined();
    }
  });

  test("writes each to its file", () => {
    expect(redirectFile("/old/")).toBe("old/index.html");
    expect(redirectFile("/a/old.html")).toBe("a/old.html");
  });
});

describe("readRedirects", () => {
  const read = (pages: ReturnType<typeof page>[], listing = pages) =>
    readRedirects("/site", pages, listing);

  test("maps each old URL to the page listing it, as text or a list", () => {
    const pages = [
      page("essays/sculptor", "/essays/sculptor/", ["/sculptor", "/sculptor.html"]),
      page("about", "/about/", "/me/"),
    ];
    expect([...read(pages)]).toEqual([
      ["/sculptor/", "/essays/sculptor/"],
      ["/sculptor.html", "/essays/sculptor/"],
      ["/me/", "/about/"],
    ]);
  });

  test("writes only the redirects of pages this run writes", () => {
    const draft = page("draft", "/draft/", ["/soon/"]);
    expect(read([draft], []).size).toBe(0);
  });

  test("fails on a URL a page has, naming both files", () => {
    const pages = [page("index", "/"), page("about", "/about/", ["/", "/about/index.html"])];
    expect(() => read(pages)).toThrow("redirects lists /: that's the URL of text/index.md.");
    expect(() => read([page("about", "/about/", ["/about"])])).toThrow(
      "redirects lists /about: that's this page's own URL.",
    );
    expect(() => read([page("about", "/about/", ["/about/index.html"])])).toThrow(
      "redirects lists /about/index.html: that's this page's own URL.",
    );
  });

  test("fails on an old .html that a host also serves where a page is", () => {
    expect(() => read([page("about", "/about/", ["/about.html"])])).toThrow(
      "redirects lists /about.html: a host serves about.html at /about too, so the redirect page would stand in front of this page. Remove it.",
    );
    const pages = [page("blog/index", "/blog/"), page("posts", "/posts/", ["/blog.html"])];
    expect(() => read(pages)).toThrow(
      "redirects lists /blog.html: a host serves blog.html at /blog too, which reaches text/blog/index.md.",
    );
  });

  test("fails on a draft's URL, which dev serves", () => {
    const pages = [page("draft", "/draft/"), page("about", "/about/", ["/draft/"])];
    expect(() => read(pages, [pages[1]!])).toThrow("that's the URL of text/draft.md.");
  });

  test("fails on one URL listed twice, or one no host could redirect", () => {
    const pages = [page("a", "/a/", ["/old/"]), page("b", "/b/", ["/old/index.html"])];
    expect(() => read(pages)).toThrow(
      "redirects lists /old/index.html: text/a.md lists it too. Keep one.",
    );
    expect(() => read([page("a", "/a/", ["old"])])).toThrow(
      "redirects lists old: write each old URL as a path on this site",
    );
  });
});
