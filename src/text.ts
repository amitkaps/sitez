/** @prose
 * # Text as HTML
 *
 * A text page is Markz's own HTML, with the inside of each element that has a component replaced by
 * that component's output (rule 5). Links are written as the URLs the site serves (rule 4).
 * Everything else comes out exactly as Markz writes it, text, attributes and raw HTML included.
 */
import { html, position, walk, type Document, type NodeData, type NodeId } from "@amitkaps/markz";
import { SiteError } from "./errors.ts";
import { escape } from "./head.ts";
import type { LinkKind } from "./links.ts";

/** @prose
 * What a text page needs from its site. `component` is the file an element name renders, or
 * nothing when the site has none and the element stays as Markz writes it. `link` is where a link
 * goes, or what is wrong with it (`links.ts`). `data` is the parsed JSON a `data` attribute names,
 * or what is wrong with the path (`data.ts`). `render` calls a component with an element's
 * attributes, its rendered content and its data, and returns the HTML it writes inside the element.
 */
export interface TextSite {
  component(name: string): string | undefined;
  link(destination: string, kind: LinkKind): { href: string } | { problem: string };
  data(path: string): { value: unknown } | { problem: string };
  render(
    file: string,
    attributes: Record<string, string>,
    children?: string,
    data?: { value: unknown },
  ): Promise<string>;
}

/** @prose
 * The HTML for one text page, in three steps that keep each exact.
 *
 * 1. Markz writes the HTML from a view of the document. In it, each link's destination is the URL
 *    it's served at, and each element with a component is a marker element. Each raw `=html`
 *    block is a marker too. So the only tags in the output are tags Markz wrote. Links are
 *    rewritten in the AST, so an example in code stays as written.
 * 2. Each element marker is replaced by the element, written with its own name and attributes
 *    around its component's output. Markers go innermost first, so a component's `children` is its
 *    content already rendered, nested components included.
 * 3. Each raw marker is replaced by the block's content, as written.
 *
 * A component gets the element's attributes as strings, as the HTML would have them. Classes
 * accumulate, and any other key's last value wins. A `data` attribute is read first, and the
 * component gets what it parses to instead, so the page doesn't carry it. Raw HTML is the
 * author's escape hatch, so its JavaScript ships as written and isn't sanitized.
 */
export async function textHtml(file: string, doc: Document, site: TextSite): Promise<string> {
  const components = new Map<string, string | undefined>();
  const swapped = new Map<NodeId, object>();
  const elements: {
    node: NodeId;
    name: string;
    file: string;
    attributes: Record<string, string>;
    data?: { value: unknown };
    inline: boolean;
  }[] = [];
  const markers = new Set<NodeId>();
  const raws: string[] = [];
  walk(doc, {
    enter(node) {
      const type = doc.type(node);
      if (type === "link" || type === "image") {
        const { destination, destinationRange, expressions } = doc.data(node, type);
        if (expressions.length > 0) return;
        const target = site.link(destination, type);
        if ("problem" in target) {
          const { line } = position(doc.source)(destinationRange.start);
          throw new SiteError(file, `line ${line}: ${target.problem}`);
        }
        if (target.href !== destination) swapped.set(node, { destination: target.href });
        return;
      }
      if (type === "raw") {
        const { format, value } = doc.data(node, "raw");
        if (format !== "html") return;
        swapped.set(node, { value: marker("raw", raws.length) });
        raws.push(value);
        return;
      }
      if (type !== "element") return;
      const { name, kind } = doc.data(node, "element");
      if (!components.has(name))
        components.set(name, name.includes("-") ? site.component(name) : undefined);
      const component = components.get(name);
      if (!component) return;
      reserved(file, doc, node, name);
      const attributes = attributesOf(doc, node);
      let data: { value: unknown } | undefined;
      if ("data" in attributes) {
        const found = site.data(attributes.data!);
        if ("problem" in found) {
          const start = doc.attributes(node)!.items.findLast((item) => item.key === "data")!.start;
          throw new SiteError(file, `line ${position(doc.source)(start).line}: ${found.problem}`);
        }
        data = found;
        delete attributes.data;
      }
      swapped.set(node, { name: `sitez-element-${elements.length}` });
      markers.add(node);
      elements.push({ node, name, file: component, attributes, data, inline: kind === "inline" });
    },
  });

  let out = html(view(doc, swapped, markers));
  for (let i = elements.length - 1; i >= 0; i--) {
    const [open, close] = [`<sitez-element-${i}>`, `</sitez-element-${i}>`];
    const start = out.indexOf(open);
    const end = out.indexOf(close, start);
    const content = out.slice(start + open.length, end);
    const { node, name, file: component, attributes, data, inline } = elements[i]!;
    const inner = await site.render(component, attributes, content || undefined, data);
    if (inline) paragraphSafe(file, doc, node, name, inner);
    const element = `${openTag(name, attributes)}${inner}</${name}>`;
    out = out.slice(0, start) + element + out.slice(end + close.length);
  }
  return out.replace(/<sitez-raw-(\d+)><\/sitez-raw-\1>/g, (_, i: string) => raws[Number(i)]!);
}

