/** @prose
 * # Pages, and the elements in `code/`
 *
 * Which files are pages, and at which URL (rule 1), and which files in `code/` are elements. Every
 * `.md` in `text/` is a page, and nothing in `code/` is. A page's path, less the extension, is its
 * URL, and `index` is its folder's own. A file or folder whose name starts with `.` or `_` is
 * skipped in every folder, since a site's tools leave the first and the author marks the second.
 *
 * An element's files start with `@` and are found by their names
 * ([sitez.md](../docs/sitez.md#names-in-code)). Sitez looks them up by name, so a misspelling
 * would silently do nothing, and `readElements` fails on one instead.
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
        `text/ holds only Markz (.md), so this file wouldn't reach the site. Move it to ${folder}/${posix(text, file)}, and ${folder === "data" ? "read it from an element with data" : "link to it from there"}.`,
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

export interface ElementFiles {
  /** The file that writes the element's markup at build time, `@name.html` or `@name.html.js`. */
  markup?: { file: string; kind: "html" | "js" };
  /** The file that gives the element behavior in the browser, `@name.browser.js`. */
  browser?: string;
}

/** Every element in `code/`, by tag. Elements are global, wherever their files sit. */
export type Elements = Map<string, ElementFiles>;

// An element's tag has a hyphen, as Markz's elements do, and its files are named for it.
const TAG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
const SUFFIX = /^(html|html\.[jt]s|browser\.[jt]s)$/;

/** @prose
 * The elements in `code/`, found by their names ([sitez.md](../docs/sitez.md#names-in-code)),
 * and every mistake in a name that would leave a file doing nothing. An `@` file is an element's,
 * so one with no hyphen, a suffix that isn't `.html`, `.html.js` or `.browser.js`, or a name some
 * other file has already is a mistake, and the message says what to rename it to. So are the two
 * names Sitez 0.2 read, `+layout.js` and `+style.css`, which are now `index.html` and a stylesheet
 * it links. Elements are global, since one script holds every behavior and one CSS styles every
 * tag. A name's markup and its behavior are one file each, wherever it sits.
 */
export function readElements(root: string): Elements {
  const elements: Elements = new Map();
  const code = join(root, "code");
  const shown = (file: string) => relative(root, file);
  for (const file of files(code)) {
    const name = basename(file);
    if (/^\+layout\.[jt]s$/.test(name)) {
      throw new SiteError(
        file,
        `Sitez no longer reads a layout. The page's frame is code/index.html, which is complete HTML with <slot></slot> where the page goes. Move this file's markup there, and its head into <head>.`,
      );
    }
    if (name === "+style.css") {
      throw new SiteError(
        file,
        `Sitez no longer reads +style.css. Rename it style.css, and link it from code/index.html: <link rel="stylesheet" href="./style.css" />`,
      );
    }
    if (!name.startsWith("@")) continue;
    const dot = name.indexOf(".");
    const tag = dot === -1 ? name.slice(1) : name.slice(1, dot);
    const suffix = dot === -1 ? "" : name.slice(dot + 1);
    if (!TAG.test(tag)) {
      throw new SiteError(
        file,
        `an @ file is an element's, named for its tag, which has a hyphen and is lowercase, as in @call-out.html. Rename it, or drop the @ if it's a module.`,
      );
    }
    if (!SUFFIX.test(suffix)) throw new SiteError(file, unnamed(tag, suffix));
    const kind = suffix.startsWith("browser") ? "browser" : "markup";
    const found = elements.get(tag) ?? {};
    elements.set(tag, found);
    const other = kind === "browser" ? found.browser : found.markup?.file;
    if (other) {
      const [first, second] = [other, file].sort() as [string, string];
      throw new SiteError(
        second,
        kind === "browser"
          ? `<${tag}>'s behavior is also in ${shown(first)}. Elements are global and one script holds them all, so a name has one .browser.js file wherever it sits. Remove one, or rename the element.`
          : `<${tag}>'s markup is also in ${shown(first)}. Elements are global, so a name has one markup file, @${tag}.html or @${tag}.html.js, wherever it sits. Remove one, or rename the element.`,
      );
    }
    if (kind === "browser") found.browser = file;
    else found.markup = { file, kind: suffix === "html" ? "html" : "js" };
  }
  return elements;
}

/** What an @ file's suffix should have been, by what Sitez 0.2 or a guess would have written. */
function unnamed(tag: string, suffix: string): string {
  if (/^live\.[jt]s$/.test(suffix)) {
    return `.live.js is now .browser.js, which says where the file runs. Rename it @${tag}.browser.js.`;
  }
  if (/^[jt]s$/.test(suffix)) {
    return `a name must say when the file runs. Rename it @${tag}.html.js if it writes HTML when the site is built, or @${tag}.browser.js if it runs in the browser.`;
  }
  return `an element's files are @${tag}.html, @${tag}.html.js and @${tag}.browser.js. Rename it, or drop the @ if it's a module.`;
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

/** Whether a path, from `folder` down, goes through a name starting with `_`, which Sitez skips. */
export function skipped(folder: string, file: string): boolean {
  return relative(folder, file)
    .split(sep)
    .some((part) => part.startsWith("_"));
}

/** Every file below `folder`, sorted, leaving out what `skipped` does and anything under a `.`. */
function files(folder: string): string[] {
  if (!statSync(folder, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(
      (file) =>
        !skipped(folder, file) &&
        !relative(folder, file)
          .split(sep)
          .some((part) => part.startsWith(".")),
    )
    .sort();
}
