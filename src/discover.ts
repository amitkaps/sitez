/** @prose
 * # Pages, and the elements in `code/`
 *
 * Which files are pages, and at which URL (rule 1), and which files in `code/` are elements. Every
 * `.md` in `text/` is a page, and nothing in `code/` is. A page's path, less the extension, is its
 * URL, and `index` is its folder's own. A file or folder whose name starts with `.` or `_` is
 * skipped in every folder, since a site's tools leave the first and the author marks the second.
 *
 * An element's file is `@name.html`, found by its name
 * ([sitez.md](../docs/sitez.md#names-in-code)). Sitez looks it up by name, so a misspelling
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

/** Every element's file in `code/`, by tag. Elements are global, wherever their files sit. */
export type Elements = Map<string, string>;

// An element's tag has a hyphen, as Markz's elements do, and its file is named for it.
const TAG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
// Names HTML keeps for its own elements, which `customElements.define` refuses.
const RESERVED = new Set([
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-src",
  "font-face-uri",
  "font-face-format",
  "font-face-name",
  "missing-glyph",
]);

/** @prose
 * The elements in `code/`, found by their names ([sitez.md](../docs/sitez.md#names-in-code)),
 * and every mistake in a name that would leave a file doing nothing. An `@` file is an element's,
 * and an element is one file, `@name.html`. So an `@` file with no hyphen, a reserved name, any
 * other suffix, or a name some other file has already is a mistake, and the message says what to
 * do. The suffixes of Sitez 0.3 (`.html.js`, `.browser.js`) and 0.2 (`.live.js`, `+layout.js`,
 * `+style.css`) say where their code goes now. Elements are global, since one script holds every
 * behavior and one stylesheet styles every tag, so a name has one file wherever it sits.
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
    if (RESERVED.has(tag)) {
      throw new SiteError(
        file,
        `<${tag}> is a name HTML keeps for its own elements. Rename the element.`,
      );
    }
    if (suffix !== "html") throw new SiteError(file, unnamed(tag, suffix));
    const other = elements.get(tag);
    if (other) {
      const [first, second] = [other, file].sort() as [string, string];
      throw new SiteError(
        second,
        `<${tag}> is also in ${shown(first)}. Elements are global, so a name has one file wherever it sits. Remove one, or rename the element.`,
      );
    }
    elements.set(tag, file);
  }
  return elements;
}

/** What an @ file should have been, by what Sitez 0.2 or 0.3 or a guess would have written. */
function unnamed(tag: string, suffix: string): string {
  const one = `An element is one file, @${tag}.html`;
  if (/^html\.[jt]s$/.test(suffix)) {
    return `${one}, so this goes into its <template>. Its markup becomes the template, and its code the template's <script>, which exports what the markup uses.`;
  }
  if (/^(browser|live)\.[jt]s$/.test(suffix)) {
    return `${one}, so this becomes its top-level <script>, which default-exports the setup: export default (el, { signal }) => { … }. Move connectedCallback's code into it.`;
  }
  if (suffix === "css") return `${one}, so this becomes its top-level <style>.`;
  return `${one}. Rename it, or drop the @ if it's a module.`;
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
