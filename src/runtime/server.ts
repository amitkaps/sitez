/** @prose
 * # Islands on the server
 *
 * Every component a pattern or prose page imports is rendered through `component()`, which
 * decides what it is on this page (rule 6). The outermost component with browser behavior is the
 * island: it is written inside a `<sitez-island>` marker with its props serialized, so the page's
 * script can hydrate it. Everything inside an island renders as it is, since the browser runs all
 * of it. Everything outside stays HTML, so a function handed to it would never run, and the build
 * fails instead.
 *
 * This file runs in the site's module runner, beside the site's own Svelte, so it can't import
 * Sitez's `SiteError`: it throws an `Error` named `SiteError` with the file, which `render.ts`
 * turns into one.
 */
import { stringify } from 'devalue';
import { getContext, type Component } from 'svelte';
import Island from './Island.svelte';
import IslandWithChildren from './IslandWithChildren.svelte';

/** What the build knows about a component from its source. */
export interface Info {
	/** Its name in the marker: its path in `pattern/`, without `.svelte`. */
	name: string;
	/** The file, as error messages name it. */
	file: string;
	/** Whether it has browser behavior of its own. */
	island: boolean;
	/** The props its `$props()` names, or `null` when it takes them all (`...rest`). */
	reads: string[] | null;
}

/** Where a component renders: inside an island, or inside an island's children. */
type Where = { island: string } | { childrenOf: string };

export const WHERE = 'sitez:island';

type Render = (renderer: unknown, props: Record<string, unknown>) => void;

// Sitez gives every page, layout and element component these; an island gets only what it reads.
const PAGE_PROPS = ['page', 'prose', 'site'];

export function component(
	renderer: unknown,
	props: Record<string, unknown>,
	real: Component,
	info: Info
): void {
	const render = real as unknown as Render;
	const where = getContext<Where | undefined>(WHERE);
	if (where && 'island' in where) return render(renderer, props);
	if (!info.island) {
		/** @prose
		 * Outside an island a component is HTML. One with no behavior of its own that receives an
		 * `on…` function, through a spread the build couldn't see, would drop it silently.
		 */
		const handler = Object.keys(props).find(
			(key) => /^on[a-z]/.test(key) && typeof props[key] === 'function'
		);
		if (handler) {
			fail(
				info.file,
				`${info.name} gets ${handler}, a function, but has no browser behavior of its own, so it renders as HTML and the function would never run. Write ${handler}={…} where the function is made: that component becomes the island.`
			);
		}
		return render(renderer, props);
	}
	if (where && 'childrenOf' in where) {
		fail(
			info.file,
			`${info.name} is an island inside ${where.childrenOf}'s children, which are rendered to HTML before ${where.childrenOf} hydrates. Move it out of the children, or into ${where.childrenOf} itself.`
		);
	}
	const { $$slots: _slots, $$events: _events, children, ...rest } = props;
	if (info.reads?.includes('prose')) {
		fail(
			info.file,
			`${info.name} is an island and reads prose, which would ship every page's metadata to the browser. Compute what it needs in a page, a layout or a component without browser behavior, and pass that to ${info.name} as a prop.`
		);
	}
	const data = Object.fromEntries(
		Object.entries(rest).filter(
			([key]) => !PAGE_PROPS.includes(key) || (info.reads?.includes(key) ?? false)
		)
	);
	let p: string;
	try {
		p = stringify(data);
	} catch (error) {
		const path = (error as { path?: string }).path ?? '';
		fail(
			info.file,
			`${info.name} is an island, and its prop ${path.replace(/^\./, '')} is a function, which can't reach the browser. Pass data instead, or make the function inside ${info.name}.`
		);
	}
	const wrapper = (children ? IslandWithChildren : Island) as unknown as Render;
	wrapper(renderer, { component: real, name: info.name, p, props: data, children });
}

function fail(file: string, message: string): never {
	throw Object.assign(new Error(message), { name: 'SiteError', file });
}
