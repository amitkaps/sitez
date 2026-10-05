/** @prose
 * # Bundling
 *
 * What the browser downloads besides the HTML, built by Rolldown once every page has rendered,
 * since only then is it known which live elements the pages use. A site has one stylesheet and at
 * most one script. Each is small, so one file, cached by the first page and reused by every
 * other, costs less than a split that saves a few bytes per page. The stylesheet is Sitez's reset,
 * then `code/+style.css`, with everything it references (a font, an image) bundled beside it. The
 * script is the live elements', loaded only by pages that have one. Every file's name carries a
 * content hash, so a new deploy is never served from a stale cache.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { build, type InlineConfig, type Logger, type Plugin, type Rolldown } from "vite";
import { SiteError } from "./errors.ts";
import { urlImportError, type Live } from "./live.ts";
import {
  asGiven,
  cacheDir,
  fromSitez,
  liveBoundary,
  noOptimizer,
  runtime,
  siteError,
} from "./vite.ts";

/** Files to write into `dist/`, by path. */
export type Files = Map<string, string | Uint8Array>;

/** @prose
 * The stylesheet, and the file it is written to. The reset is a layer of its own, so what the site
 * writes follows it whatever its specificity. A `url()` that doesn't resolve fails the build
 * rather than shipping as written, as a broken link would. The build has no code splitting, so its
 * CSS is one file even when the site's CSS imports others.
 */
export async function stylesheet(
  root: string,
  real: string,
): Promise<{ href: string; files: Files }> {
  const imports = styleImports(real, `/code/+style.css`);
  const { output, unresolved } = await bundle(
    root,
    real,
    { style: imports.join("\n") },
    {
      codeSplitting: false,
      assetFileNames: (asset) =>
        asset.names.some((name) => name.endsWith(".css"))
          ? "style.[hash].css"
          : "assets/[name].[hash][extname]",
    },
  );
  const [url] = unresolved;
  if (url) {
    // Vite's warning names only the URL, and the site's own CSS is the one stylesheet it reads.
    throw urlError(asGiven(root, real, join(real, "code", "+style.css")), url);
  }
  const files: Files = new Map();
  let href = "";
  for (const item of output) {
    if (item.type !== "asset") continue;
    files.set(item.fileName, item.source);
    if (item.fileName.endsWith(".css")) href = `/${item.fileName}`;
  }
  return { href, files };
}

/** @prose
 * The first `url()` in the site's CSS that points at nothing, resolved as `build` resolves it:
 * relative to its file, or from `public/` and then the site's root when it starts with `/`.
 * `dev` checks with this, since there Vite hands a `url()` to the browser unchecked and a missing
 * font falls back without a word; `build` has Vite's own check. `files` are the stylesheets read.
 */
