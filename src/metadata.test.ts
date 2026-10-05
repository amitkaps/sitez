import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";
import { describe, expect, test } from "vite-plus/test";
import { SiteError } from "./errors.ts";
import { textMetadata, siteMetadata } from "./metadata.ts";

const file = "/site/text/page.md";

function problem(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof SiteError && error.file === file) return error.message;
    throw error;
  }
  return "no error";
}

const block = (lines: string) => parse(`---\n${lines}\n---\n\n# Heading\n`);

describe("textMetadata", () => {
  test("is the block and the URL, and fills in nothing from the text", () => {
    const doc = parse("# Hello _there_\n\nThe first `post`.\n\nMore.\n");
    expect(textMetadata(file, "/hello/", doc)).toEqual({ url: "/hello/" });
  });

  test("keeps what the block says, and every other key, date included", () => {
    const doc = parse(
      "---\ntitle: Short\ndescription: Brief.\ndate: 2026-09-01\ndraft: true\ntags: [a, b]\n---\n\n# Long title\n\nText.\n",
    );
    expect(textMetadata(file, "/x/", doc)).toEqual({
      url: "/x/",
      title: "Short",
      description: "Brief.",
      date: "2026-09-01",
      draft: true,
      tags: ["a", "b"],
    });
  });

  test("passes summary through as the site's own key", () => {
    expect(textMetadata(file, "/x/", block("summary: Brief."))).toEqual({
      url: "/x/",
      summary: "Brief.",
    });
  });
});

describe("the keys Sitez reads", () => {
  test.each([
    ["draft: yes", 'draft is "yes": write draft: true or draft: false.'],
    ["draft: 1", "draft is 1: write draft: true or draft: false."],
    ["title: 2026", "title is 2026: write it as text."],
    ["title:", "title is null: leave the line out, or give it a value."],
    ["description: [a, b]", 'description is ["a","b"]: write it as text.'],
    [
      "url: /about/",
      "url is \"/about/\": a page's URL is its file's path: move the file instead, and remove url.",
    ],
    [
      "redirects: 3",
      "redirects is 3: write the URLs that used to reach this page, such as redirects: [/old-name/].",
    ],
  ])("fail when wrong in a page: %s", (line, message) => {
    expect(problem(() => textMetadata(file, "/x/", block(line)))).toBe(message);
  });

  test("pass when right, and leave other keys alone", () => {
    const page = textMetadata(
      file,
      "/x/",
      block("title: T\ndescription: S\ndate: Sept 1\ndraft: false\ntags: [a]\norder: 3\nimage:"),
    );
    expect(page).toMatchObject({ draft: false, date: "Sept 1", order: 3, image: null });
  });
});

describe("siteMetadata", () => {
  function site(lines: string) {
    const root = mkdtempSync(join(tmpdir(), "sitez-"));
    writeFileSync(join(root, "site.md"), `---\n${lines}\n---\n\nNotes.\n`);
    try {
      return siteMetadata(root);
    } catch (error) {
      if (error instanceof SiteError)
        return `${error.file.slice(root.length + 1)}: ${error.message}`;
      throw error;
    }
  }

  test("is the block, and only the block, with no defaults", () => {
    expect(site("name: Notes\nurl: https://notes.example.com\nlang: hi\nauthor: Me")).toEqual({
      name: "Notes",
      url: "https://notes.example.com",
      lang: "hi",
      author: "Me",
    });
    expect(site("name: 42")).toEqual({ name: 42 });
  });

  test.each([
    [
      "url: notes.example.com",
      'site.md: url is "notes.example.com": write the full address, starting https://.',
    ],
    [
      "repo: amitkaps/notes",
      'site.md: repo is "amitkaps/notes": write the full address, starting https://.',
    ],
  ])("fails on %s", (line, message) => {
    expect(site(line)).toBe(message);
  });
});
