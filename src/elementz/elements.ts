/** @prose
 * # Elements in HTML
 *
 * An element is the same everywhere (rule 5). One in text, in the host's frame or in another
 * element's output renders the same way. This file renders the last two, and a host's text calls
 * `renderElement` for each element its Markz wrote.
 *
 * An element's template writes the inside of its tag, and elementz writes the tag around it
 * ([elementz.md](../../docs/elementz.md#wrapping)). The template gets `attrs`, the host's context
 * and its script's exports. Its content goes where its `<slot>` is, and the slot's own content is
 * the fallback for an element with none. What an element writes is read for elements too, until
 * none is left.
 *
 * Content is already rendered when an element is called. It goes into the slot as a marker, which
 * is put back once the element's output has rendered. So the output is read for the elements it
 * wrote, never the ones it was handed, and an element isn't rendered twice. An element that ends
 * up inside itself would never end, so it fails, naming the chain.
 */
import { FileError } from "./errors.ts";
import type { ElementFile } from "./file.ts";
import { namedSlot } from "./file.ts";
import { html } from "./html.ts";
import { attribute, decode, encode, scan, type Tag } from "./markup.ts";
import { render } from "./render.ts";

/** What rendering an element needs from its host. */
export interface Host {
  /** Every element, by tag. */
  elements: Map<string, ElementFile>;
  /** The module of an element's template (`templateModule`), whose default export renders it. */
  load(element: ElementFile): Promise<Record<string, unknown>>;
  /** The parsed data a `data` attribute names, or what is wrong with the path. */
  data(path: string): { value: unknown } | { problem: string };
  /** What the host adds to every template's scope, such as `page`. */
  context: Record<string, unknown>;
}

let counter = 0;

/** @prose
 * What an element writes inside its tag, for these attributes and this content. `content` is
 * HTML that is already rendered, or nothing for an element with none. `data` is read by the
 * caller, who knows where the attribute was written. `chain` is the elements this one is inside,
 * by their output. An element with no template writes its content as it is.
 */
export async function renderElement(
  host: Host,
  name: string,
  attributes: Record<string, string>,
  content: string | undefined,
  data: { value: unknown } | undefined,
  chain: string[],
): Promise<string> {
  const element = host.elements.get(name);
  if (!element) throw new Error(`<${name}> has no element file`);
  if (!element.template) return content ?? "";
  const { file } = element;
  const id = counter++;
  const token = `<elementz-content-${id}></elementz-content-${id}>`;
  const fn = (await host.load(element)).default as (scope: object) => unknown;
  const attrs = { ...attributes, ...(data && { data: data.value }) };
  const out = inSlot(
    element,
    rendered(file, () => fn({ ...host.context, attrs, html })),
    content && token,
  );
  const written = await renderElements(host, out, file, [...chain, name]);
  return written.replaceAll(token, () => content ?? "");
}

/** @prose
 * A template that throws is a mistake in the site, not in elementz, so the build fails naming the
 * element's file. A template the renderer refuses says why in its own words. The result is
 * trimmed, so a template written across lines can still sit inside a paragraph.
 */
function rendered(file: string, fn: () => unknown): string {
  try {
    return render(fn()).trim();
  } catch (error) {
    if (error instanceof FileError) throw error;
    const { name, message } = error instanceof Error ? error : { name: "", message: String(error) };
    if (name === "TemplateError") throw new FileError(file, message, { cause: error });
    throw new FileError(file, `failed to render: ${message}`, { cause: error });
  }
}

/** @prose
 * An element's content goes where its `<slot>` is, in place of the slot's own content, which is
 * the fallback. The slot is found in what the template wrote, so one in a helper's `html` counts.
 * An element given content with no slot would lose it, and one with two would repeat it, so either
 * fails, as a frame that did either would.
 */
function inSlot(element: ElementFile, out: string, content: string | undefined): string {
  const { file, name } = element;
  const tags = scan(out);
  const slots = tags.filter((tag) => tag.kind === "start" && tag.name === "slot");
  if (slots.some((slot) => attribute(slot, "name"))) throw new FileError(file, namedSlot);
  if (slots.length > 1 || (content !== undefined && slots.length === 0)) {
    throw new FileError(
      file,
      slots.length === 0
        ? `<${name}> is given content, and its template has no <slot></slot> for it. Write one where the content goes.`
        : `the template writes ${slots.length} slots, and <${name}>'s content goes in one. Keep a single <slot></slot>.`,
    );
  }
  const [slot] = slots;
  if (!slot) return out;
  const close = slot.selfClosing
    ? undefined
    : tags.find((tag) => tag.kind === "end" && tag.name === "slot" && tag.start >= slot.end);
  const fallback = close ? out.slice(slot.end, close.start) : "";
  return out.slice(0, slot.start) + (content ?? fallback) + out.slice(close?.end ?? slot.end);
}

interface Node {
  name: string;
  open: Tag;
  close?: Tag;
  inside: Node[];
}

/** @prose
 * `html` with each element in it rendered, innermost first. Only a tag with an element file is an
 * element. One with a hyphen and no file is plain HTML, and so is a tag with none, and both are
 * left as written, with whatever elements they hold rendered. `file` is what wrote `html`, which
 * a failure names, and `chain` is the elements it is the output of.
 */
export async function renderElements(
  host: Host,
  html: string,
  file: string,
  chain: string[],
): Promise<string> {
  const top = nodes(host, html, file);
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
      out += await written(host, node, inner, file, chain);
    }
    return out + html.slice(at, to);
  };
  return render(top, 0, html.length);
}

/** The elements at the top of `html`, each holding the ones inside it. */
function nodes(host: Host, html: string, file: string): Node[] {
  const top: Node[] = [];
  const open: Node[] = [];
  for (const tag of scan(html)) {
    if (!host.elements.has(tag.name)) continue;
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

function unclosed(file: string, node: Node): FileError {
  return new FileError(
    file,
    `<${node.name}> is never closed. Write </${node.name}> after its content, or <${node.name} /> if it has none.`,
  );
}

/** One element, written with its own tag and attributes around what its template writes. */
async function written(
  host: Host,
  node: Node,
  inner: string,
  file: string,
  chain: string[],
): Promise<string> {
  const { name } = node;
  if (chain.includes(name)) {
    throw new FileError(
      file,
      `this writes <${name}>, which ends up inside itself: ${[...chain, name].map((tag) => `<${tag}>`).join(" → ")}. Remove one of them, or the element would never finish.`,
    );
  }
  const attributes: Record<string, string> = {};
  for (const { name: key, value } of node.open.attributes) {
    if (!(key in attributes)) attributes[key] = decode(value ?? "");
  }
  let data: { value: unknown } | undefined;
  if ("data" in attributes) {
    const found = host.data(attributes.data!);
    if ("problem" in found) throw new FileError(file, `<${name}> ${found.problem}`);
    data = found;
    delete attributes.data;
  }
  const content = inner.trim() === "" ? undefined : inner;
  const out = await renderElement(host, name, attributes, content, data, chain);
  return `${openTag(name, attributes)}${out}</${name}>`;
}

/**
 * An element's opening tag, as Markz writes one: `class` first, a bare attribute with no `=`, and a
 * value escaped. The element is written by elementz, not by Markz, since its inside is the
 * template's.
 */
export function openTag(name: string, attributes: Record<string, string>): string {
  const { class: classes, ...others } = attributes;
  const written = Object.entries(
    classes === undefined ? others : { class: classes, ...others },
  ).map(([key, value]) => (value === "" ? key : `${key}="${encode(value)}"`));
  return `<${[name, ...written].join(" ")}>`;
}
