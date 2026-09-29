/** @prose
 * # Build
 *
 * `sitez build`: every page rendered to complete HTML in `dist/`, with the sitemap and feed, and
 * `public/` copied beside them. Every page's metadata is read before anything renders, because
 * every page and layout gets the whole list (`prose`) and every link is checked against it; then
 * pages render concurrently, each awaiting its own data. Drafts are left out, and so are they
 * from `prose` and from what links can reach, so no page lists or links to what isn't built.
 * Markz's warnings are collected as the prose is read, from `site.md` and every page built, and
 * returned for the command to print.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { parse } from 'markz';
import { discover, nearest, NOT_FOUND, outputFile, type Page } from './discover.ts';
import { SiteError } from './errors.ts';
import { headTags } from './head.ts';
import { renderedLinkProblem, type LinkTargets } from './links.ts';
import { SITE_FILE } from './root.ts';
import {
	isDraft,
	patternMetadata,
	proseMetadata,
	siteMetadata,
	type PageData
} from './metadata.ts';
import { document, renderBody, renderLayout, svelteOf } from './render.ts';
import { feed, sitemap } from './sitemap.ts';
import { siteServer } from './vite.ts';
import { markzWarnings, type MarkzWarning } from './warnings.ts';

export interface Built {
	url: string;
	file: string;
	/** Time to render the page, layout included, in milliseconds. */
	ms: number;
}

export interface BuildResult {
	outDir: string;
	pages: Built[];
	/** Markz's, from `site.md` and every page built, in URL order. */
	warnings: MarkzWarning[];
	ms: number;
}

/** `outDir` is for tests; a site always builds to its own `dist/`. */
export async function build(
	root: string,
	{ outDir = join(root, 'dist') } = {}
): Promise<BuildResult> {
	const start = performance.now();
	const site = siteMetadata(root);
	const siteFile = join(root, SITE_FILE);
	if (typeof site.url !== 'string') {
		throw new SiteError(
			siteFile,
			"there's no url, which the sitemap, the feed and every page's canonical link need. Add the site's address: url: https://example.com"
		);
	}
	const pages = discover(root);

	const warnings = markzWarnings(siteFile, parse(readFileSync(siteFile, 'utf8')));
	const data = new Map<Page, PageData>();
	for (const page of pages) {
		if (page.kind !== 'prose') continue;
		const doc = parse(readFileSync(page.file, 'utf8'));
		const pageData = proseMetadata(page.file, page.url, doc);
		data.set(page, pageData);
		if (!isDraft(pageData)) warnings.push(...markzWarnings(page.file, doc));
	}

	const links: LinkTargets = {
		root,
		repo: stringOf(site.repo),
		pages: new Map(),
		generated: new Set(['/sitemap.xml'])
	};
	const server = await siteServer(root, links);
	let rendered: Rendered[];
	try {
		/** @prose
		 * A Svelte page is a draft only once its module says so, and a prose page's links are
		 * checked as it loads, so every Svelte page's metadata is read before any prose loads.
		 */
		const modules = new Map<Page, Record<string, unknown>>();
		for (const page of pages) {
			if (page.kind !== 'pattern') continue;
			const module = await server.load(page.file);
			modules.set(page, module);
			data.set(page, patternMetadata(page.file, page.url, module.metadata));
		}
		for (const page of pages) links.pages.set(page.url, { draft: isDraft(data.get(page)!) });
		const built = pages.filter((page) => !isDraft(data.get(page)!));
		const prose = built
			.filter((page) => page.kind === 'prose' && page.url !== NOT_FOUND)
			.map((page) => data.get(page)!);
		const hasFeed = built.some((page) => page.url !== NOT_FOUND && data.get(page)!.date);
		if (hasFeed) links.generated.add('/feed.xml');
		const svelte = await svelteOf(server);

		/** @prose
		 * One page: its component, then the page and its layout. A Svelte page's title is known
		 * only once it has rendered, when its `<h1>` can supply it.
		 */
		const renderPage = async (page: Page): Promise<Rendered> => {
			const t = performance.now();
			const module = modules.get(page) ?? (await server.load(page.file));
			let pageData = data.get(page)!;
			const body = await renderBody(svelte, page.file, module.default as never, {
				page: pageData,
				prose,
				site
			});
			if (page.kind === 'pattern' && pageData.title === undefined) {
				pageData = patternMetadata(page.file, page.url, module.metadata, body.body);
			}
			const layoutFile = nearest(root, page.url, 'Layout');
			const layout = layoutFile
				? { file: layoutFile, component: (await server.load(layoutFile)).default as never }
				: undefined;
			const out = await renderLayout(svelte, layout, { page: pageData, prose, site }, body);
			const html = document(site, headTags(pageData, site, hasFeed), out.head, out.body);
			const problem = renderedLinkProblem(links, page.url, html);
			if (problem) {
				throw new SiteError(
					page.file,
					`${problem} The link is in this page, its layout or a component they render.`
				);
			}
			return { url: page.url, file: page.file, data: pageData, html, ms: performance.now() - t };
		};

		rendered = await Promise.all(built.map(renderPage));
	} finally {
		await server.close();
	}

	const files = new Map(rendered.map((page) => [outputFile(page.url), page.html]));
	const all = rendered.map((page) => page.data);
	files.set('sitemap.xml', sitemap(site.url, all));
	const rss = feed(site, site.url, all);
	if (rss) files.set('feed.xml', rss);
	write(root, outDir, files);
	return {
		outDir,
		pages: rendered.map(({ url, file, ms }) => ({ url, file, ms })),
		warnings,
		ms: performance.now() - start
	};
}

type Rendered = Built & { data: PageData; html: string };

/** @prose
 * `dist/` is Sitez's own, so it is emptied first. A file in `public/` where Sitez writes one of
 * its own (a page's HTML, the sitemap, the feed) would be overwritten without anyone noticing, so
 * it fails instead.
 */
function write(root: string, outDir: string, files: Map<string, string>): void {
	const publicDir = join(root, 'public');
	for (const path of files.keys()) {
		const file = join(publicDir, path);
		if (existsSync(file)) {
			throw new SiteError(
				file,
				`Sitez writes ${path.split(sep).join('/')} itself, from ${path.endsWith('.html') ? 'a page' : 'the metadata'}. Rename or remove this file.`
			);
		}
	}
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(outDir, { recursive: true });
	if (existsSync(publicDir)) cpSync(publicDir, outDir, { recursive: true });
	for (const [path, content] of files) {
		const file = join(outDir, path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, content);
	}
}

function stringOf(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}
