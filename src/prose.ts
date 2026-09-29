/** @prose
 * # Prose as Svelte
 *
 * A prose page reaches the page as a Svelte component, so that everything Svelte does for a
 * pattern (server rendering, scoped styles, islands, hot reload) it does for prose too, with no
 * second renderer. The component is Markz's own HTML with its braces escaped, since Markz never
 * evaluates `${…}` and Svelte would. Step 3 turns its custom elements into components.
 */
import { html, type Document } from 'markz';

export function proseComponent(doc: Document): string {
	// html() writes no script, so a brace can only be text or an attribute value.
	return html(doc).replaceAll('{', '&#123;').replaceAll('}', '&#125;');
}
