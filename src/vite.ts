/** @prose
 * # Vite
 *
 * The Vite server Sitez runs for a site, with the config nobody writes. `build` and `dev` render
 * pages the same way, through its module runner, so the site's modules run from where they are
 * and `import.meta.url` still points at them: the Markz site's Quality page reads its test cases
 * relative to its own file. A site has no `node_modules`, so its imports resolve from Sitez.
 */
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, sep } from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { SiteError } from "./errors.ts";
import { posix } from "./discover.ts";
import { PACKAGE } from "./root.ts";

/** Sitez's own files a site's pages and bundles load: the reset, and the `@amitkaps/sitez` import. */
export const runtime = join(import.meta.dirname, "runtime");

export interface SiteServer {
  vite: ViteDevServer;
  /** The site's root, as the site was given and every message names it. */
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
 * For `build`, a server with no HTTP listener and no watcher, only for rendering. For `dev`, the
 * same server listening on `port`, watching the site and hot-replacing what the browser loads,
 * with `dev.ts`'s plugin serving the pages.
 *
 * Vite names modules by their real path, so a site reached through a symlink (macOS's `/var` is
 * `/private/var`) is served from its real path, and an error names the file by the path the
 * site was given, as every other message does.
 */
export async function siteServer(
  root: string,
  dev?: { port: number; plugin: Plugin },
): Promise<SiteServer> {
  const real = realpathSync(root);
  const vite = await createServer({
    configFile: false,
    root: real,
    cacheDir: cacheDir(real),
    logLevel: "silent",
    appType: "custom",
    // A site's modules import Sitez's runtime from outside the site's folder.
    server: dev
      ? { port: dev.port, host: "localhost", fs: { strict: false } }
      : { middlewareMode: true, hmr: false, watch: null },
    // A site that installs Sitez would otherwise load its own copy, past `fromSitez`.
    ssr: { noExternal: [PACKAGE] },
    plugins: [liveBoundary(root, real), fromSitez(), noOptimizer(), ...(dev ? [dev.plugin] : [])],
  });
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
 * Vite keeps a cache in `node_modules/.vite` of the nearest package, which
 * for a site with none may be a folder that isn't the site's. Sitez keeps it in the system's temp
 * folder instead, one per site, so a site's folder only ever gets `dist/`.
 */
export function cacheDir(real: string): string {
  return join(tmpdir(), "sitez", createHash("sha256").update(real).digest("hex").slice(0, 12));
}

/** @prose
 * A file that doesn't compile, or a module that throws as it loads, is a mistake in the site.
 * Vite's error says which file (`id`) and shows the lines around it (`frame`); without an `id`,
 * it's the file being loaded. An import `liveBoundary` refuses is already a `SiteError`.
 */
export function siteError(error: unknown, file: string, root: string, real: string): SiteError {
  // A plugin's own SiteError, which Vite hands on as it is and Rolldown wraps in a list.
  const own = [error, ...((error as { errors?: unknown[] }).errors ?? [])].find(
    (item) => item instanceof SiteError,
  );
  if (own) return own;
  const { message, id, frame } = error as { message?: string; id?: string; frame?: string };
  return new SiteError(
    asGiven(root, real, id?.split("?")[0] ?? file),
    `${message ?? String(error)}${frame ? `\n\n${frame}` : ""}`,
    { cause: error },
  );
}

/** A file Vite names by its real path, named by the root the site was given, as messages are. */
export function asGiven(root: string, real: string, file: string): string {
  return file.startsWith(real + sep) ? root + file.slice(real.length) : file;
}

/** @prose
 * Bare imports from a site's files resolve from the site first, so a site with its own
 * `package.json` gets its own libraries, then as if imported from inside Sitez, which is where
 * Sitez's own dependencies are for a site without one.
 *
 * `@amitkaps/sitez` itself is the one exception. It is always the runtime of the Sitez that is running, even
 * when the site installs another version. Its templates go to this Sitez's renderer, which
 * has to agree with them. Sitez runs from `src/` in development, so the extension is this file's
 * own.
 */
export function fromSitez(): Plugin {
  const inside = import.meta.filename;
  return {
    name: "sitez:resolve",
    enforce: "pre",
    async resolveId(id, importer, options) {
      if (id === PACKAGE) return join(runtime, "index" + extname(inside));
      if (!/^[@a-z]/.test(id)) return null;
      const own = await this.resolve(id, importer, { ...options, skipSelf: true });
      return own ?? this.resolve(id, inside, { ...options, skipSelf: true });
    },
  };
}

/** @prose
 * Vite's dependency optimizer resolves from the site root, where there are no packages. Sitez's
 * dependencies are ESM and need no pre-bundling, so the lists are cleared, and `dev` doesn't
 * discover more: it would write its cache into a `node_modules` the site doesn't have.
 */
export function noOptimizer(): Plugin {
  return {
    name: "sitez:no-optimizer",
    configResolved(config) {
      for (const options of [
        config.optimizeDeps,
        ...Object.values(config.environments).map((environment) => environment.optimizeDeps),
      ]) {
        options.include = [];
        options.noDiscovery = true;
      }
    },
  };
}

const LIVE = /\.live\.[jt]s$/;
const COMPONENT = /(?:^|\/)@[^/]+\.[jt]s$/;
const LAYOUT = /(?:^|\/)\+layout\.[jt]s$/;

/** @prose
 * Fails an import that crosses the line, in whichever environment makes it. In the server render,
 * that's an import of a `.live` file. In what the browser loads, it's an import of a component, a
 * layout or `sitez` itself, from a `.live` file or from anything it imports. `sitez`'s `html`
 * would make a template record in the browser, not nodes. The specifier is read as written,
 * which is how the site names its own files. It runs before `fromSitez`, which would resolve
 * `sitez` first.
 */
export function liveBoundary(root: string, real: string): Plugin {
  return {
    name: "sitez:live-boundary",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer || importer.startsWith("\0")) return null;
      const path = id.split("?")[0]!;
      const from = asGiven(root, real, importer.split("?")[0]!);
      if (this.environment.name === "ssr" && LIVE.test(path)) {
        throw new SiteError(
          from,
          `this imports ${id}, a live file, which runs only in the browser and would crash the build. Move what both need into a module in code/.`,
        );
      }
      if (this.environment.name === "client" && id === PACKAGE) {
        throw new SiteError(
          from,
          `this imports ${id}, whose html renders at build time. A live file works on the page's DOM, with no import from Sitez, or loads a library by its full URL.`,
        );
      }
      if (this.environment.name === "client" && !LIVE.test(path)) {
        const what = COMPONENT.test(path) ? "component" : LAYOUT.test(path) ? "layout" : undefined;
        if (what) {
          throw new SiteError(
            from,
            `this imports ${id}, a ${what}, which renders at build time. A live file enhances HTML the build wrote, so it can't use one. Move what both need into a module in code/.`,
          );
        }
      }
      return null;
    },
  };
}

/** A path in the site's real folder, which is how Vite names the site's modules. */
export function inReal(root: string, real: string, file: string): string {
  return join(real, file.slice(root.length));
}
