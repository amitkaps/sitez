/** @prose
 * # Pages, and the names in `code/`
 *
 * Which files are pages, and at which URL (rule 1). Every `.md` in `text/` is a page, and nothing
 * in `code/` is. A page's path, less the extension, is its URL, and `index` is its folder's own.
 * Folders and files starting with `.` are skipped, since a site's tools leave them there.
 *
 * A file in `code/` has a role by the first character of its name
 * ([design.md](../docs/design.md#names-in-code)). `@` is an element's file, `+` is a file Sitez
 * reads by name, and anything else is a module. Sitez looks up the first two, so a misspelling
 * would silently do nothing, and `checkCode` fails on one instead.
 */
import { readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { SiteError } from "./errors.ts";

export const SITE_FILE = "site.md";

/** `text/site.md`, found by page discovery. */
export function reserved(file: string): SiteError {
  return new SiteError(
    file,
    `${SITE_FILE} is reserved for the site's metadata, next to text/, so it can't be a page. Rename it, or move its metadata into ../${SITE_FILE}.`,
  );
}

export interface Page {
  url: string;
  /** Absolute path to the page's file. */
  file: string;
}

/** @prose
 * Finds every page, sorted by URL. It fails on `text/site.md`, which would otherwise be a page. It
 * fails on two files for one URL, naming both (`text/blog.md` and `text/blog/index.md`).
 *
 * It also fails on any file in `text/` that isn't `.md`. `text/` holds what is read as it is, and
 * an image or a PDF there would otherwise be silently left out of the site. Its place is
 * `public/`, or `data/` for JSON.
 */
export function discover(root: string): Page[] {
  const pages: Page[] = [];
  const text = join(root, "text");
  for (const file of files(text)) {
    if (extname(file) !== ".md") {
      const folder = extname(file) === ".json" ? "data" : "public";
      throw new SiteError(
        file,
        `text/ holds only Markz (.md), so this file wouldn't reach the site. Move it to ${folder}/${posix(text, file)}, and ${folder === "data" ? "read it from a component with data" : "link to it from there"}.`,
      );
    }
    if (file === join(text, SITE_FILE)) throw reserved(file);
    pages.push({ url: urlOf(text, file), file });
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

// An element's file is named for its tag, which has a hyphen as Markz's elements do.
const ELEMENT = /^@[a-z][a-z0-9]*(?:-[a-z0-9]+)+(?:\.live)?\.[jt]s$/;
const READ_BY_NAME = ["+layout.js", "+layout.ts", "+style.css"];

/** @prose
 * Fails on a file in `code/` whose name starts with `@` or `+` and isn't one Sitez uses. A
 * misspelled `+layuot.js` or `@callout.js` would be a file nothing reads, so it fails and says
 * what is allowed. A `+style.css` below `code/` fails too, since a site has one stylesheet.
 */
export function checkCode(root: string): void {
  const code = join(root, "code");
  for (const file of files(code)) {
    const name = basename(file);
    if (name.startsWith("@") && !ELEMENT.test(name)) {
      throw new SiteError(
        file,
        `an @ file renders an element, so it is named for the element's tag, with a hyphen and lowercase, as in @call-out.js. Behavior in the browser is @call-out.live.js. Rename it, or drop the @ if it's a module.`,
      );
    }
    if (!name.startsWith("+")) continue;
    if (!READ_BY_NAME.includes(name)) {
      throw new SiteError(
        file,
        `Sitez reads +layout.js and +style.css and no other + file. Check the spelling, or drop the + if it's a module.`,
      );
    }
    if (name === "+style.css" && file !== join(code, name)) {
      throw new SiteError(
        file,
        `a site has one stylesheet, code/+style.css, which can @import others. Move this into it.`,
      );
    }
  }
}

/** @prose
 * The nearest file of a name up the tree from a page's URL (rule 2). For `/blog/hello/`, that's
 * `code/blog/hello/`, then `code/blog/`, then `code/`. Layouts, the components that render text
 * elements and their `.live` files are all found this way, so where a file sits says what it
 * belongs to. Only the nearest is used. A layout that wants the one above it imports it, as any
 * component would. `name` is without its extension, such as `+layout` or `@call-out.live`.
 */
export function nearest(root: string, url: string, name: string): string | undefined {
  const segments = url.split("/").filter(Boolean);
  for (let n = segments.length; n >= 0; n--) {
    const [js, ts] = [".js", ".ts"].map((extension) =>
      join(root, "code", ...segments.slice(0, n), name + extension),
    ) as [string, string];
    const found = [js, ts].filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile());
    if (found.length === 2) {
      throw new SiteError(ts, `${basename(js)} is beside it, and a name has one file. Remove one.`);
    }
    if (found[0]) return found[0];
  }
  return undefined;
}

/** @prose
 * The page at `/404/`, `text/404.md`, is what a host serves for a URL that doesn't exist. Hosts
 * look for it at `404.html` (rule 1). Every other page is its folder's `index.html`, so its URL
 * needs no extension.
 */
export const NOT_FOUND = "/404/";

export function outputFile(url: string): string {
  return url === NOT_FOUND ? "404.html" : join(...url.split("/").filter(Boolean), "index.html");
}

/** A file's URL from its path below `folder` (`text/`). */
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
