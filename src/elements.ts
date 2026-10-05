/** @prose
 * # Elements in HTML
 *
 * An element is the same everywhere (rule 5). One in text, in `code/index.html` or in another
 * element's output renders the same way, and this file is the last two. Text goes through
 * `text.ts`, which calls `renderElement` for each element Markz wrote.
 *
 * An element's markup file writes the inside of its tag, and Sitez writes the tag around it. An
 * `.html` file is its markup as it is, with the element's content where its `<slot>` is. An
 * `.html.js` file is a function of the element's attributes, its content as `children`, and the
 * page. What an element writes is read for elements too, until none is left.
 *
 * An element's content is already rendered when it is called, and it is given to the element as a
 * marker, which is put back once the element's output has rendered. So the output is read for
 * the elements it wrote, never the ones it was handed, and an element isn't rendered twice. An
 * element that ends up inside itself would never end, so it fails, naming the chain.
 */
import { readFileSync } from "node:fs";
import type { Elements } from "./discover.ts";
import { SiteError } from "./errors.ts";
import { decode, scan, type Tag } from "./markup.ts";
import { escape } from "./head.ts";
import type { Props } from "./render.ts";
import { renderModule } from "./render.ts";
import { raw } from "./runtime/html.ts";

/** What rendering an element needs from the site and the page. */
export interface ElementSite {
  elements: Elements;
  load(file: string): Promise<Record<string, unknown>>;
  data(path: string): { value: unknown } | { problem: string };
  props: Props;
}

const PAGE_PROPS = ["page", "pages", "site", "children"];

let counter = 0;

/** @prose
 * What an element writes inside its tag, for these attributes and this content. `content` is
 * HTML that is already rendered, or nothing for an element with none. `data` is read by the
 * caller, who knows where the attribute was written. `chain` is the elements this one is inside,
 * by their output.
 */
export async function renderElement(
  site: ElementSite,
  name: string,
  attributes: Record<string, string>,
  content: string | undefined,
  data: { value: unknown } | undefined,
  chain: string[],
): Promise<string> {
  const markup = site.elements.get(name)?.markup;
  if (!markup) throw new Error(`<${name}> has no markup file`);
  const id = counter++;
  const token = `<sitez-children-${id}></sitez-children-${id}>`;
  let out: string;
  if (markup.kind === "html") {
    out = inSlot(
      markup.file,
      name,
      readFileSync(markup.file, "utf8"),
      content === undefined ? "" : token,
      content !== undefined,
    );
  } else {
    out = await renderModule(markup.file, await site.load(markup.file), {
      ...attributes,
      ...(data && { data: data.value }),
      children: content === undefined ? undefined : raw(token),
      ...site.props,
    });
  }
  const written = await renderElements(site, out.trim(), markup.file, [...chain, name]);
  return written.replaceAll(token, () => content ?? "");
}

/** @prose
 * An `.html` element's content goes where its `<slot>` is. An element given content with no slot
 * would lose it, and one with two would repeat it, so either fails, as a layout that did either
 * would have. An element with no content has an empty slot.
 */
function inSlot(file: string, name: string, markup: string, content: string, has: boolean): string {
  const slots = scan(markup).filter((tag) => tag.kind === "start" && tag.name === "slot");
  if (slots.length > 1 || (has && slots.length === 0)) {
    throw new SiteError(
      file,
      slots.length === 0
        ? `<${name}> is given content, and this has no <slot></slot> for it. Write one where the content goes.`
        : `this has ${slots.length} slots, and <${name}>'s content goes in one. Keep a single <slot></slot>.`,
    );
  }
  const [slot] = slots;
  if (!slot) return markup;
  const close = /^\s*<\/slot\s*>/i.exec(markup.slice(slot.end));
  return markup.slice(0, slot.start) + content + markup.slice(slot.end + (close?.[0].length ?? 0));
}

interface Node {
  name: string;
  open: Tag;
  close?: Tag;
  inside: Node[];
}

