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
  test("defaults the title to the first heading and the summary to the first paragraph", () => {
    const doc = parse("# Hello _there_\n\nThe first `post`.\n\nMore.\n");
    expect(textMetadata(file, "/hello/", doc)).toEqual({
      url: "/hello/",
      title: "Hello there",
      summary: "The first post.",
    });
  });

  test("keeps what the block says, and every other key", () => {
    const doc = parse(
      "---\ntitle: Short\nsummary: Brief.\ndate: 2026-09-01\ndraft: true\ntags: [a, b]\n---\n\n# Long title\n\nText.\n",
    );
    expect(textMetadata(file, "/x/", doc)).toEqual({
      url: "/x/",
      title: "Short",
      summary: "Brief.",
      date: "2026-09-01",
      draft: true,
      tags: ["a", "b"],
    });
  });

  test("looks only at the top level, where a reader starts", () => {
    const doc = parse("> # Quoted\n>\n> Quoted text.\n\n## Real\n\nReal text.\n");
    expect(textMetadata(file, "/x/", doc)).toMatchObject({ title: "Real", summary: "Real text." });
  });

  test("leaves out what the page has none of", () => {
    const page = textMetadata(file, "/x/", parse("- a list\n"));
    expect(page.title).toBeUndefined();
    expect(page.summary).toBeUndefined();
  });
});

describe("the keys Sitez reads", () => {
  test.each([
    ["draft: yes", 'draft is "yes": write draft: true or draft: false.'],
    ["draft: 1", "draft is 1: write draft: true or draft: false."],
    ["title: 2026", "title is 2026: write it as text."],
    ["title:", "title is null: leave the line out, or give it a value."],
    ["summary: [a, b]", 'summary is ["a","b"]: write it as text.'],
    ["date: Sept 1", 'date is "Sept 1": write a date as 2026-09-29.'],
    ["date: 2026-02-30", 'date is "2026-02-30": write a date as 2026-09-29.'],
    [
      "url: /about/",
      "url is \"/about/\": a page's URL is its file's path: move the file instead, and remove url.",
    ],
  ])("fail when wrong in a page: %s", (line, message) => {
    expect(problem(() => textMetadata(file, "/x/", block(line)))).toBe(message);
  });

  test("pass when right, and leave other keys alone", () => {
    const page = textMetadata(
      file,
      "/x/",
      block("title: T\nsummary: S\ndate: 2024-02-29\ndraft: false\ntags: [a]\norder: 3\nimage:"),
    );
    expect(page).toMatchObject({ draft: false, date: "2024-02-29", order: 3, image: null });
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

  test("is the block, and only the block", () => {
    expect(site("name: Notes\nurl: https://notes.example.com\nlang: hi")).toEqual({
      name: "Notes",
      url: "https://notes.example.com",
      lang: "hi",
    });
  });

  test("is in English unless it says otherwise", () => {
    expect(site("name: Notes")).toEqual({ lang: "en", name: "Notes" });
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
    ["name: 42", "site.md: name is 42: write it as text."],
  ])("fails on %s", (line, message) => {
    expect(site(line)).toBe(message);
  });
});
