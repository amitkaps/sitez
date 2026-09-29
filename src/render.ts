/** @prose
 * # Rendering a page
 *
 * A page becomes one complete HTML document: the page rendered, its title found, then its layout
 * rendered around it (rule 2) and the whole wrapped in the document every page shares. The page
 * renders first, on its own, because a Svelte page's title can come from its own `<h1>` and the
 * layout needs that title. Everything awaits (rule 5), so the HTML is finished when it's written.
 * The head's title, description and links come from metadata, never from a pattern.
 */
import type { Component, Snippet } from 'svelte';
import { SiteError } from './errors.ts';
import { checkHead, escape } from './head.ts';
import type { Metadata, PageData } from './metadata.ts';
import type { SiteServer } from './vite.ts';

export interface Props {
	page: PageData;
	prose: PageData[];
	site: Metadata;
}

interface Svelte {
	render: (
		component: Component<any>,
		options: { props: object }
	) => PromiseLike<{ head: string; body: string }>;
	createRawSnippet: (fn: () => { render: () => string }) => Snippet;
}

// Where the page goes in its layout's HTML: one element, as a raw snippet needs.
const slot = '<sitez-body></sitez-body>';

/** @prose
 * Svelte comes through the module runner, so the page, its layout and the renderer share one
 * copy of it.
 */
export async function svelteOf(server: SiteServer): Promise<Svelte> {
	const [{ render }, { createRawSnippet }] = await Promise.all([
		server.vite.ssrLoadModule('svelte/server'),
		server.vite.ssrLoadModule('svelte')
	]);
	return { render, createRawSnippet } as Svelte;
}

export async function renderBody(
	svelte: Svelte,
	file: string,
	component: Component<any>,
	props: Props
): Promise<{ head: string; body: string }> {
	const out = await guard(file, () => svelte.render(component, { props }));
	checkHead(file, out.head);
	return out;
}

/** @prose
 * The layout renders with a placeholder for its children, and the page's HTML replaces it. A
 * layout that doesn't render its children, or renders them twice, fails the build: either way the
 * page would silently not be what its file says.
 */
export async function renderLayout(
	svelte: Svelte,
	layout: { file: string; component: Component<any> } | undefined,
	props: Props,
	page: { head: string; body: string }
): Promise<{ head: string; body: string }> {
	if (!layout) return page;
	const children = svelte.createRawSnippet(() => ({ render: () => slot }));
	const out = await guard(layout.file, () =>
		svelte.render(layout.component, { props: { ...props, children } })
	);
	checkHead(layout.file, out.head);
	const count = out.body.split(slot).length - 1;
	if (count !== 1) {
		throw new SiteError(
			layout.file,
			count === 0
				? `this layout doesn't render its page. Add {@render children()} where ${props.page.url} goes.`
				: `this layout renders its page ${count} times. Keep one {@render children()}.`
		);
	}
	return { head: out.head + page.head, body: out.body.replace(slot, () => page.body) };
}

/** @prose
 * The document every page shares, in the site's `lang`: Sitez's head tags from the page's
 * metadata (`head.ts`), then whatever the page and its layout put in `<svelte:head>`.
 */
export function document(site: Metadata, tags: string, head: string, body: string): string {
	return `<!doctype html>
<html lang="${escape(String(site.lang))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tags}
${head}
</head>
<body>
${body}
</body>
</html>
`;
}

/** @prose
 * A pattern that throws while rendering is a mistake in the site, not in Sitez: the build fails
 * naming the file that was rendering, or the one an island's check names, since the error's own stack names the module it came from
 * (the data module, for a failed `await`), not the page.
 */
async function guard<T>(file: string, fn: () => PromiseLike<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof SiteError) throw error;
		// Sitez's runtime runs beside the site's modules, where Sitez's own class isn't.
		const { name, file: named, message: text } = error as Record<string, unknown>;
		if (name === 'SiteError' && typeof named === 'string') {
			throw new SiteError(named, String(text), { cause: error });
		}
		const message = error instanceof Error ? error.message : String(error);
		throw new SiteError(file, `failed to render: ${message}`, { cause: error });
	}
}
