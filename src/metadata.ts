/** @prose
 * # Metadata
 *
 * What pages and layouts know about a page, the site and every page (rule 5). A text page's
 * metadata is its Markz block, with `title` defaulting to the first heading and `summary` to the
 * first paragraph, so most pages need no block. A JS page's is its exported `metadata`, with
 * `title` defaulting to its first `<h1>` once it has rendered.
 *
 * Sitez checks only the keys it reads itself, and a wrong one fails the build naming the file and
 * the key rather than being read some other way: `draft: yes` would otherwise publish a draft.
 * Every other key passes through unchecked, so a site can add its own (`tags`), and the code
 * that reads it is where it's checked.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, textContent, type Document, type MetadataValue } from "@amitkaps/markz";
import { SiteError } from "./errors.ts";
import { SITE_FILE } from "./root.ts";

export type Metadata = Record<string, MetadataValue | undefined>;

/** A page as code sees it: its URL and its metadata. */
export interface PageData extends Metadata {
  url: string;
  title?: string;
  summary?: string;
  date?: string;
  draft?: boolean;
}

/** @prose
 * The metadata block in `site.md`; the rest of the file is notes for whoever maintains the site.
 * `lang` is the language every page is written in, English unless it says otherwise.
 */
export function siteMetadata(root: string): Metadata {
  const file = join(root, SITE_FILE);
  const block: Metadata = { ...parse(readFileSync(file, "utf8")).metadata };
  check(file, block, siteKeys);
  return { lang: "en", ...block };
}

export function textMetadata(file: string, url: string, doc: Document): PageData {
  const block: Metadata = { ...doc.metadata };
  check(file, block, pageKeys);
  const title = first(doc, "heading");
  const summary = first(doc, "paragraph");
  return {
    ...block,
    url,
    title: typeof block.title === "string" ? block.title : title,
    summary: typeof block.summary === "string" ? block.summary : summary,
  };
}

/** @prose
 * A JS page's metadata, from its module's `metadata` export, and its title from the first `<h1>`
 * of its HTML when the export has none. The renderer writes text escaped, so the few entities it
 * produces are all there is to decode.
 */
export function codeMetadata(
  file: string,
  url: string,
  exported: unknown,
  body?: string,
): PageData {
  if (exported !== undefined && (typeof exported !== "object" || exported === null)) {
    throw new SiteError(file, "metadata is exported but not an object: write { title: … }.");
  }
  const block = { ...(exported as Metadata | undefined) };
  check(file, block, pageKeys);
  const h1 = body?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  const title = typeof block.title === "string" ? block.title : h1 && plain(h1);
  return { ...block, url, title: title || undefined };
}

export function isDraft(page: PageData): boolean {
  return page.draft === true;
}

/** @prose
 * The keys Sitez reads, and what each must be. `url` belongs to the site in `site.md`; a page's
 * URL is its file's path, so a page setting one would be ignored, and fails instead. An empty
 * value (`title:`) is a mistake too: leave the line out to get the default.
 */
type Rule = (value: MetadataValue | undefined) => string | undefined;

const text: Rule = (value) => (typeof value === "string" ? undefined : "write it as text");

const pageKeys: Record<string, Rule> = {
  title: text,
  summary: text,
  date: (value) =>
    typeof value === "string" && isDate(value) ? undefined : "write a date as 2026-09-29",
  draft: (value) => (typeof value === "boolean" ? undefined : "write draft: true or draft: false"),
  url: () => "a page's URL is its file's path: move the file instead, and remove url",
};

const absoluteUrl: Rule = (value) =>
  typeof value === "string" && /^https?:\/\/[^/\s]+/.test(value)
    ? undefined
    : "write the full address, starting https://";

const siteKeys: Record<string, Rule> = {
  name: text,
  url: absoluteUrl,
  repo: absoluteUrl,
  lang: text,
};

function check(file: string, block: Metadata, rules: Record<string, Rule>): void {
  for (const [key, rule] of Object.entries(rules)) {
    if (!(key in block)) continue;
    const value = block[key];
    const problem = value === null ? "leave the line out, or give it a value" : rule(value);
    if (problem) {
      throw new SiteError(file, `${key} is ${JSON.stringify(value)}: ${problem}.`);
    }
  }
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

/** @prose
 * The text of the first top-level node of `type`, which is what a reader sees first, on one line:
 * a paragraph's line breaks are the source's, not the reader's, and a description has none.
 */
function first(doc: Document, type: "heading" | "paragraph"): string | undefined {
  for (const node of doc.children(doc.root)) {
    if (doc.type(node) === type)
      return textContent(doc, node).replace(/\s+/g, " ").trim() || undefined;
  }
  return undefined;
}

function plain(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->|<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}
