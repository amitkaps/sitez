/** @prose
 * # Prose as Svelte
 *
 * A prose page reaches the page as a Svelte component, so that everything Svelte does for a
 * pattern (server rendering, scoped styles, islands, hot reload) it does for prose too, with no
 * second renderer. The component is Markz's own HTML, read as Svelte markup only where prose asks
 * for a pattern: a Markz element with a component of its name (rule 3). Links are written as the
 * URLs the site serves (rule 4). Everything else, text, attributes and raw HTML, comes out exactly
 * as Markz writes it.
 */
import { html, position, walk, type Document, type NodeData, type NodeId } from '@amitkaps/markz';
import { SiteError } from './errors.ts';
import type { LinkKind } from './links.ts';

/** @prose
 * What a prose page needs from its site: the pattern file an element name renders, or nothing
 * when the site has none and the element stays as Markz writes it; and where a link goes, or
 * what is wrong with it (`links.ts`).
 */
export interface ProseSite {
	component(name: string): string | undefined;
	link(destination: string, kind: LinkKind): { href: string } | { problem: string };
}

/** @prose
 * The component source for one prose page, which takes `page`, `prose` and `site` as a Svelte
 * page does.
 *
 * Three steps, in an order that keeps each exact:
 *
 * 1. Markz writes the HTML from a view of the document in which each link's destination is the
 *    URL it's served at, and each raw `=html` block is a marker element, so the only literal
 *    tags in the output are tags Markz wrote. Links are rewritten in the AST, so an example in
 *    code stays as written.
 * 2. Braces become `&#123;` and `&#125;`, since Markz never evaluates `${…}` and Svelte would.
 * 3. An element with a component has its tags renamed (`<call-out>` to `<CallOut>`), and Svelte
 *    passes its attributes as string props and its content as `children`, along with the page's
 *    own `page`, `prose` and `site`: prose can't pass them, and a list of pages is prose's to
 *    place. Each marker becomes `{@html …}` with the block's content, which Svelte writes
 *    verbatim: a raw block's `<script>` is never compiled as the component's script, nor its
 *    `<style>` scoped.
 *
 * Raw HTML is the author's escape hatch, so its JavaScript is their choice: it ships as written,
 * outside the islands and not sanitized, and its links aren't checked.
 */
export function proseComponent(file: string, doc: Document, site: ProseSite): string {
	const components = new Map<string, string | undefined>();
	const hrefs = new Map<NodeId, string>();
	walk(doc, {
		enter(node) {
			const type = doc.type(node);
			if (type === 'link' || type === 'image') {
				const { destination, destinationRange, expressions } = doc.data(node, type);
				if (expressions.length > 0) return;
				const target = site.link(destination, type);
				if ('problem' in target) {
					const { line } = position(doc.source)(destinationRange.start);
					throw new SiteError(file, `line ${line}: ${target.problem}`);
				}
				if (target.href !== destination) hrefs.set(node, target.href);
				return;
			}
			if (type !== 'element') return;
			const { name } = doc.data(node, 'element');
			if (!components.has(name))
				components.set(name, name.includes('-') ? site.component(name) : undefined);
			if (components.get(name)) reserved(file, doc, node, name);
		}
	});

	const { view, raws } = withMarkers(doc, hrefs);
	let out = html(view).replaceAll('{', '&#123;').replaceAll('}', '&#125;');
	const imports: string[] = [];
	for (const [name, pattern] of components) {
		if (!pattern) continue;
		const component = componentName(name);
		imports.push(`\timport ${component} from ${JSON.stringify(pattern)};`);
		// Markz escapes `>` in attribute values, so a tag ends at the first `>`.
		out = out
			.replace(new RegExp(`<${name}(?=[\\s>])`, 'g'), `<${component} {page} {prose} {site}`)
			.replaceAll(`</${name}>`, `</${component}>`);
	}
	out = out.replace(/<sitez-raw-(\d+)><\/sitez-raw-\1>/g, (_, i: string) => {
		// `<\/` keeps a `</script>` in the content from reading as the end of a tag.
		return `{@html ${JSON.stringify(raws[Number(i)]).replaceAll('</', '<\\/')}}`;
	});
	if (imports.length === 0) return out;
	imports.push('\tlet { page, prose, site } = $props();');
	return `<script>\n${imports.join('\n')}\n</script>\n\n${out}`;
}

const PAGE_PROPS = ['page', 'prose', 'site'];

/** @prose
 * An element's component gets `page`, `prose` and `site` as a page does, so an attribute of one
 * of those names would be silently replaced. It fails instead, naming the line.
 */
function reserved(file: string, doc: Document, node: NodeId, name: string): void {
	const clash = doc.attributes(node)?.items.find((item) => PAGE_PROPS.includes(item.key));
	if (!clash) return;
	const { line } = position(doc.source)(clash.start);
	throw new SiteError(
		file,
		`line ${line}: {@${name}} has a ${clash.key} attribute, but every component in prose already gets page, prose and site. Rename the attribute.`
	);
}

/** `call-out` is `CallOut`: Markz requires the hyphen, so every element name has a component name. */
export function componentName(name: string): string {
	return name
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

/** @prose
 * The document as `html()` reads it, through its public accessors, with each link's destination
 * swapped for its `href`, and each raw `=html` block's content for an empty `<sitez-raw-N>`,
 * where N indexes `raws`, the blocks' content. Everything else reads through to the document.
 */
function withMarkers(
	doc: Document,
	hrefs: Map<NodeId, string>
): { view: Document; raws: string[] } {
	const raws: string[] = [];
	const swapped = new Map<NodeId, object>();
	for (const [node, destination] of hrefs) swapped.set(node, { destination });
	walk(doc, {
		enter(node) {
			if (doc.type(node) !== 'raw') return;
			const { format, value } = doc.data(node, 'raw');
			if (format !== 'html') return;
			swapped.set(node, { value: `<sitez-raw-${raws.length}></sitez-raw-${raws.length}>` });
			raws.push(value);
		}
	});
	if (swapped.size === 0) return { view: doc, raws };
	const view = new Proxy(doc, {
		get(target, key) {
			if (key === 'data') {
				return (node: NodeId, type: keyof NodeData) => {
					const data = target.data(node, type);
					const swap = swapped.get(node);
					return swap === undefined ? data : { ...data, ...swap };
				};
			}
			const value: unknown = Reflect.get(target, key, target);
			// Document's accessors read private fields, so they run on the document itself.
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	return { view, raws };
}
