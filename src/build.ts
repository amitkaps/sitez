/** @prose
 * # Build
 *
 * `sitez build`: every page rendered to complete HTML in `dist/`, and `public/` copied beside
 * them. Prose metadata is read before anything renders, because every page and layout gets the
 * whole list (`prose`); then pages render concurrently, each awaiting its own data. Drafts are
 * left out, and so are they from `prose`, so no page lists what isn't built.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse } from 'markz';
import { discover, layoutFor, type Page } from './discover.ts';
import { SiteError } from './errors.ts';
import {
	isDraft,
	patternMetadata,
	proseMetadata,
	siteMetadata,
	type PageData
} from './metadata.ts';
import { document, renderBody, renderLayout, svelteOf } from './render.ts';
import { siteServer } from './vite.ts';

export interface Built {
	url: string;
	file: string;
	/** Time to render the page, layout included, in milliseconds. */
	ms: number;
}

export interface BuildResult {
	outDir: string;
	pages: Built[];
	ms: number;
}

/** `outDir` is for tests; a site always builds to its own `dist/`. */
export async function build(
	root: string,
	{ outDir = join(root, 'dist') } = {}
): Promise<BuildResult> {
	const start = performance.now();
	const site = siteMetadata(root);
	const pages = discover(root);

	const proseData = new Map<Page, PageData>();
	for (const page of pages) {
		if (page.kind !== 'prose') continue;
		proseData.set(page, proseMetadata(page.file, page.url, parse(readFileSync(page.file, 'utf8'))));
	}
	const prose = [...proseData.values()].filter((page) => !isDraft(page));

	const server = await siteServer(root);
	let rendered: ({ html: string } & Built)[];
	try {
		const svelte = await svelteOf(server);

		/** @prose
		 * One page: its module, its metadata (a Svelte page's is known only once it's loaded, and
		 * its title only once it's rendered), then the page and its layout.
		 */
		const renderPage = async (page: Page) => {
			const t = performance.now();
			const module = await server.load(page.file);
			let data = proseData.get(page) ?? patternMetadata(page.file, page.url, module.metadata);
			if (isDraft(data)) return undefined;
			const body = await renderBody(svelte, page.file, module.default as never, {
				page: data,
				prose,
				site
			});
			if (page.kind === 'pattern' && data.title === undefined) {
				data = patternMetadata(page.file, page.url, module.metadata, body.body);
			}
			const layoutFile = layoutFor(root, page.url);
			const layout = layoutFile
				? { file: layoutFile, component: (await server.load(layoutFile)).default as never }
				: undefined;
			const out = await renderLayout(svelte, layout, { page: data, prose, site }, body);
			const title = data.title ?? (typeof site.name === 'string' ? site.name : '');
			const html = document(title, out.head, out.body);
			return { url: page.url, file: page.file, html, ms: performance.now() - t };
		};

		rendered = (await Promise.all(pages.map(renderPage))).filter((page) => page !== undefined);
	} finally {
		await server.close();
	}

	write(root, outDir, rendered);
	return {
		outDir,
		pages: rendered.map(({ url, file, ms }) => ({ url, file, ms })),
		ms: performance.now() - start
	};
}

/** @prose
 * `dist/` is Sitez's own, so it is emptied first. A file in `public/` where a page's HTML goes
 * would be overwritten without anyone noticing, so it fails instead.
 */
function write(root: string, outDir: string, pages: ({ html: string } & Built)[]): void {
	const publicDir = join(root, 'public');
	for (const page of pages) {
		const file = join(publicDir, page.url, 'index.html');
		if (existsSync(file)) {
			throw new SiteError(
				file,
				`this would overwrite the page ${page.url} from ${relative(root, page.file)}. Rename or remove one of them.`
			);
		}
	}
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(outDir, { recursive: true });
	if (existsSync(publicDir)) cpSync(publicDir, outDir, { recursive: true });
	for (const page of pages) {
		const file = join(outDir, page.url, 'index.html');
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, page.html);
	}
}
