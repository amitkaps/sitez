import { expect, test } from "vite-plus/test";
import type { BuildResult } from "./build.ts";
import { report, size, time } from "./report.ts";

const page = { file: "", notes: [] as string[] };

test("a page per row, sorted as given, then common and the total", () => {
  const result: BuildResult = {
    outDir: "/site/dist",
    pages: [
      { ...page, url: "/", html: 4096, js: 0, ms: 12.4 },
      { ...page, url: "/blog/", html: 6200, js: 5120, ms: 20 },
      { ...page, url: "/quality/", html: 92_000, js: 14_500, ms: 1234, notes: ["raw <script>"] },
    ],
    common: { css: 3072, js: 12_400 },
    live: ["quality-report", "tag-filter"],
    warnings: [],
    ms: 1812,
  };
  expect(report(result, "dist", "0.2.0")).toBe(
    [
      "page         html      js   time",
      "/          4.0 KB       —  12 ms",
      "/blog/     6.1 KB  5.0 KB  20 ms",
      "/quality/   90 KB   14 KB  1.2 s  raw <script>",
      "common     3.0 KB css, 12 KB js",
      "3 pages in 1.8 s → dist · live: quality-report, tag-filter · sitez 0.2.0",
    ].join("\n"),
  );
});

test("a site with no live elements has no common js and none listed", () => {
  const result: BuildResult = {
    outDir: "/site/dist",
    pages: [{ ...page, url: "/", html: 900, js: 0, ms: 3 }],
    common: { css: 700, js: 0 },
    live: [],
    warnings: [],
    ms: 40,
  };
  expect(report(result, "dist", "0.2.0").split("\n").slice(-2)).toEqual([
    "common  0.7 KB css",
    "1 page in 40 ms → dist · sitez 0.2.0",
  ]);
});

test("sizes and times", () => {
  expect([size(512), size(10 * 1024), size(123_456)]).toEqual(["0.5 KB", "10 KB", "121 KB"]);
  expect([time(0.4), time(999), time(1000), time(61_000)]).toEqual([
    "0 ms",
    "999 ms",
    "1.0 s",
    "61.0 s",
  ]);
});
