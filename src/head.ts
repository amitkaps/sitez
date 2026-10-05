/** @prose
 * # The head, and the frame it is in
 *
 * `code/index.html` and Sitez share each page's head, and each tag has one owner (rule 2). The
 * frame writes `lang`, `charset`, `viewport`, its stylesheets and everything else the site
 * chooses. Sitez puts the page's `title` and `description` in place of the frame's, and writes the
 * canonical link and the seven Open Graph and Twitter tags that follow from them and `url` in
 * `site.md`. Those repeat two values with no choice in them. A page that sets neither `title` nor
 * `description` keeps the frame's own, and so do its social tags.
 *
 * The frame fails the build for what would make every page wrong: a missing `lang`, `charset`,
 * `viewport`, `<title>` or description, a slot count other than one, and a tag Sitez writes. Each
 * message names `code/index.html` and shows the line to add or remove. Sitez checks nothing else,
 * since it isn't an HTML validator. The reasons are in
 * [design.md](../docs/design.md#the-frame).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NOT_FOUND } from "./discover.ts";
import { SiteError } from "./errors.ts";
import { attribute, decode, encode, scan, withValue, type Tag } from "./markup.ts";
import type { Metadata, PageData } from "./metadata.ts";

/** What stands where the page goes, until the page is put there. */
export const SLOT = "<sitez-slot></sitez-slot>";

/** A stylesheet `index.html` links with a relative path, which Sitez bundles. */
export interface Style {
  /** The `href` as written. */
  href: string;
  /** The stylesheet, absolute. */
  file: string;
}

/** @prose
 * `code/index.html`, read and checked. `html` has its slot replaced by `SLOT`, so what renders
 * around the page is a string with one marker in it. `styles` are the stylesheets it links with a
 * relative path, which are resolved from `code/` as the file would be opened, and must be there.
 * A link that starts `/` or names a host is another file, and is the site's to get right.
 */
export interface Frame {
  file: string;
  html: string;
  styles: Style[];
}

export function readFrame(root: string): Frame {
  const file = join(root, "code", "index.html");
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    throw new SiteError(
      file,
      "this is missing. It is the HTML every page starts from, a complete page with <slot></slot> where the page goes.",
    );
  }
  const slot = checkFrame(file, source);
  const html = source.slice(0, slot.start) + SLOT + source.slice(slotEnd(source, slot));
  const styles = styleLinks(html).map(({ href }) => {
    const found = join(root, "code", href);
    try {
      readFileSync(found);
    } catch {
      throw new SiteError(
        file,
        `<link href="${href}"> isn't a file. Stylesheets are found from code/, so write the path to one there.`,
      );
    }
    return { href, file: found };
  });
  return { file, html, styles };
}

/** A `<slot></slot>` is a tag and, as written, its end. */
function slotEnd(html: string, slot: Tag): number {
  const close = /^\s*<\/slot\s*>/i.exec(html.slice(slot.end));
  return slot.end + (close?.[0].length ?? 0);
}

/** The relative stylesheet links in `html`: where each tag is, and the `href` it was given. */
export function styleLinks(html: string): { tag: Tag; href: string }[] {
  return scan(html).flatMap((tag) => {
    if (tag.kind !== "start" || tag.name !== "link") return [];
    const rel = attribute(tag, "rel")?.value ?? "";
    const href = decode(attribute(tag, "href")?.value ?? "");
    const relative = href !== "" && !href.startsWith("/") && !/^[a-z][a-z\d+.-]*:/i.test(href);
    return decode(rel).toLowerCase().split(/\s+/).includes("stylesheet") && relative
      ? [{ tag, href }]
      : [];
  });
}

/** `html` with each relative stylesheet link's `href` changed to what `to` says, if it does. */
export function withStyles(html: string, to: (href: string) => string | undefined): string {
  let out = html;
  for (const { tag, href } of styleLinks(html).toReversed()) {
    const found = attribute(tag, "href")!;
    const next = to(href);
    if (next !== undefined) out = withValue(out, found, encode(next));
  }
  return out;
}

/** @prose
 * What fails a frame, in the order of its head. It returns the slot, so `readFrame` can put a
 * marker there. A tag Sitez writes is shown as the author wrote it, since that's the line to
 * remove.
 */
function checkFrame(file: string, html: string): Tag {
  const tags = scan(html);
  const start = (name: string) => tags.find((tag) => tag.kind === "start" && tag.name === name);
  const meta = (key: string, value: string) =>
    tags.find(
      (tag) =>
        tag.kind === "start" &&
        tag.name === "meta" &&
        decode(attribute(tag, key)?.value ?? "").toLowerCase() === value,
    );
  const fail = (message: string) => new SiteError(file, message);
  if (!attribute(start("html") ?? tags[0]!, "lang")?.value) {
    throw fail(
      `<html> has no lang. Add it, such as <html lang="en">, so screen readers read the page in its language.`,
    );
  }
  if (!tags.some((tag) => tag.name === "meta" && attribute(tag, "charset"))) {
    throw fail(
      `there's no charset. Add <meta charset="utf-8" /> to the head, or accented text garbles.`,
    );
  }
  if (!meta("name", "viewport")) {
    throw fail(
      `there's no viewport. Add <meta name="viewport" content="width=device-width, initial-scale=1" /> to the head, or a phone zooms out.`,
    );
  }
  if (!start("title")) {
    throw fail(
      `there's no <title>. Add the site's own, which a page that sets no title keeps: <title>My Site</title>`,
    );
  }
  const description = meta("name", "description");
  if (!description || attribute(description, "content")?.value === undefined) {
    throw fail(
      `there's no description. Add the site's own, which a page that sets no description keeps: <meta name="description" content="What the site is about." />`,
    );
  }
  const slots = tags.filter((tag) => tag.kind === "start" && tag.name === "slot");
  if (slots.length !== 1) {
    throw fail(
      slots.length === 0
        ? "there's no <slot></slot>. Write it where each page goes, such as <main><slot></slot></main>."
        : `there are ${slots.length} slots, and a page goes in one. Keep a single <slot></slot>.`,
    );
  }
  for (const tag of tags) {
    if (tag.kind !== "start") continue;
    const written = html.slice(tag.start, tag.end);
    const rel = decode(attribute(tag, "rel")?.value ?? "").toLowerCase();
    const key = decode(
      attribute(tag, "property")?.value ?? attribute(tag, "name")?.value ?? "",
    ).toLowerCase();
    const [what, from] =
      tag.name === "link" && rel.split(/\s+/).includes("canonical")
        ? ["a canonical link", "the page's URL"]
        : tag.name === "meta" && key.startsWith("og:")
          ? ["an Open Graph tag", "the page's title, description and URL"]
          : tag.name === "meta" && key.startsWith("twitter:")
            ? ["a Twitter tag", "the page's title and description"]
            : [];
    if (what) {
      throw fail(
        `this writes ${what}, but Sitez writes it for every page, from ${from}. Remove ${written}`,
      );
    }
  }
  return slots[0]!;
}

