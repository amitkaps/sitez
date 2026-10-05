/** @prose
 * # Vite, for Sitez
 *
 * What the plugin's parts share: the link from a site's files to Vite's module runner, and the
 * naming of a site's files in Vite's errors. Pages render through the runner, so the site's modules
 * run from where they are and `import.meta.url` still points at them. The Markz site's Quality
 * page reads its test cases relative to its own file. A site's imports resolve as Node's do, from
 * its own `node_modules`.
 */
import { realpathSync } from "node:fs";
import { join, sep } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { SiteError } from "./errors.ts";
import { posix } from "./discover.ts";
import pkg from "../package.json" with { type: "json" };

/** The name Sitez is published under, which a site's code imports. */
export const PACKAGE = pkg.name;

export interface SiteServer {
  vite: ViteDevServer;
  /** The site's root, as Vite names it and every message names files from. */
  root: string;
  /** The site's root as Vite names its modules: its real path. */
  real: string;
  /** @prose
   * Imports a site file (absolute path) through the module runner. It's `ssrLoadModule`, not the
   * SSR environment's own runner: that one keeps what it has run until a hot update reaches it,
   * so a page asked for right after a change can render the old code, where `ssrLoadModule`
   * checks Vite's module graph on every import.
   */
  load(file: string): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

/** @prose
 * A Vite server as the site's renderer. Vite names modules by their real path, so a site reached
 * through a symlink (macOS's `/var` is `/private/var`) is served from its real path, and an error
 * names the file by the path Vite was given the root as, as every other message does.
 */
export function siteServer(vite: ViteDevServer): SiteServer {
  const root = vite.config.root;
  const real = realpathSync(root);
  return {
    vite,
    root,
    real,
    load: async (file) => {
      try {
        return await vite.ssrLoadModule(`/${posix(root, file)}`);
      } catch (error) {
        throw siteError(error, file, root, real);
      }
    },
    close: () => vite.close(),
  };
}

/** @prose
 * A file that doesn't compile, or a module that throws as it loads, is a mistake in the site.
 * Vite's error says which file (`id`) and shows the lines around it (`frame`); without an `id`,
 * it's the file being loaded. An import `browserBoundary` refuses is already a `SiteError`.
 */
export function siteError(error: unknown, file: string, root: string, real: string): SiteError {
  // A plugin's own SiteError, which Rolldown wraps in a list. The module runner copies one into
  // a plain object with a `frame`, which is read as Vite's error below.
  const own = [error, ...((error as { errors?: unknown[] }).errors ?? [])].find(
    (item) => item instanceof SiteError,
  );
  if (own) return own as SiteError;
  const { message, id, frame } = error as { message?: string; id?: string; frame?: string };
  return new SiteError(
    asGiven(root, real, id?.split("?")[0] ?? file),
    `${message ?? String(error)}${frame ? `\n\n${frame}` : ""}`,
    { cause: error },
  );
}

/** A file Vite names by its real path, named by the root Vite was given, as messages are. */
export function asGiven(root: string, real: string, file: string): string {
  return file.startsWith(real + sep) ? root + file.slice(real.length) : file;
}

/** A path in the site's real folder, which is how Vite names the site's modules. */
export function inReal(root: string, real: string, file: string): string {
  return join(real, file.slice(root.length));
}

const BROWSER = /\.browser\.[jt]s$/;
const MARKUP = /(?:^|\/)@[^/]+\.html(?:\.[jt]s)?$/;
const FRAME = /(?:^|\/)index\.html$/;

/** @prose
 * Fails an import that crosses the line, in whichever environment makes it. In the server render,
 * that's an import of a `.browser.js` file. In what the browser loads, it's an import of an
 * element's markup file or `sitez` itself, from a `.browser.js` file or from anything it imports.
 * `sitez`'s `html` would make a template record in the browser, not nodes. The specifier is read
 * as written, which is how the site names its own files.
 */
export function browserBoundary(): Plugin {
  return {
    name: "sitez:browser-boundary",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer || importer.startsWith("\0")) return null;
      const { root } = this.environment.config;
      const path = id.split("?")[0]!;
      const from = asGiven(root, realpathSync(root), importer.split("?")[0]!);
      if (this.environment.name === "ssr" && BROWSER.test(path)) {
        throw new SiteError(
          from,
          `this imports ${id}, a .browser.js file, which runs only in the browser and would crash the build. Move what both need into a module in code/.`,
        );
      }
      if (this.environment.name === "client" && id === PACKAGE) {
        throw new SiteError(
          from,
          `this imports ${id}, whose html renders at build time. A .browser.js file works on the page's DOM, with no import from Sitez, or loads a library by its full URL.`,
        );
      }
      if (this.environment.name === "client" && !BROWSER.test(path)) {
        const what = MARKUP.test(path)
          ? "an element's markup"
          : FRAME.test(path)
            ? "the frame"
            : undefined;
        if (what) {
          throw new SiteError(
            from,
            `this imports ${id}, ${what}, which is written at build time. A .browser.js file enhances HTML the build wrote, so it can't use it. Move what both need into a module in code/.`,
          );
        }
      }
      return null;
    },
  };
}