export function missingUrl(root: string, files: string[]): SiteError | undefined {
  for (const file of files) {
    if (!existsSync(file)) continue;
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, , url = ""] of css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/g)) {
      if (url === "" || /^(?:[a-z]+:|\/\/|#)/i.test(url)) continue;
      const path = decodeURI(url.split(/[?#]/)[0]!);
      const found = path.startsWith("/")
        ? existsSync(join(root, "public", path)) || existsSync(join(root, path))
        : existsSync(join(dirname(file), path));
      if (!found) return urlError(file, url);
    }
  }
  return undefined;
}

function urlError(file: string, url: string): SiteError {
  return new SiteError(
    file,
    `url(${url}) isn't there. Fix the path: relative to this file, or /… for a file in public/.`,
  );
}

/** @prose
 * The imports every page's styles start with: Sitez's reset, then the site's own
 * `code/+style.css` when there is one, imported as `style` names it.
 */
export function styleImports(real: string, style: string): string[] {
  return [
    `import ${JSON.stringify(join(runtime, "reset.css"))};`,
    ...(existsSync(join(real, "code", "+style.css")) ? [`import ${JSON.stringify(style)};`] : []),
  ];
}

/** @prose
 * A script that defines live elements: each live file's class, defined as its tag. The tag comes
 * from the file's name and the class from its default export, so a live file never names its
 * element (rule 6). That one line per element is all of Sitez that reaches the browser.
 */
export function liveEntry(lives: Live[]): string {
  return [
    ...lives.map(({ file }, i) => `import live${i} from ${JSON.stringify(file)};`),
    ...lives.map(({ tag }, i) => `customElements.define(${JSON.stringify(tag)}, live${i});`),
  ].join("\n");
}

/** @prose
 * The site's one script, `script.[hash].js`, which defines every live element a page uses. Like
 * the stylesheet, it is small, and one file cached by the first page costs less than a split by
 * page. Only a page with a live element loads it. Defining a tag that isn't on the page costs
 * nothing.
 *
 * One script means one live file for each tag. A tag whose behavior differs by folder would
 * define the tag twice, so two used live files for one tag fail.
 *
 * A package a live file imports at the top goes into the script. One it imports with
 * `await import()` becomes a chunk of its own, fetched only where its element connects, so a large
 * library costs only the pages that use it. A library by URL must come in that way too, or every
 * page with a live element would fetch it (`urlImports`). Those imports are left as they are, and
 * the report names their hosts.
 *
 * The build is in production mode whatever the process says, since a dev server earlier in the
 * same process leaves `NODE_ENV` at `development`.
 */
export async function script(root: string, real: string, lives: Live[]): Promise<Script> {
  const byTag = new Map<string, Live>();
  for (const live of lives) {
    const other = byTag.get(live.tag);
    if (other && other.file !== live.file) {
      const [first, second] = [other.file, live.file].sort();
      throw new SiteError(
        asGiven(root, real, second!),
        `this and ${relative(real, first!)} are both <${live.tag}>'s behavior, on different pages. A site has one script, so a tag has one live file. Remove one, or give the elements different names.`,
      );
    }
    byTag.set(live.tag, live);
  }
  if (byTag.size === 0) return { files: new Map(), src: undefined, hosts: [] };
  const sorted = [...byTag.values()].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const mode = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  let output: Rolldown.RolldownOutput["output"];
  try {
    ({ output } = await bundle(
      root,
      real,
      { script: liveEntry(sorted) },
      {
        entryFileNames: "[name].[hash].js",
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
      },
      [urlImports(root, real)],
    ));
  } finally {
    if (mode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = mode;
  }
  const files: Files = new Map();
  let src: string | undefined;
  const hosts = new Set<string>();
  for (const item of output) {
    if (item.type === "asset") {
      files.set(item.fileName, item.source);
      continue;
    }
    files.set(item.fileName, item.code);
    if (item.isEntry) src = `/${item.fileName}`;
    for (const url of item.dynamicImports) if (URL.canParse(url)) hosts.add(new URL(url).host);
  }
  return { files, src, hosts: [...hosts].sort() };
}

/** What `script` built: its files, the URL pages load it from, and the hosts it loads libraries
 * from. */
export interface Script {
  files: Files;
  src: string | undefined;
  hosts: string[];
}

/** @prose
 * Fails a library imported by URL at the top of a module the site's script takes in. Every page
 * with a live element would fetch it before anything ran, whether or not its element is there.
 * Inside the element's function, `await import()` fetches it only where the element is.
 */
function urlImports(root: string, real: string): Plugin {
  return {
    name: "sitez:url-imports",
    moduleParsed(info) {
      const url = info.importedIds.find((id) => URL.canParse(id));
      if (url) throw urlImportError(asGiven(root, real, info.id), url);
    },
  };
}

/** @prose
 * One client build from generated entries, written to memory: nothing reaches `dist/` until
 * every page has built. Vite reports a `url()` it can't find only as a warning, and leaves it in
 * the CSS, so warnings are read here instead of printed. A file that doesn't
 * compile fails naming it, as it would while rendering.
 */
async function bundle(
  root: string,
  real: string,
  entries: Record<string, string>,
  output: Rolldown.OutputOptions,
  plugins: Plugin[] = [],
): Promise<{ output: Rolldown.RolldownOutput["output"]; unresolved: string[] }> {
  const unresolved: string[] = [];
  const logger = quietLogger((message) => {
    const found = /^\s*(\S+) referenced in .* didn't resolve at build time/.exec(message);
    if (found) unresolved.push(found[1]!);
  });
  const config: InlineConfig = {
    configFile: false,
    root: real,
    cacheDir: cacheDir(real),
    logLevel: "silent",
    customLogger: logger,
    plugins: [
      liveBoundary(root, real),
      fromSitez(),
      entryModules(entries),
      noOptimizer(),
      ...plugins,
    ],
    build: {
      write: false,
      assetsInlineLimit: 0,
      // The site's script has one entry, and a chunk loads only where its element connects, so
      // there's nothing to preload.
      modulePreload: false,
      rolldownOptions: {
        input: Object.fromEntries(Object.keys(entries).map((name) => [name, ENTRY + name])),
        // Vite drops an app entry's exports, and with them the modules only exported.
        preserveEntrySignatures: "exports-only",
        output,
      },
    },
  };
  try {
    const result = (await build(config)) as Rolldown.RolldownOutput;
    return { output: result.output, unresolved };
  } catch (error) {
    throw siteError(error, join(real, "code"), root, real);
  }
}

const ENTRY = "sitez:entry/";

function entryModules(entries: Record<string, string>): Plugin {
  return {
    name: "sitez:entry",
    resolveId: (id) => (id.startsWith(ENTRY) ? `\0${id}` : null),
    load: (id) => (id.startsWith(`\0${ENTRY}`) ? entries[id.slice(ENTRY.length + 1)] : null),
  };
}

function quietLogger(onWarn: (message: string) => void): Logger {
  const warned = new Set<string>();
  return {
    hasWarned: false,
    info() {},
    warn: (message) => onWarn(message),
    warnOnce(message) {
      if (warned.has(message)) return;
      warned.add(message);
      onWarn(message);
    },
    error() {},
    clearScreen() {},
    hasErrorLogged: () => false,
  };
}
