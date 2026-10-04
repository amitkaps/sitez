/** @prose
 * # The head
 *
 * What a page's `<head>` says about it, written from its metadata and the site's: `<title>` is
 * the page's `title`, as written, the description its `summary`, and the canonical URL and Open
 * Graph tags follow from those and `url` in `site.md`. Twitter reads the Open Graph tags, so it
 * needs only its card. So a page's head changes with its metadata, never with its code, and a
 * `Head.js` that writes one of these tags itself fails.
 */
import { NOT_FOUND } from "./discover.ts";
import { SiteError } from "./errors.ts";
import type { Metadata, PageData } from "./metadata.ts";

/** @prose
 * The tags for one page. The 404 page is served at URLs that aren't its own, so it has no
 * canonical URL. A page with a `date` is an article; the rest are the site's. `feed` says whether
 * the site has a feed to point readers' apps at.
 */
export function headTags(page: PageData, site: Metadata, feed: boolean): string {
  const name = typeof site.name === "string" ? site.name : undefined;
  const title = page.title ?? name ?? "";
  const url = typeof site.url === "string" ? absolute(site.url, page.url) : undefined;
  const tags = [`<title>${escape(title)}</title>`];
  if (page.summary) tags.push(meta("name", "description", page.summary));
  if (url && page.url !== NOT_FOUND) {
    tags.push(`<link rel="canonical" href="${escape(url)}">`);
    tags.push(meta("property", "og:url", url));
  }
  tags.push(meta("property", "og:type", page.date ? "article" : "website"));
  tags.push(meta("property", "og:title", title));
  if (page.summary) tags.push(meta("property", "og:description", page.summary));
  if (name) tags.push(meta("property", "og:site_name", name));
  tags.push(meta("name", "twitter:card", "summary"));
  if (feed) {
    tags.push(
      `<link rel="alternate" type="application/rss+xml" title="${escape(name ?? title)}" href="/feed.xml">`,
    );
  }
  return tags.join("\n");
}

/** @prose
 * `Head.js` can add anything else, such as a font or a script, but not a tag Sitez writes. Two
 * titles or two descriptions is a page that says two things about itself. So it fails, naming the
 * metadata key that sets the tag.
 */
export function checkHead(file: string, head: string): void {
  for (const [pattern, tag, fix] of owned) {
    if (!pattern.test(head)) continue;
    throw new SiteError(
      file,
      `this writes ${tag}, but Sitez writes it from metadata. Remove it, ${fix}.`,
    );
  }
}

const owned: [RegExp, string, string][] = [
  [/<title[\s>]/, "a <title>", "and set title in the page's metadata"],
  [/<meta\b[^>]*\bname="description"/, "a description", "and set summary in the page's metadata"],
  [/<link\b[^>]*\brel="canonical"/, "a canonical link", "as it comes from url in site.md"],
  [/<meta\b[^>]*\bname="twitter:/, "a Twitter tag", "as it comes from the Open Graph tags"],
  [
    /<meta\b[^>]*\bproperty="og:/,
    "an Open Graph tag",
    "as it comes from the page's title and summary",
  ],
];

/** A page's full address, from `url` in `site.md` with or without its trailing slash. */
export function absolute(siteUrl: string, path: string): string {
  return siteUrl.replace(/\/+$/, "") + path;
}

function meta(attribute: string, key: string, content: string): string {
  return `<meta ${attribute}="${key}" content="${escape(content)}">`;
}

export function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
