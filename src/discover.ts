/** @prose
 * # Pages
 *
 * Which files are pages, and at which URL (rules 1 and 2). Every `.md` in `text/` is a page, and
 * so is every `.svelte` in `code/` whose name doesn't start with a capital or `_`. A page's path, less
 * the extension, is its URL, and `index` is its folder's own.
 *
 * A capitalized `.svelte` is a layout or component, a `_` prefix marks a module, and `.js` and
 * `.ts` files are modules too. None of them is a page. Folders and files starting with `.` are
 * skipped, since a site's tools leave them there.
 */
import { readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { SiteError } from "./errors.ts";
import { reserved, SITE_FILE } from "./root.ts";

export interface Page {
  url: string;
  /** Absolute path to the page's file. */
  file: string;
  kind: "text" | "code";
}

/** @prose
 * Finds every page, sorted by URL. It fails on `text/site.md`, which would otherwise be a page.
 * It fails on two files for one URL, naming both (`text/about.md` and `code/about.svelte`, or
 * `text/blog.md` and `text/blog/index.md`).
 *
 * It also fails on any file in `text/` that isn't `.md`. `text/` holds what is read as it is, and
 * an image or a PDF there would otherwise be silently left out of the site. Its place is `public/`.
 */
export function discover(root: string): Page[] {
  const pages: Page[] = [];
  const text = join(root, "text");
  for (const file of files(text)) {
    if (extname(file) !== ".md") {
      throw new SiteError(
        file,
        `text/ holds only Markz (.md), so this file wouldn't reach the site. Move it to public/${posix(text, file)}, and link to it from there.`,
      );
    }
    if (file === join(text, SITE_FILE)) throw reserved(file);
    pages.push({ url: urlOf(text, file), file, kind: "text" });
  }
  const code = join(root, "code");
  for (const file of files(code)) {
    if (extname(file) !== ".svelte" || /^[A-Z_]/.test(basename(file))) continue;
    pages.push({ url: urlOf(code, file), file, kind: "code" });
  }

  const byUrl = new Map<string, Page>();
  for (const page of pages) {
    const other = byUrl.get(page.url);
    if (other) {
      throw new SiteError(
        page.file,
        `${page.url} also comes from ${relative(root, other.file)}. A URL has one file: rename or remove one of them.`,
      );
    }
    byUrl.set(page.url, page);
  }
  return pages.toSorted((a, b) => (a.url < b.url ? -1 : 1));
}

/** @prose
 * The nearest file of a name up the tree from a page's URL (rule 2). For `/blog/hello/`, that's
 * `code/blog/hello/`, then `code/blog/`, then `code/`. Layouts and the components that render text
 * elements are both found this way, so where a file sits says what it belongs to. Only the nearest
 * is used. A layout that wants the one above it imports it, as any component would.
 */
export function nearest(root: string, url: string, name: string): string | undefined {
  const segments = url.split("/").filter(Boolean);
  for (let n = segments.length; n >= 0; n--) {
    const file = join(root, "code", ...segments.slice(0, n), `${name}.svelte`);
    if (statSync(file, { throwIfNoEntry: false })?.isFile()) return file;
  }
  return undefined;
}

/** @prose
 * The page at `/404/`, `text/404.md` or `code/404.svelte`, is what a host serves for a URL that
 * doesn't exist. Hosts look for it at `404.html` (rule 1). Every other page is its folder's
 * `index.html`, so its URL needs no extension.
 */
export const NOT_FOUND = "/404/";

export function outputFile(url: string): string {
  return url === NOT_FOUND ? "404.html" : join(...url.split("/").filter(Boolean), "index.html");
}

/** A file's URL from its path below `folder` (`text/` or `code/`). */
export function urlOf(folder: string, file: string): string {
  const segments = relative(folder, file).slice(0, -extname(file).length).split(sep);
  if (segments.at(-1) === "index") segments.pop();
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

/** A file's path below `folder`, with `/` between its parts on every system. */
export function posix(folder: string, file: string): string {
  return relative(folder, file).split(sep).join("/");
}

/** Every file below `folder`, sorted, skipping anything under a name starting with `.`. */
function files(folder: string): string[] {
  if (!statSync(folder, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(
      (file) =>
        !relative(folder, file)
          .split(sep)
          .some((part) => part.startsWith(".")),
    )
    .sort();
}
