/** @prose
 * # Build
 *
 * `vite build`, for a site: every page rendered to complete HTML in `dist/`, with a page at each
 * redirect, and `public/` copied beside them. The site is read once (`site.ts`), then pages render
 * concurrently, each awaiting its own data, and the stylesheets and the script for elements with
 * behavior are built from what they rendered. Nothing is written until everything has built.
 * Markz's warnings and the report print through Vite's logger.
 *
 * The plugin takes over in Vite's `buildApp` hook. The site's `code/index.html` is a frame with a
 * slot for each page, not a page for Vite to build. Pages render in a Vite server of its own, made
 * from the site's config file and with no listener or watcher, and the CSS and script are more
 * Vite builds from the same file. So a plugin of the site's applies to all of them. Vite's
 * environments could not run the site's modules where they are, since a build bundles modules
 * where a server runs them, and the plugin would have to name every element up front
 * (`docs/design.md#toolchain`).
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
import { script, stylesheets, type Files } from "./bundle.ts";
import { outputFile, skipped } from "./discover.ts";
import { SiteError, shownFrom, siteErrorText } from "./errors.ts";
import { RENDER_ONLY } from "./dev.ts";
import { addToHead, withStyles } from "./head.ts";
import { inFrame } from "./render.ts";
import { redirectFile } from "./redirects.ts";
import { readRun, renderPage, renderRedirect, type Rendered, type Run } from "./site.ts";
import { report } from "./report.ts";
import { inReal, siteServer } from "./vite.ts";
import { formatWarning, type MarkzWarning } from "./warnings.ts";
import pkg from "../package.json" with { type: "json" };

/** @prose
 * What a page costs, for the build report: bytes gzipped, as a browser receives them, and time to
 * render. `notes` is what the numbers can't show, such as the elements with behavior that make the
 * page load the site's script.
 */
export interface Built {
  url: string;
  file: string;
  /** Time to render the page, its frame included, in milliseconds. */
  ms: number;
  html: number;
  notes: string[];
}

export interface BuildResult {
  outDir: string;
  /** In URL order. */
  pages: Built[];
  /** What pages share, downloaded once: the stylesheets and the script, gzipped, and the hosts
   * the script loads libraries from. */
  common: { css: number; js: number; hosts: string[] };
  /** Every element with behavior a built page uses, by tag. */
  behavior: string[];
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
  let redirects: Rendered[];
  try {
    run = await readRun(server);
    rendered = await Promise.all(run.pages.map((page) => renderPage(run, page)));
    redirects = await Promise.all(
      [...run.links.redirects].map(([from, to]) => renderRedirect(run, from, to)),
    );
  } finally {
    await server.close();
  }
  const { warnings } = run;

  // The script holds every element with behavior a page uses. Then every page gets the
  // stylesheets its frame links and, if it has such an element, the script.
  const css = await stylesheets(server, run.frame.styles);
  const everyPage = [...rendered, ...redirects];
  const js = await script(
    server,
    everyPage.flatMap((page) =>
      page.browser.map((browser) => ({
        ...browser,
        file: inReal(root, server.real, browser.file),
      })),
    ),
  );
  const files: Files = new Map([...css.files, ...js.files]);
  const pagesBuilt: Built[] = [];
  for (const page of everyPage) {
    const linked = withStyles(page.frame, (href) => css.hrefs.get(href));
    const frame =
      page.browser.length > 0
        ? addToHead(linked, `<script type="module" src="${js.src}"></script>`)
        : linked;
    const html = inFrame(frame, page.body);
    const isRedirect = redirects.includes(page);
    files.set(isRedirect ? redirectFile(page.url) : outputFile(page.url), html);
    if (isRedirect) continue;
    pagesBuilt.push({
      url: page.url,
      file: page.file,
      ms: page.ms,
      html: gzipped(html),
      notes: [...page.browser.map((browser) => browser.tag), ...notes(html)],
    });
  }
  write(root, outDir, files);
  return {
    outDir,
    pages: pagesBuilt.toSorted((a, b) => (a.url < b.url ? -1 : 1)),
    common: {
      css: [...css.hrefs.values()]
        .filter((href, i, all) => all.indexOf(href) === i)
        .reduce((total, href) => total + gzipped(files.get(href.slice(1))!), 0),
      js: js.src ? gzipped(files.get(js.src.slice(1))!) : 0,
      hosts: js.hosts,
    },
    behavior: [
      ...new Set(everyPage.flatMap((page) => page.browser.map((browser) => browser.tag))),
    ].sort(),
    warnings,
    ms: performance.now() - start,
  };
}

function gzipped(content: string | Uint8Array): number {
  return gzipSync(content).length;
}

/** @prose
 * What a page's numbers leave out. A `<script>` Sitez didn't write, in a raw block or in
 * an element's or the frame's markup, runs whatever it loads, which the build can't count.
 */
function notes(html: string): string[] {
  return /<script\b/i.test(html) ? ["raw <script>"] : [];
}

/** @prose
 * `dist/` is Sitez's own, so it is emptied first. A file in `public/` where Sitez writes one of
 * its own (a page's HTML, a stylesheet or the script) would be overwritten without anyone
 * noticing, so it fails instead. A file or folder in `public/` whose name starts with `_` is
 * skipped, as it is in every folder.
 */
function write(root: string, outDir: string, files: Files): void {
  const publicDir = join(root, "public");
  for (const path of files.keys()) {
    const file = join(publicDir, path);
    if (existsSync(file) && !skipped(publicDir, file)) {
      throw new SiteError(
        file,
        `Sitez writes ${path.split(sep).join("/")} itself, from ${source(path)}. Rename or remove this file.`,
      );
    }
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  if (existsSync(publicDir)) {
    cpSync(publicDir, outDir, {
      recursive: true,
      filter: (path) => !skipped(publicDir, path),
    });
  }
  for (const [path, content] of files) {
    const file = join(outDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

function source(path: string): string {
  if (path.endsWith(".html")) return "a page or a page's redirects";
  return "the site's code";
}
