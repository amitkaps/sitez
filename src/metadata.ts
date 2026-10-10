/** @prose
 * # Metadata
 *
 * What elements know about a page, the site and every page (rule 5). A page's metadata is its Markz
 * block and its `url`, and nothing else. Sitez reads `title`, `description`, `draft` and
 * `redirects` from it, and fills in none of them from the text. `title` and `description` go in
 * the head (`head.ts`), `draft` keeps the page out of the build, and `redirects` write pages
 * ([idea.md](../docs/idea.md#metadata)).
 *
 * Sitez checks only the keys it reads itself, and a wrong one fails the build naming the file and
 * the key rather than being read some other way. `draft: yes` would otherwise publish a draft.
 * Markz skips a value YAML reads differently, like `yes`, with a `metadata-value` warning, so a
 * key Sitez reads is checked as written on its line, not only as Markz kept it.
 * Every other key passes through unchecked, `date` and `tags` included, so a site can add its own,
 * and the code that reads one is where it's checked.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type Document, type MetadataValue } from "@amitkaps/markz";
import { SITE_FILE } from "./discover.ts";
import { SiteError } from "./errors.ts";

export type Metadata = Record<string, MetadataValue | undefined>;

/** A page as code sees it: its metadata block and its URL. */
export interface PageData extends Metadata {
  url: string;
  title?: string;
  description?: string;
  draft?: boolean;
  redirects?: string | string[];
}

/** @prose
 * The metadata block in `site.md`, the rest of the file being notes for whoever maintains the
 * site. Sitez reads `url`, which every page's canonical link needs, and `repo`, where links to the
 * repo's files go. Every other key is the site's own, as `site.author`.
 */
export function siteMetadata(root: string): Metadata {
  const file = join(root, SITE_FILE);
  const doc = parse(readFileSync(file, "utf8"));
  const block: Metadata = { ...doc.metadata };
  check(file, doc, block, siteKeys);
  return block;
}

export function textMetadata(file: string, url: string, doc: Document): PageData {
  const block: Metadata = { ...doc.metadata };
  check(file, doc, block, pageKeys);
  return { ...block, url };
}

export function isDraft(page: PageData): boolean {
  return page.draft === true;
}

/** @prose
 * The keys Sitez reads, and what each must be. `url` belongs to the site in `site.md`. A page's
 * URL is its file's path, so a page setting one would be ignored, and fails instead. An empty
 * value (`title:`) is a mistake too. Leave the line out to keep the frame's own.
 */
type Rule = (value: MetadataValue | undefined) => string | undefined;

const text: Rule = (value) => (typeof value === "string" ? undefined : "write it as text");

const pageKeys: Record<string, Rule> = {
  title: text,
  description: text,
  draft: (value) => (typeof value === "boolean" ? undefined : "write draft: true or draft: false"),
  url: () => "a page's URL is its file's path: move the file instead, and remove url",
  redirects: (value) =>
    typeof value === "string" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
      ? undefined
      : "write the URLs that used to reach this page, such as redirects: [/old-name/]",
};

const absoluteUrl: Rule = (value) =>
  typeof value === "string" && /^https?:\/\/[^/\s]+/.test(value)
    ? undefined
    : "write the full address, starting https://";

const siteKeys: Record<string, Rule> = { url: absoluteUrl, repo: absoluteUrl };

function check(file: string, doc: Document, block: Metadata, rules: Record<string, Rule>): void {
  for (const { code, start, end, message } of doc.warnings) {
    if (code !== "metadata-value") continue;
    const line = /^([^:]+):\s*(.*)$/.exec(doc.source.slice(start, end));
    const key = line?.[1]?.trim();
    if (key && key in rules && !(key in block)) {
      const problem = rules[key]!(line?.[2] ?? "") ?? message;
      throw new SiteError(file, `${key} is ${JSON.stringify(line?.[2])}: ${problem}.`);
    }
  }
  for (const [key, rule] of Object.entries(rules)) {
    if (!(key in block)) continue;
    const value = block[key];
    const problem = value === null ? "leave the line out, or give it a value" : rule(value);
    if (problem) {
      throw new SiteError(file, `${key} is ${JSON.stringify(value)}: ${problem}.`);
    }
  }
}