/** @prose
 * A page's head, in the frame as its elements rendered it. The page's `title` goes between the
 * frame's `<title>` tags and its `description` in the frame's description, when it has them. Then
 * Sitez's tags go at the end of the head. A redirect gets a refresh, the canonical link of the
 * page it reaches and `noindex`, where a page gets its canonical link and the social tags.
 *
 * The 404 page is served at URLs that aren't its own, so it has no canonical URL and no `og:url`.
 * A title or a description that is the frame's own is read as the frame wrote it, with its
 * entities, so a social tag says what the page does.
 */
export function pageHead(
  html: string,
  page: PageData,
  site: Metadata & { url: string },
  redirect = false,
): string {
  const tags = scan(html);
  const title = tags.find((tag) => tag.kind === "start" && tag.name === "title")!;
  const titleEnd = tags.find(
    (tag) => tag.kind === "end" && tag.name === "title" && tag.start > title.end,
  )!;
  const meta = tags.find(
    (tag) =>
      tag.kind === "start" &&
      tag.name === "meta" &&
      decode(attribute(tag, "name")?.value ?? "").toLowerCase() === "description",
  )!;
  const content = attribute(meta, "content")!;
  const text =
    typeof page.title === "string" ? encode(page.title) : html.slice(title.end, titleEnd.start);
  const description =
    typeof page.description === "string" ? encode(page.description) : content.value!;
  const edits: [number, number, string][] = [];
  if (typeof page.title === "string") edits.push([title.end, titleEnd.start, text]);
  if (typeof page.description === "string") {
    edits.push([
      content.valueStart,
      content.valueEnd,
      content.quoted ? description : `"${description}"`,
    ]);
  }
  let out = html;
  for (const [from, to, value] of edits.toSorted((a, b) => b[0] - a[0])) {
    out = out.slice(0, from) + value + out.slice(to);
  }
  const url = absolute(site.url, page.url);
  const lines: string[] = [];
  const canonical = page.url !== NOT_FOUND ? `<link rel="canonical" href="${encode(url)}">` : "";
  if (redirect) {
    if (canonical) lines.push(canonical);
    lines.push('<meta name="robots" content="noindex">');
    lines.push(`<meta http-equiv="refresh" content="0; url=${encode(page.url)}">`);
  } else {
    if (canonical) lines.push(canonical);
    lines.push(metaTag("property", "og:title", attr(text)));
    lines.push(metaTag("property", "og:description", description));
    if (canonical) lines.push(metaTag("property", "og:url", encode(url)));
    lines.push(metaTag("property", "og:type", "website"));
    lines.push(metaTag("name", "twitter:card", "summary"));
    lines.push(metaTag("name", "twitter:title", attr(text)));
    lines.push(metaTag("name", "twitter:description", description));
  }
  return addToHead(out, lines.join("\n"));
}

/** A `<title>`'s text, which may hold a quote, as an attribute's value. */
const attr = (text: string) => text.replaceAll('"', "&quot;");

const metaTag = (kind: string, key: string, content: string) =>
  `<meta ${kind}="${key}" content="${content}">`;

/** @prose
 * `html` with `text` at the end of its head, or after the description if it has no `</head>`. When
 * `</head>` is on a line of its own, the lines go before it, indented one step more than it is.
 */
export function addToHead(html: string, text: string): string {
  const tags = scan(html);
  const close = tags.find((tag) => tag.kind === "end" && tag.name === "head");
  if (!close) {
    const after = tags.find(
      (tag) =>
        tag.kind === "start" &&
        tag.name === "meta" &&
        decode(attribute(tag, "name")?.value ?? "").toLowerCase() === "description",
    )!.end;
    return `${html.slice(0, after)}\n${text}${html.slice(after)}`;
  }
  const lineStart = html.lastIndexOf("\n", close.start) + 1;
  const indent = html.slice(lineStart, close.start);
  if (!/^[ \t]*$/.test(indent))
    return `${html.slice(0, close.start)}${text}\n${html.slice(close.start)}`;
  const lines = text.split("\n").map((line) => `${indent}  ${line}\n`);
  return html.slice(0, lineStart) + lines.join("") + html.slice(lineStart);
}

/** A page's full address, from `url` in `site.md` with or without its trailing slash. */
export function absolute(siteUrl: string, path: string): string {
  return siteUrl.replace(/\/+$/, "") + path;
}

/** Text as HTML holds it. */
export const escape = encode;
