/** @prose
 * # Dev
 *
 * `vp dev`, for a site: every page, drafts included, rendered when it's asked for, by the same code
 * as `build` (`site.ts`), so a page can't look one way here and another in `dist/`. The site is
 * read again for every page, so a new or deleted file is a new or missing URL at once, with nothing
 * to restart. A change reloads the page, except to CSS, which Vite replaces in place. A mistake
 * shows in the browser as the message `build` would print, and the page reloads when it's fixed.
 *
 * The plugin hooks into Vite's own dev server, which is also the renderer's module runner.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin, ViteDevServer } from "vite-plus";
import { browserEntry, missingUrl } from "./bundle.ts";
import type { Used } from "./browser.ts";
import { NOT_FOUND, posix } from "./discover.ts";
import { SiteError, shownFrom, siteErrorText } from "./errors.ts";
import { addToHead, escape, withStyles } from "./head.ts";
import { inFrame } from "./render.ts";
import { redirectUrl } from "./redirects.ts";
import { readRun, renderPage, type Run } from "./site.ts";
import { inReal, partId, siteServer, type SiteServer } from "./vite.ts";
import { formatWarning, type MarkzWarning } from "./warnings.ts";

/** The dev server's half of the plugin. It does nothing in the server `build` renders with. */
export function devPlugin(): Plugin {
  // What each page's script loads: its elements' setups, from its last render.
  const rendered = new Map<string, Used[]>();
  const warned = new Set<string>();
  // A request that isn't a page after all reaches `notFound` with the site already read.
  const runs = new WeakMap<IncomingMessage, Run>();
  let server: SiteServer;
  let root = "";
  let logger: ViteDevServer["config"]["logger"];
  // Whether the last page asked for failed: then any change reloads, CSS too, to show the fix.
  let failing = false;

  const newWarnings = (warnings: MarkzWarning[]) => {
    for (const warning of warnings) {
      const line = formatWarning(warning, shownFrom(root));
      if (warned.has(line)) continue;
      warned.add(line);
      logger.warn(line);
    }
  };

  /** @prose
   * Every page request reads the site, then answers from it. A mistake anywhere in that is
   * answered with `build`'s message, as a page.
   */
  const withRun = async (
    request: IncomingMessage,
    response: ServerResponse,
    answer: (run: Run) => Promise<void> | void,
  ) => {
    try {
      const run = runs.get(request) ?? (await readRun(server, { dev: true }));
      runs.set(request, run);
      newWarnings(run.warnings);
      await answer(run);
      failing = false;
    } catch (error) {
      failing = true;
      const text = errorText(error, root);
      logger.error(text);
      send(response, 500, "text/html", errorPage(text));
    }
  };

  /** @prose
   * A page's document: rendered as `build` renders it, with its stylesheets linked from where they
   * are in `code/`, so Vite serves and replaces them, and with Vite's client and the page's own
   * script in place of the built script.
   */
  const page = async (run: Run, url: string): Promise<string | undefined> => {
    const found = run.pages.find((page) => page.url === url);
    if (!found) return undefined;
    const out = await renderPage(run, found);
    const styled = out.elements.filter((u) => u.style);
    const missing = missingUrl(root, [
      ...run.frame.styles.map((style) => ({ file: style.file })),
      ...styled.map((u) => ({ file: u.file, css: run.elements.get(u.tag)!.style!.text })),
    ]);
    if (missing) throw missing;
    rendered.set(
      url,
      out.elements.map((u) => ({ ...u, file: inReal(root, server.real, u.file) })),
    );
    const linked = withStyles(out.frame, (href) => `/${posix(root, join(root, "code", href))}`);
    const query = `?url=${encodeURIComponent(url)}`;
    const head = [
      ...styled.map(
        (u) => `<link rel="stylesheet" href="/${posix(root, partId(u.file, "style"))}" />`,
      ),
      '<script type="module" src="/@vite/client"></script>',
      `<script type="module" src="${SCRIPTS}page.js${query}"></script>`,
    ];
    return inFrame(addToHead(linked, head.join("\n")), out.body);
  };

  /** @prose
   * A page's own script in dev, which defines the page's elements with behavior, where `build`
   * writes one script for the site. Its stylesheets, its elements' CSS among them, are plain
   * links, which the browser waits for before it shows the page.
   */
  const script = (name: string, url: string): string | undefined =>
    name === "page.js" ? browserEntry(rendered.get(url) ?? []) : undefined;

  /** @prose
   * Pages first, before Vite's own middleware. `/about` redirects to `/about/`, as a static host
   * would, and a page's old URL to the page. Any other request that isn't a page is Vite's: a module, a file in `public/`. What nothing
   * serves gets the 404 page, with a 404 status.
   */
  const serve = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.method !== "GET" && request.method !== "HEAD") return next();
    const url = new URL(request.url ?? "/", "http://localhost");
    const path = pathOf(url);
    if (path.startsWith("/@") || path.startsWith("/__") || !looksLikePage(path)) return next();
    // An element file's part, which is a module, not a page.
    if (url.searchParams.has("sitez")) return next();
    return withRun(request, response, async (run) => {
      const target = path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path;
      const html = target === NOT_FOUND ? undefined : await page(run, target);
      if (html !== undefined) return send(response, 200, "text/html", html);
      if (!path.endsWith("/") && run.pages.some((page) => page.url === `${path}/`)) {
        response.writeHead(301, { location: `${url.pathname}/${url.search}` });
        return void response.end();
      }
      const moved = run.links.redirects.get(redirectUrl(path) ?? path);
      if (moved) {
        response.writeHead(301, { location: moved });
        return void response.end();
      }
      next();
    });
  };

  const notFound = (request: IncomingMessage, response: ServerResponse) =>
    withRun(request, response, async (run) => {
      const html = await page(run, NOT_FOUND);
      send(response, 404, "text/html", html ?? `Nothing at ${escape(request.url ?? "/")}`);
    });

  /** @prose
   * A change that isn't CSS reloads the page. Every server module is dropped, since any of them
   * can change any page's HTML, and so are the pages' scripts, since a page may now use an element
   * with behavior it didn't.
   */
  const reload = (vite: ViteDevServer) => {
    vite.environments.ssr.moduleGraph.invalidateAll();
    const client = vite.environments.client.moduleGraph;
    for (const [id, module] of client.idToModuleMap) {
      if (id.startsWith(`\0${SCRIPTS}`)) client.invalidateModule(module);
    }
    vite.ws.send({ type: "full-reload" });
  };

  return {
    name: "sitez:dev",
    resolveId: (id) => (id.startsWith(SCRIPTS) ? `\0${id}` : null),
    load(id) {
      if (!id.startsWith(`\0${SCRIPTS}`)) return null;
      const [name = "", query] = id.slice(SCRIPTS.length + 1).split("?");
      return script(name, new URLSearchParams(query).get("url") ?? "/");
    },
    configureServer(vite) {
      if (vite.config.plugins.some((plugin) => plugin.name === RENDER_ONLY)) return;
      server = siteServer(vite);
      root = server.root;
      logger = vite.config.logger;
      vite.middlewares.use((request, response, next) => void serve(request, response, next));
      vite.watcher.on("add", () => reload(vite));
      vite.watcher.on("unlink", () => reload(vite));
      return () => {
        vite.middlewares.use((request, response) => void notFound(request, response));
      };
    },
    // CSS is Vite's to replace, unless a page is failing. A custom element can't be defined twice,
    // so an element file reloads the page, its CSS too.
    hotUpdate({ file, server: vite }) {
      if (this.environment.name !== "client") return;
      if (file.endsWith(".css") && !failing) return;
      reload(vite);
      return [];
    },
  };
}

