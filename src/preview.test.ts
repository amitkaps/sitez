import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { build } from "./build.ts";
import { SiteError } from "./errors.ts";
import { preview, type Preview } from "./preview.ts";

const blog = join(import.meta.dirname, "../tests/sites/blog");
const outDir = join(mkdtempSync(join(tmpdir(), "sitez-preview-")), "dist");
let server: Preview;

beforeAll(async () => {
  await build(blog, { outDir });
  mkdirSync(join(outDir, "博客"));
  writeFileSync(join(outDir, "博客", "index.html"), "<title>博客</title>");
  server = await preview(blog, { port: 0, outDir });
});
afterAll(() => server.close());

const get = (path: string) => fetch(new URL(path, server.url), { redirect: "manual" });

test("a folder's URL serves its index.html", async () => {
  const response = await get("/blog/");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await response.text()).toContain("<tag-filter>");
});

test("a folder without its slash redirects, as a host would", async () => {
  const response = await get("/blog");
  expect(response.status).toBe(301);
  expect(response.headers.get("location")).toBe("/blog/");
});

test("a folder with a non-Latin name redirects with its URL encoded", async () => {
  const response = await get("/博客");
  expect(response.status).toBe(301);
  expect(response.headers.get("location")).toBe("/%E5%8D%9A%E5%AE%A2/");
  expect((await get("/博客/")).status).toBe(200);
});

test("a file is served with its type", async () => {
  const response = await get("/feed.xml");
  expect(response.headers.get("content-type")).toBe("application/xml");
});

test("what isn't there gets 404.html, with a 404", async () => {
  for (const path of ["/nothing/", "/blog/draft/", "/../package.json"]) {
    const response = await get(path);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("<title>");
  }
});

test("there has to be a build to preview", async () => {
  const empty = mkdtempSync(join(tmpdir(), "sitez-preview-"));
  const error = await preview(empty, { port: 0 }).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(SiteError);
  expect((error as SiteError).message).toBe(
    "there's no dist/ to preview yet. Run sitez build first.",
  );
});
