/** @prose
 * # Build
 *
 * `sitez build`: every page rendered to complete HTML in `dist/`, with the sitemap, the feed and
 * a page at each redirect, and `public/` copied beside them. The site is read once (`site.ts`), then pages render
 * concurrently, each awaiting its own data, and the stylesheet and the live elements' script are
 * built from what they rendered. Nothing is written until everything has built. Markz's warnings are
 * returned for the command to print, with what each page costs for the report.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { script, stylesheet, type Files } from "./bundle.ts";
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
 * render. `notes` is what the numbers can't show, such as the live elements that make the page
 * load the site's script.
 */
export interface Built {
  url: string;
  file: string;
  /** Time to render the page, layout included, in milliseconds. */
  ms: number;
  html: number;
  notes: string[];
}

export interface BuildResult {
  outDir: string;
  /** In URL order. */
  pages: Built[];
  /** What pages share, downloaded once: the stylesheet and the script, gzipped, and the hosts
   * the script loads libraries from. */
  common: { css: number; js: number; hosts: string[] };
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

  // The site's script holds every live element a page uses; then every page gets the
  // stylesheet and, if it has a live element, the script.
  const css = await stylesheet(root, server.real);
  const js = await script(
    root,
    server.real,
    rendered.flatMap((page) =>
      page.live.map((live) => ({ ...live, file: inReal(root, server.real, live.file) })),
    ),
  );
  const files: Files = new Map([...css.files, ...js.files]);
  const pagesBuilt: Built[] = [];
  for (const page of rendered) {
    const { tags, head, body } = page.parts;
    const assets = [`<link rel="stylesheet" href="${css.href}">`];
    if (page.live.length > 0) assets.push(`<script type="module" src="${js.src}"></script>`);
    const html = document(site, [tags, ...assets].join("\n"), head, body);
    files.set(outputFile(page.url), html);
    pagesBuilt.push({
      url: page.url,
      file: page.file,
      ms: page.ms,
      html: gzipped(html),
      notes: [...page.live.map((live) => live.tag), ...notes(head + body)],
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
      js: js.src ? gzipped(files.get(js.src.slice(1))!) : 0,
      hosts: js.hosts,
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
 * code's markup, runs whatever it loads, which the build can't count.
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

function source(path: string): string {
  if (path.endsWith(".html")) return "a page or a page's redirects";
  if (path.endsWith(".xml")) return "the metadata";
  return "code/";
}
