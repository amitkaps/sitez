/** @prose
 * # A run over the site
 *
 * What `build` and `dev` share, so they can't render a page differently: reading the site (its
 * metadata, its pages and every page's metadata, which each page gets as `prose` and every link
 * is checked against), then rendering one page into the parts of its document. `build` reads the
 * site once and renders every page; `dev` reads it again for every request, since any file may
 * have changed, and renders the one asked for. In `dev`, drafts are pages like any other.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@amitkaps/markz';
import { discover, nearest, NOT_FOUND, type Page } from './discover.ts';
import { SiteError } from './errors.ts';
import { headTags } from './head.ts';
import { checkNotIsland } from './islands.ts';
import { renderedLinkProblem, type LinkTargets } from './links.ts';
import {
	isDraft,
	patternMetadata,
	proseMetadata,
	siteMetadata,
	type Metadata,
	type PageData
} from './metadata.ts';
import { document, renderBody, renderLayout, svelteOf } from './render.ts';
import { SITE_FILE } from './root.ts';
import type { SiteServer } from './vite.ts';
import { markzWarnings, type MarkzWarning } from './warnings.ts';

export interface Run {
	root: string;
	site: Metadata & { url: string };
	server: SiteServer;
	links: LinkTargets;
	/** The pages this run writes or serves, in discovery order. */
	pages: Page[];
	data: Map<Page, PageData>;
	prose: PageData[];
	hasFeed: boolean;
	/** Markz's, from `site.md` and every page this run renders. */
	warnings: MarkzWarning[];
	modules: Map<Page, Record<string, unknown>>;
	svelte: Awaited<ReturnType<typeof svelteOf>>;
}

/** One page, rendered: its document's parts, before the stylesheet and scripts are known. */
export interface Rendered {
	url: string;
	file: string;
	ms: number;
	data: PageData;
	parts: { tags: string; head: string; body: string };
	/** The islands the page and its layout rendered, by name, sorted. */
	islands: string[];
}

/** @prose
 * `url` in `site.md` is required: the sitemap, the feed and every canonical link are full
 * addresses, and a relative one would be a guess.
 */
export function readSite(root: string): Metadata & { url: string } {
	const site = siteMetadata(root);
	if (typeof site.url !== 'string') {
		throw new SiteError(
			join(root, SITE_FILE),
			"there's no url, which the sitemap, the feed and every page's canonical link need. Add the site's address: url: https://example.com"
		);
	}
	return site as Metadata & { url: string };
}

/** @prose
 * Every page's metadata, read before anything renders. A Svelte page is a draft only once its
 * module says so, and a prose page's links are checked as it loads, so every Svelte page's
 * metadata is read before any prose loads. The link targets are built whole and only then become
 * the server's, which its prose plugin checks against. Drafts are left out of `build`, and so are
 * they from `prose` and from what links can reach, so no page lists or links to what isn't built.
 * Pages and layouts are checked for browser behavior here, each file once.
 */
export async function readRun(server: SiteServer, { dev = false } = {}): Promise<Run> {
	const { root } = server;
	const site = readSite(root);
	const siteFile = join(root, SITE_FILE);
	const pages = discover(root);
	const draft = (data: PageData) => !dev && isDraft(data);

	const warnings = markzWarnings(siteFile, parse(readFileSync(siteFile, 'utf8')));
	const data = new Map<Page, PageData>();
	for (const page of pages) {
		if (page.kind !== 'prose') continue;
		const doc = parse(readFileSync(page.file, 'utf8'));
		const pageData = proseMetadata(page.file, page.url, doc);
		data.set(page, pageData);
		if (!draft(pageData)) warnings.push(...markzWarnings(page.file, doc));
	}

	const links: LinkTargets = {
		root,
		repo: typeof site.repo === 'string' ? site.repo : undefined,
		pages: new Map(),
		generated: new Set(['/sitemap.xml'])
	};
	const modules = new Map<Page, Record<string, unknown>>();
	for (const page of pages) {
		if (page.kind !== 'pattern') continue;
		checkNotIsland(page.file, 'page');
		const module = await server.load(page.file);
		modules.set(page, module);
		data.set(page, patternMetadata(page.file, page.url, module.metadata));
	}
	for (const page of pages) links.pages.set(page.url, { draft: draft(data.get(page)!) });
	const built = pages.filter((page) => !draft(data.get(page)!));
	const prose = built
		.filter((page) => page.kind === 'prose' && page.url !== NOT_FOUND)
		.map((page) => data.get(page)!);
	const hasFeed = built.some((page) => page.url !== NOT_FOUND && data.get(page)!.date);
	if (hasFeed) links.generated.add('/feed.xml');
	const layouts = new Set(built.map((page) => nearest(root, page.url, 'Layout')));
	for (const layout of layouts) if (layout) checkNotIsland(layout, 'layout');
	server.links = links;
	const svelte = await svelteOf(server);
	return {
		root,
		site,
		server,
		links,
		pages: built,
		data,
		prose,
		hasFeed,
		warnings,
		modules,
		svelte
	};
}

/** @prose
 * One page: its component, then the page and its layout, then every link in the result checked.
 * A Svelte page's title is known only once it has rendered, when its `<h1>` can supply it.
 */
export async function renderPage(run: Run, page: Page): Promise<Rendered> {
	const { root, site, server, prose, svelte } = run;
	const t = performance.now();
	const module = run.modules.get(page) ?? (await server.load(page.file));
	let pageData = run.data.get(page)!;
	const islands = new Set<string>();
	const body = await renderBody(
		svelte,
		page.file,
		module.default as never,
		{ page: pageData, prose, site },
		islands
	);
	if (page.kind === 'pattern' && pageData.title === undefined) {
		pageData = patternMetadata(page.file, page.url, module.metadata, body.body);
	}
	const layoutFile = nearest(root, page.url, 'Layout');
	const layout = layoutFile
		? { file: layoutFile, component: (await server.load(layoutFile)).default as never }
		: undefined;
	const out = await renderLayout(svelte, layout, { page: pageData, prose, site }, body, islands);
	const tags = headTags(pageData, site, run.hasFeed);
	const problem = renderedLinkProblem(
		run.links,
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
		islands: [...islands].sort(),
		ms: performance.now() - t
	};
}
