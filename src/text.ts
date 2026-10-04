/** @prose
 * # Text as HTML
 *
 * A text page is Markz's own HTML, with each element that has a component replaced by that
 * component's output (rule 3). Links are written as the URLs the site serves (rule 4). Everything
 * else comes out exactly as Markz writes it, text, attributes and raw HTML included.
 */
import { html, position, walk, type Document, type NodeData, type NodeId } from "@amitkaps/markz";
import { SiteError } from "./errors.ts";
import type { LinkKind } from "./links.ts";

/** @prose
 * What a text page needs from its site. `component` is the file an element name renders, or
 * nothing when the site has none and the element stays as Markz writes it. `link` is where a link
 * goes, or what is wrong with it (`links.ts`). `render` calls a component with an element's
 * attributes and its rendered content, and returns its HTML.
 */
export interface TextSite {
  component(name: string): string | undefined;
  link(destination: string, kind: LinkKind): { href: string } | { problem: string };
  render(file: string, attributes: Record<string, string>, children?: string): Promise<string>;
}

/** @prose
 * The HTML for one text page, in three steps that keep each exact.
 *
 * 1. Markz writes the HTML from a view of the document. In it, each link's destination is the URL
 *    it's served at, and each element with a component is a marker element. Each raw `=html`
 *    block is a marker too. So the only tags in the output are tags Markz wrote. Links are
 *    rewritten in the AST, so an example in code stays as written.
 * 2. Each element marker is replaced by its component's output, innermost first. So a component's
 *    `children` is its content already rendered, nested components included.
 * 3. Each raw marker is replaced by the block's content, as written.
 *
 * A component gets the element's attributes as strings, as the HTML would have them. Classes
 * accumulate, and any other key's last value wins. Raw HTML is the author's escape hatch, so its
 * JavaScript ships as written and isn't sanitized.
 */
export async function textHtml(file: string, doc: Document, site: TextSite): Promise<string> {
  const components = new Map<string, string | undefined>();
  const swapped = new Map<NodeId, object>();
  const elements: { file: string; attributes: Record<string, string> }[] = [];
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
      const { name } = doc.data(node, "element");
      if (!components.has(name))
        components.set(name, name.includes("-") ? site.component(name) : undefined);
      const component = components.get(name);
      if (!component) return;
      reserved(file, doc, node, name);
      swapped.set(node, { name: `sitez-element-${elements.length}` });
      markers.add(node);
      elements.push({ file: component, attributes: attributesOf(doc, node) });
    },
  });

  let out = html(view(doc, swapped, markers));
  for (let i = elements.length - 1; i >= 0; i--) {
    const [open, close] = [`<sitez-element-${i}>`, `</sitez-element-${i}>`];
    const start = out.indexOf(open);
    const end = out.indexOf(close, start);
    const content = out.slice(start + open.length, end);
    const { file: component, attributes } = elements[i]!;
    const rendered = await site.render(component, attributes, content || undefined);
    out = out.slice(0, start) + rendered + out.slice(end + close.length);
  }
  return out.replace(/<sitez-raw-(\d+)><\/sitez-raw-\1>/g, (_, i: string) => raws[Number(i)]!);
}

const marker = (kind: string, i: number) => `<sitez-${kind}-${i}></sitez-${kind}-${i}>`;

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

/** `call-out` is `CallOut`. Markz requires the hyphen, so every element name has a component name. */
export function componentName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
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