const marker = (kind: string, i: number) => `<sitez-${kind}-${i}></sitez-${kind}-${i}>`;

/** @prose
 * An inline element's output can't hold a start tag that closes a paragraph
 * ([docs/design.md#wrapping](docs/design.md#wrapping)). These are the tags the HTML parser closes an
 * open `<p>` for, so the build fails exactly where a browser would break the page. The check runs on
 * every inline element, inside a paragraph or not, since a tag means the same wherever it's used.
 */
const CLOSING_TAGS =
  "address article aside blockquote center details dialog dir div dl fieldset figcaption figure " +
  "footer header hgroup main menu nav ol p search section summary ul h[1-6] pre listing form li " +
  "dd dt plaintext table hr xmp";
const CLOSES_P = new RegExp(`<(${CLOSING_TAGS.split(" ").join("|")})(?=[\\s/>])`, "i");

function paragraphSafe(file: string, doc: Document, node: NodeId, name: string, out: string): void {
  const tag = CLOSES_P.exec(out)?.[1];
  if (!tag) return;
  const { line } = position(doc.source)(doc.start(node));
  throw new SiteError(
    file,
    `line ${line}: {@${name}} is used inline, but its component writes a <${tag.toLowerCase()}>, which ends a paragraph. Return inline HTML, such as a <span>.`,
  );
}

const PAGE_PROPS = ["page", "pages", "site", "children"];

/** @prose
 * An element's component gets `page`, `pages` and `site` as a page does, and its content as
 * `children`. So an attribute of one of those names would be silently replaced. It fails instead,
 * naming the line.
 */
function reserved(file: string, doc: Document, node: NodeId, name: string): void {
  const clash = doc.attributes(node)?.items.find((item) => PAGE_PROPS.includes(item.key));
  if (!clash) return;
  const { line } = position(doc.source)(clash.start);
  throw new SiteError(
    file,
    `line ${line}: {@${name}} has a ${clash.key} attribute, but every component in text already gets page, pages, site and children. Rename the attribute.`,
  );
}

function attributesOf(doc: Document, node: NodeId): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const { key, value } of doc.attributes(node)?.items ?? []) {
    attributes[key] = key === "class" && attributes.class ? `${attributes.class} ${value}` : value;
  }
  return attributes;
}

/** @prose
 * An element's opening tag, as Markz writes one: `class` first, a bare attribute with no `=`, and a
 * value escaped. The element is written by Sitez, not by Markz, since its inside is the
 * component's.
 */
function openTag(name: string, attributes: Record<string, string>): string {
  const { class: classes, ...others } = attributes;
  const written = Object.entries(
    classes === undefined ? others : { class: classes, ...others },
  ).map(([key, value]) => (value === "" ? key : `${key}="${escape(value)}"`));
  return `<${[name, ...written].join(" ")}>`;
}

/** @prose
 * The document as `html()` reads it, through its public accessors, with each swapped node's data
 * overlaid. An element marker also drops its attributes, which its component gets as props.
 * Everything else reads through to the document.
 */
function view(doc: Document, swapped: Map<NodeId, object>, markers: Set<NodeId>): Document {
  if (swapped.size === 0) return doc;
  return new Proxy(doc, {
    get(target, key) {
      if (key === "data") {
        return (node: NodeId, type: keyof NodeData) => {
          const data = target.data(node, type);
          const swap = swapped.get(node);
          return swap === undefined ? data : { ...data, ...swap };
        };
      }
      if (key === "attributes") {
        return (node: NodeId) => (markers.has(node) ? undefined : target.attributes(node));
      }
      const value: unknown = Reflect.get(target, key, target);
      // Document's accessors read private fields, so they run on the document itself.
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
