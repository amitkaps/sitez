/** @prose
 * # Build
 *
 * `sitez build`: every page rendered to complete HTML in `dist/`, with the sitemap and feed, and
 * `public/` copied beside them. Every page's metadata is read before anything renders, because
 * every page and layout gets the whole list (`prose`) and every link is checked against it; then
 * pages render concurrently, each awaiting its own data, and the stylesheet is built from the
 * components they rendered. Drafts are left out, and so are they
 * from `prose` and from what links can reach, so no page lists or links to what isn't built.
 * Markz's warnings are collected as the prose is read, from `site.md` and every page built, and
 * returned for the command to print.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { parse } from '@amitkaps/markz';
import { scripts, stylesheet, type Files } from './bundle.ts';
import { discover, nearest, NOT_FOUND, outputFile, type Page } from './discover.ts';
import { SiteError } from './errors.ts';
import { headTags } from './head.ts';
import { checkNotIsland, type Islands } from './islands.ts';
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
	const islands: Islands = new Map();
	const server = await siteServer(root, links, islands);
	let rendered: Rendered[];
	let components: string[];
	try {
		/** @prose
		 * A Svelte page is a draft only once its module says so, and a prose page's links are
		 * checked as it loads, so every Svelte page's metadata is read before any prose loads.
		 */
		const modules = new Map<Page, Record<string, unknown>>();
		for (const page of pages) {
			if (page.kind !== 'pattern') continue;
			checkNotIsland(page.file, 'page');
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
			if (layoutFile) checkNotIsland(layoutFile, 'layout');
			const layout = layoutFile
				? { file: layoutFile, component: (await server.load(layoutFile)).default as never }
				: undefined;
			const out = await renderLayout(svelte, layout, { page: pageData, prose, site }, body);
			const tags = headTags(pageData, site, hasFeed);
			const problem = renderedLinkProblem(
				links,
				page.url,
				document(site, tags, out.head, out.body)
			);
			if (problem) {
				throw new SiteError(
					page.file,
					`${problem} The link is in this page, its layout or a component they render.`
				);
			}
			return {
				url: page.url,
				file: page.file,
				data: pageData,
				parts: { tags, ...out },
				ms: performance.now() - t
			};
		};

		rendered = await Promise.all(built.map(renderPage));
		components = server.components();
	} finally {
		await server.close();
	}

	/** @prose
	 * The islands a page rendered are the markers in its HTML, so a page's script imports exactly
	 * those. Then every page gets the stylesheet and, if it has islands, its script.
	 */
	const used = new Map<string, string[]>();
	for (const page of rendered) {
		const names = [...page.parts.body.matchAll(/<sitez-island c="([^"]+)"/g)].map((m) => m[1]!);
		if (names.length > 0) used.set(entryName(page.url), [...new Set(names)].sort());
	}
	const css = await stylesheet(root, server.real, components);
	const js = await scripts(root, server.real, used, islands);
	const files: Files = new Map([...css.files, ...js.files]);
	for (const page of rendered) {
		const { tags, head, body } = page.parts;
		const assets = [`<link rel="stylesheet" href="${css.href}">`];
		const script = js.tags.get(entryName(page.url));
		if (script) assets.push(script);
		files.set(outputFile(page.url), document(site, [tags, ...assets].join('\n'), head, body));
	}
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

type Rendered = Built & { data: PageData; parts: { tags: string; head: string; body: string } };

/** @prose
 * `dist/` is Sitez's own, so it is emptied first. A file in `public/` where Sitez writes one of
 * its own (a page's HTML, the sitemap, the feed) would be overwritten without anyone noticing, so
 * it fails instead.
 */
function write(root: string, outDir: string, files: Files): void {
	const publicDir = join(root, 'public');
	for (const path of files.keys()) {
		const file = join(publicDir, path);
		if (existsSync(file)) {
			throw new SiteError(
				file,
				`Sitez writes ${path.split(sep).join('/')} itself, from ${source(path)}. Rename or remove this file.`
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

/** A page's script is named for its HTML file: `blog/index` for `blog/index.html`. */
function entryName(url: string): string {
	return outputFile(url)
		.split(sep)
		.join('/')
		.replace(/\.html$/, '');
}

function source(path: string): string {
	if (path.endsWith('.html')) return 'a page';
	if (path.endsWith('.xml')) return 'the metadata';
	return 'pattern/';
}

function stringOf(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}
