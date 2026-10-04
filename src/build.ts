/** @prose
 * # Build
 *
 * `sitez build`: every page rendered to complete HTML in `dist/`, with the sitemap, the feed and
 * a page at each redirect, and `public/` copied beside them. The site is read once (`site.ts`), then pages render
 * concurrently, each awaiting its own data, and the stylesheet and the live elements' scripts are
 * built
 * from what they rendered. Nothing is written until everything has built. Markz's warnings are
 * returned for the command to print, with what each page costs for the report.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { scripts, stylesheet, type Files } from "./bundle.ts";
import { outputFile } from "./discover.ts";
import { SiteError } from "./errors.ts";
import { document } from "./render.ts";
import { redirectFile, redirectPage } from "./redirects.ts";
import { readRun, renderPage, type Rendered, type Run } from "./site.ts";
import { feed, sitemap } from "./sitemap.ts";
import { inReal, siteServer } from "./vite.ts";
import type { MarkzWarning } from "./warnings.ts";

/** @prose
 * What a page costs, for the build report: bytes gzipped, as a browser receives them, and time to
 * render. `js` is only what this page loads and no other does; `notes` is what the numbers can't
 * show.
 */
export interface Built {
  url: string;
  file: string;
  /** Time to render the page, layout included, in milliseconds. */
  ms: number;
  html: number;
  js: number;
  notes: string[];
}

export interface BuildResult {
  outDir: string;
  /** In URL order. */
  pages: Built[];
  /** What every page shares, downloaded once: the stylesheet and `common.js`, gzipped. */
  common: { css: number; js: number };
  /** Every live element a built page uses, by tag. */
  live: string[];
  /** Markz's, from `site.md` and every page built, in URL order. */
  warnings: MarkzWarning[];
  ms: number;
}

/** `outDir` is for tests; a site always builds to its own `dist/`. */
export async function build(
  root: string,
  { outDir = join(root, "dist") } = {},
): Promise<BuildResult> {
  const start = performance.now();
  const server = await siteServer(root);
  let run: Run;
  let rendered: Rendered[];
  try {
    run = await readRun(server);
    rendered = await Promise.all(run.pages.map((page) => renderPage(run, page)));
  } finally {
    await server.close();
  }
  const { site, warnings } = run;

  // A page's script imports exactly the live files it uses; then every page gets the
  // stylesheet and, if it has any, its script.
  const used = new Map(
    rendered
      .filter((page) => page.live.length > 0)
      .map((page) => [
        entryName(page.url),
        page.live.map((live) => inReal(root, server.real, live.file)),
      ]),
  );
  const css = await stylesheet(root, server.real);
  const js = await scripts(root, server.real, used);
  const files: Files = new Map([...css.files, ...js.files]);
  const pagesBuilt: Built[] = [];
  for (const page of rendered) {
    const { tags, head, body } = page.parts;
    const assets = [`<link rel="stylesheet" href="${css.href}">`];
    const script = js.pages.get(entryName(page.url));
    if (script) assets.push(script.tags);
    const html = document(site, [tags, ...assets].join("\n"), head, body);
    files.set(outputFile(page.url), html);
    pagesBuilt.push({
      url: page.url,
      file: page.file,
      ms: page.ms,
      html: gzipped(html),
      js: (script?.own ?? []).reduce((sum, file) => sum + gzipped(files.get(file)!), 0),
      notes: [...notes(head + body), ...(script?.hosts ?? []).map((host) => `loads ${host}`)],
    });
  }
  const all = rendered.map((page) => page.data);
  files.set("sitemap.xml", sitemap(site.url, all));
  const rss = feed(site, site.url, all);
  if (rss) files.set("feed.xml", rss);
  for (const [from, to] of run.links.redirects) {
    files.set(redirectFile(from), redirectPage(site.url, to));
  }
  write(root, outDir, files);
  return {
    outDir,
    pages: pagesBuilt.toSorted((a, b) => (a.url < b.url ? -1 : 1)),
    common: {
      css: gzipped(files.get(css.href.slice(1))!),
      js: js.common ? gzipped(files.get(js.common)!) : 0,
    },
    live: [...new Set(rendered.flatMap((page) => page.live.map((live) => live.tag)))].sort(),
    warnings,
    ms: performance.now() - start,
  };
}

function gzipped(content: string | Uint8Array): number {
  return gzipSync(content).length;
}

/** @prose
 * What a page's numbers leave out. A `<script>` Sitez didn't write, in a raw block or in
 * code's markup, runs whatever it loads, which the build can't count. A library a live element
 * loads by URL is noted by its host, where the page's script is built.
 */
function notes(html: string): string[] {
  return /<script\b/i.test(html) ? ["raw <script>"] : [];
}

/** @prose
 * `dist/` is Sitez's own, so it is emptied first. A file in `public/` where Sitez writes one of
 * its own (a page's HTML, the sitemap, the feed) would be overwritten without anyone noticing, so
 * it fails instead.
 */
function write(root: string, outDir: string, files: Files): void {
  const publicDir = join(root, "public");
  for (const path of files.keys()) {
    const file = join(publicDir, path);
    if (existsSync(file)) {
      throw new SiteError(
        file,
        `Sitez writes ${path.split(sep).join("/")} itself, from ${source(path)}. Rename or remove this file.`,
      );
    }
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  if (existsSync(publicDir)) cpSync(publicDir, outDir, { recursive: true });
  for (const [path, content] of files) {
    const file = join(outDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

/** A page's script is named for its HTML file: `blog/index` for `blog/index.html`. */
function entryName(url: string): string {
  return outputFile(url)
    .split(sep)
    .join("/")
    .replace(/\.html$/, "");
}

function source(path: string): string {
  if (path.endsWith(".html")) return "a page or a page's redirects";
  if (path.endsWith(".xml")) return "the metadata";
  return "code/";
}