/** Marks the server `build` renders with, where the dev server's middleware has no place. */
export const RENDER_ONLY = "sitez:render-only";

// Where a page's scripts are served, by the plugin above.
const SCRIPTS = "/@sitez/";

/** A page's URL ends in `/` or `.html`, or has no extension: `/about` redirects. */
function looksLikePage(path: string): boolean {
  const last = path.slice(path.lastIndexOf("/") + 1);
  return last === "" || last.endsWith(".html") || !last.includes(".");
}

function send(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { "content-type": `${type}; charset=utf-8` });
  response.end(body);
}

/** @prose
 * A mistake in the site is shown as `build` prints it, `file: message`; anything else is a bug in
 * Sitez, shown with its stack. Vite's client is on the page, so it reloads once the file is fixed.
 */
function errorText(error: unknown, root: string): string {
  if (error instanceof SiteError) return siteErrorText(error, root);
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

function errorPage(text: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sitez: this page didn't build</title>
<script type="module" src="/@vite/client"></script>
</head>
<body>
<pre style="white-space: pre-wrap; font: 14px/1.5 ui-monospace, monospace; padding: 1rem">${escape(text)}</pre>
</body>
</html>
`;
}

/** A request's path as the files are named, or as sent when it isn't valid percent-encoding. */
function pathOf(url: URL): string {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return url.pathname;
  }
}