/** @prose
 * `html` with each element in it rendered, innermost first. Only a tag with a markup file is an
 * element. One with a hyphen and no file is plain HTML, and so is a tag with none, and both are
 * left as written, with whatever elements they hold rendered. `file` is what wrote `html`, which
 * a failure names, and `chain` is the elements it is the output of.
 */
export async function renderElements(
  site: ElementSite,
  html: string,
  file: string,
  chain: string[],
): Promise<string> {
  const top = nodes(site, html, file);
  if (top.length === 0) return html;
  const render = async (list: Node[], from: number, to: number): Promise<string> => {
    let out = "";
    let at = from;
    for (const node of list) {
      out += html.slice(at, node.open.start);
      const close = node.close!;
      const inner =
        close === node.open ? "" : await render(node.inside, node.open.end, close.start);
      at = close.end;
      out += await written(site, node, inner, file, chain);
    }
    return out + html.slice(at, to);
  };
  return render(top, 0, html.length);
}

/** The elements at the top of `html`, each holding the ones inside it. */
function nodes(site: ElementSite, html: string, file: string): Node[] {
  const top: Node[] = [];
  const open: Node[] = [];
  for (const tag of scan(html)) {
    if (!site.elements.get(tag.name)?.markup) continue;
    if (tag.kind === "start") {
      const node: Node = { name: tag.name, open: tag, inside: [] };
      (open.at(-1)?.inside ?? top).push(node);
      if (tag.selfClosing) node.close = tag;
      else open.push(node);
      continue;
    }
    const at = open.findLastIndex((node) => node.name === tag.name);
    if (at === -1) continue;
    if (at < open.length - 1) throw unclosed(file, open[at + 1]!);
    open.pop()!.close = tag;
  }
  if (open.length > 0) throw unclosed(file, open.at(-1)!);
  return top;
}

function unclosed(file: string, node: Node): SiteError {
  return new SiteError(
    file,
    `<${node.name}> is never closed. Write </${node.name}> after its content, or <${node.name} /> if it has none.`,
  );
}

/** One element, written with its own tag and attributes around what its markup file writes. */
async function written(
  site: ElementSite,
  node: Node,
  inner: string,
  file: string,
  chain: string[],
): Promise<string> {
  const { name } = node;
  if (chain.includes(name)) {
    throw new SiteError(
      file,
      `this writes <${name}>, which ends up inside itself: ${[...chain, name].map((tag) => `<${tag}>`).join(" → ")}. Remove one of them, or the element would never finish.`,
    );
  }
  const tag = `<${name}>`;
  const attributes: Record<string, string> = {};
  for (const { name: key, value } of node.open.attributes) {
    if (!(key in attributes)) attributes[key] = decode(value ?? "");
  }
  const clash = PAGE_PROPS.find((key) => key in attributes);
  if (clash) {
    throw new SiteError(
      file,
      `${tag} has a ${clash} attribute, but every element already gets page, pages, site and children. Rename the attribute.`,
    );
  }
  let data: { value: unknown } | undefined;
  if ("data" in attributes) {
    const found = site.data(attributes.data!);
    if ("problem" in found) throw new SiteError(file, `${tag} ${found.problem}`);
    data = found;
    delete attributes.data;
  }
  const content = inner.trim() === "" ? undefined : inner;
  const html = await renderElement(site, name, attributes, content, data, chain);
  return `${openTag(name, attributes)}${html}</${name}>`;
}

/**
 * An element's opening tag, as Markz writes one: `class` first, a bare attribute with no `=`, and a
 * value escaped. The element is written by Sitez, not by Markz, since its inside is the markup
 * file's.
 */
export function openTag(name: string, attributes: Record<string, string>): string {
  const { class: classes, ...others } = attributes;
  const written = Object.entries(
    classes === undefined ? others : { class: classes, ...others },
  ).map(([key, value]) => (value === "" ? key : `${key}="${escape(value)}"`));
  return `<${[name, ...written].join(" ")}>`;
}
