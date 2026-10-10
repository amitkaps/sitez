/** @prose
 * # Vite, for Sitez
 *
 * What the plugin's parts share: the link from a site's files to Vite's module runner, an element
 * file's parts as modules, and the naming of a site's files in Vite's errors. Pages render through the runner, so the site's modules
 * run from where they are and `import.meta.url` still points at them. The Markz site's Quality
 * page reads its test cases relative to its own file. A site's imports resolve as Node's do, from
 * its own `node_modules`.
 */
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";
import type { Plugin, ViteDevServer } from "vite-plus";
import { SiteError } from "./errors.ts";
import { posix } from "./discover.ts";
import { elementStyle, readElement, setupModule, templateModule } from "./elementz/file.ts";
import { SCOPE } from "./render.ts";
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
 * it's the file being loaded. An import `browserBoundary` refuses, and a part `elementParts` refuses,
 * are already a `SiteError`.
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

/** The parts of an element file that become modules of their own. */
export type PartName = "template" | "setup" | "style";

// Vite adds flags of its own to the query, such as `direct` and `import`.
const PART = /[?&]sitez=(template|setup|style)(?:&|$)/;

/** @prose
 * The module id of one part of an element file. The query ends in `lang.js` or `lang.css`, as Vue
 * names the parts of a `.vue` file, so Vite treats the style as CSS and the rest as JavaScript,
 * and resolves the part's imports from the element's own folder.
 */
export function partId(file: string, part: PartName): string {
  return `${file}?sitez=${part}&lang.${part === "style" ? "css" : "js"}`;
}

/** @prose
 * Serves each part of an element file as a module (`elementz/file.ts`). The file is read again
 * for each, so a part is never stale, and a mistake in it fails naming the file and the line.
 */
export function elementParts(): Plugin {
  return {
    name: "sitez:element-parts",
    enforce: "pre",
    resolveId(id) {
      const path = id.split("?")[0]!;
      return PART.test(id) && isAbsolute(path) && existsSync(path) ? id : null;
    },
    load(id) {
      const part = PART.exec(id)?.[1] as PartName | undefined;
      if (!part) return null;
      const { root } = this.environment.config;
      const file = asGiven(root, realpathSync(root), id.split("?")[0]!);
      this.addWatchFile(file);
      const element = readElement(file, SCOPE);
      if (part === "template") return { code: templateModule(element, SCOPE), moduleType: "js" };
      if (part === "setup") return { code: setupModule(element), moduleType: "js" };
      return { code: elementStyle(element), moduleType: "css" };
    },
  };
}

const ELEMENT = /(?:^|\/)@[^/]+\.html$/;

/** @prose
 * Fails an import that crosses a line, in whichever environment makes it. An element file is used
 * by its tag and never imported, from build code or browser code. In what the browser loads, an
 * import of `sitez` itself fails too, from an element's `<script>` or from anything it imports,
 * since its `html` renders at build time. The specifier is read as written, which is how the site
 * names its own files. Sitez's own imports of a part come from its entries, which are virtual.
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
      // Vite resolves a part's own file from the part, which is no import of the site's.
      const self = path === importer.split("?")[0];
      if (ELEMENT.test(path) && !PART.test(id) && !self) {
        throw new SiteError(
          from,
          `this imports ${id}, an element file. An element is used by its tag, never imported. Move what both need into a module in code/.`,
        );
      }
      if (this.environment.name === "client" && id === PACKAGE) {
        throw new SiteError(
          from,
          `this imports ${id}, whose html renders at build time. An element's <script> works on the page's DOM the build wrote, with no import from Sitez.`,
        );
      }
      return null;
    },
  };
}
