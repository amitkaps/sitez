/** @prose
 * # Islands in the browser
 *
 * A page's script: each `<sitez-island>` marker's component, hydrated with its props. Its
 * children are already in the page, so the component gets them back as the same HTML, and
 * hydration keeps the nodes it finds.
 */
import { parse } from 'devalue';
import { createRawSnippet, hydrate, type Component } from 'svelte';

export function hydrateIslands(components: Record<string, Component<any>>): void {
	for (const island of document.querySelectorAll('sitez-island')) {
		const component = components[island.getAttribute('c') ?? ''];
		if (!component) continue;
		const props = parse(island.getAttribute('p') ?? '{}') as Record<string, unknown>;
		const kept = island.querySelector('sitez-children');
		if (kept) {
			const html = kept.outerHTML;
			props.children = createRawSnippet(() => ({ render: () => html }));
		}
		hydrate(component, { target: island, props });
	}
}
