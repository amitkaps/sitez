/** @prose
 * # Build
 *
 * `vite build`, for a site: every page rendered to complete HTML in `dist/`, with the sitemap, the
 * feed and a page at each redirect, and `public/` copied beside them. The site is read once
 * (`site.ts`), then pages render concurrently, each awaiting its own data, and the stylesheet and
 * the live elements' script are built from what they rendered. Nothing is written until everything
 * has built. Markz's warnings and the report print through Vite's logger.
 *
 * The plugin takes over in Vite's `buildApp` hook, since a site has no `index.html` for Vite to
 * build from. Pages render in a Vite server of its own, made from the site's config file and with
 * no listener or watcher, and the CSS and script are two more Vite builds from the same file. So a
 * plugin of the site's applies to all three. Vite's environments could not run the site's modules
 * where they are, since a build bundles modules where a server runs them, and the plugin would
 * have to name every layout and component up front (`docs/design.md#toolchain`).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { relative } from "node:path";
import { gzipSync } from "node:zlib";
import { createServer, type Plugin, type ResolvedConfig } from "vite";
import { script, stylesheet, type Files } from "./bundle.ts";
import { outputFile } from "./discover.ts";
import { SiteError, shownFrom, siteErrorText } from "./errors.ts";
import { RENDER_ONLY } from "./dev.ts";
import { document } from "./render.ts";
import { redirectFile, redirectPage } from "./redirects.ts";
import { readRun, renderPage, type Rendered, type Run } from "./site.ts";
import { feed, sitemap } from "./sitemap.ts";
import { report } from "./report.ts";
import { inReal, siteServer } from "./vite.ts";
import { formatWarning, type MarkzWarning } from "./warnings.ts";
import pkg from "../package.json" with { type: "json" };

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

/** @prose
 * The plugin's half of `vite build`. It writes `dist/`, or whatever `build.outDir` says, and marks
 * Vite's own environments built, so Vite doesn't go looking for an `index.html`. A mistake in the
 * site stops the build with its message, `file: message`, as Vite prints an error's stack.
 */
export function buildPlugin(): Plugin {
  return {
    name: "sitez:build",
    async buildApp(builder) {
      const { config } = builder;
      try {
        const result = await build(config);
        for (const warning of result.warnings) {
          config.logger.warn(formatWarning(warning, shownFrom(config.root)));
        }
        config.logger.info(
          report(result, relative(config.root, result.outDir) || ".", pkg.version),
        );
      } catch (error) {
        if (error instanceof SiteError) error.stack = siteErrorText(error, config.root);
        throw error;
      }
      for (const environment of Object.values(builder.environments)) environment.isBuilt = true;
    },
    configurePreviewServer(preview) {
      const outDir = resolve(preview.config.root, preview.config.build.outDir);
      return () =>
        preview.middlewares.use((request, response, next) =>
          asAHost(outDir, request, response, next),
        );
    },
  };
}

/** @prose
 * What `vite preview` leaves to a static host's rules, after Vite has served the files that are
 * there and mapped `/about/` to its `index.html`. A folder asked for without its slash redirects
 * to it, and anything else that isn't there gets `404.html` with a 404 status, as GitHub Pages
 * and Cloudflare do. Nothing is rendered: it's the files `build` wrote, and only them.
 */
function asAHost(
  outDir: string,
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): void {
  const url = new URL(request.url ?? "/", "http://localhost");
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    path = url.pathname;
  }
  const file = join(outDir, path);
  // A path that climbs out of dist/ is nothing a host would serve.
  const inside = file === outDir || file.startsWith(outDir + sep);
  const stat = inside ? statSync(file, { throwIfNoEntry: false }) : undefined;
  if (stat?.isFile()) return next();
  if (stat?.isDirectory() && !path.endsWith("/")) {
    response.writeHead(301, { location: `${url.pathname}/${url.search}` });
    return void response.end();
  }
  const missing = join(outDir, "404.html");
  if (!existsSync(missing)) return next();
  response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  response.end(request.method === "HEAD" ? undefined : readFileSync(missing));
}

/** The site's build, from the config Vite resolved. */
export async function build(config: ResolvedConfig): Promise<BuildResult> {
  const start = performance.now();
  const outDir = resolve(config.root, config.build.outDir);
  const root = config.root;
  const server = siteServer(
    await createServer({
      configFile: config.configFile,
      configLoader: config.inlineConfig.configLoader,
      root,
      logLevel: "silent",
      appType: "custom",
      // Only the server render runs here, and nothing in it needs pre-bundling.
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false, watch: null },
      plugins: [{ name: RENDER_ONLY }],
    }),
  );
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
  const css = await stylesheet(server);
  const js = await script(
    server,
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
