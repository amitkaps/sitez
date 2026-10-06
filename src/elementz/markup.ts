/** @prose
 * # Reading HTML's tags
 *
 * Where the tags are in a piece of HTML, with their attributes. HTML is read in three places,
 * which are the host's frame (Sitez's `code/index.html`), an element file and an element's
 * output. It isn't an HTML
 * parser and checks no nesting. It finds each start and end tag the way the HTML tokenizer would,
 * so a `<` in a comment, in an attribute's value, or in a `<script>`, `<style>`, `<textarea>` or
 * `<title>` is text. Everything else, such as which elements close which, is the browser's.
 *
 * A caller changes the HTML by slicing at the offsets, so nothing is written back that wasn't
 * read, and a page keeps the spacing its author gave it.
 */

/** One attribute of a start tag, with where its value sits so a caller can replace it. */
export interface Attribute {
  /** Lowercase, as HTML names attributes. */
  name: string;
  /** The value as written, with its entities. A bare attribute has none. */
  value: string | undefined;
  /** Where the value starts and ends, without its quotes, or `-1` for a bare attribute. */
  valueStart: number;
  valueEnd: number;
  quoted: boolean;
}

export interface Tag {
  kind: "start" | "end";
  /** Lowercase. */
  name: string;
  /** From the `<` to just after the `>`. */
  start: number;
  end: number;
  attributes: Attribute[];
  /** Written `<x />`. HTML ignores the slash on a custom element, and Sitez reads it as empty. */
  selfClosing: boolean;
}

const START =
  /<([a-zA-Z][^\s/>]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?|\s*\/(?!>))*)\s*(\/?)>/y;
const END = /<\/([a-zA-Z][^\s/>]*)[^>]*>/y;
const ATTRIBUTE = /\s+([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/g;
// Elements whose content is text, so a `<` in it starts nothing.
const RAW = new Set(["script", "style", "textarea", "title"]);

/** Every start and end tag of `html`, in order. */
export function scan(html: string): Tag[] {
  const tags: Tag[] = [];
  let at = 0;
  while ((at = html.indexOf("<", at)) !== -1) {
    if (html.startsWith("<!--", at)) {
      const close = html.indexOf("-->", at + 4);
      at = close === -1 ? html.length : close + 3;
      continue;
    }
    if (html[at + 1] === "!" || html[at + 1] === "?") {
      const close = html.indexOf(">", at);
      at = close === -1 ? html.length : close + 1;
      continue;
    }
    END.lastIndex = at;
    const end = END.exec(html);
    if (end) {
      tags.push({
        kind: "end",
        name: end[1]!.toLowerCase(),
        start: at,
        end: at + end[0].length,
        attributes: [],
        selfClosing: false,
      });
      at += end[0].length;
      continue;
    }
    START.lastIndex = at;
    const start = START.exec(html);
    if (!start) {
      at++;
      continue;
    }
    const name = start[1]!.toLowerCase();
    const attributes = attributesOf(start[2]!, at + 1 + start[1]!.length);
    tags.push({
      kind: "start",
      name,
      start: at,
      end: at + start[0].length,
      attributes,
      selfClosing: start[3] === "/",
    });
    at += start[0].length;
    if (RAW.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, at);
      at = close === -1 ? html.length : close;
    }
  }
  return tags;
}

function attributesOf(source: string, offset: number): Attribute[] {
  const attributes: Attribute[] = [];
  for (const match of source.matchAll(ATTRIBUTE)) {
    const [whole, name = "", double, single, bare] = match;
    const value = double ?? single ?? bare;
    const quoted = double !== undefined || single !== undefined;
    const end = offset + match.index + whole.length;
    attributes.push({
      name: name.toLowerCase(),
      value,
      valueStart: value === undefined ? -1 : end - value.length - (quoted ? 1 : 0),
      valueEnd: value === undefined ? -1 : end - (quoted ? 1 : 0),
      quoted,
    });
  }
  return attributes;
}

/** The attribute `name` of a start tag, which is the first one written, as in HTML. */
export function attribute(tag: Tag, name: string): Attribute | undefined {
  return tag.attributes.find((attribute) => attribute.name === name);
}

/** An attribute's value as the browser reads it: the entities decoded. */
export function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower[0] === "#") {
      const code = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[lower]!;
  });
}

/** A value as an attribute holds it, in double quotes. */
export function encode(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** `html` with an attribute's value replaced by `value`, which is already encoded. */
export function withValue(html: string, found: Attribute, value: string): string {
  const text = found.quoted ? value : `"${value}"`;
  return html.slice(0, found.valueStart) + text + html.slice(found.valueEnd);
}
