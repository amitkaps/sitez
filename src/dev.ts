/** @prose
 * # Dev
 *
 * `sitez dev`: every page, drafts included, rendered when it's asked for, by the same code as
 * `build` (`site.ts`), so a page can't look one way here and another in `dist/`. The site is read
 * again for every page, so a new or deleted file is a new or missing URL at once, with nothing to
 * restart. A change reloads the page, except to CSS and to an island, which Vite and Svelte
 * replace in place. A mistake shows in the browser as the message `build` would print, and the
 * page reloads when it's fixed.
 */
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, relative } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { NOT_FOUND } from './discover.ts';
import { SiteError } from './errors.ts';
import { escape } from './head.ts';
import type { Islands } from './islands.ts';
import { document } from './render.ts';
import { pathOf } from './preview.ts';
import { islandsIn, linkTargets, readRun, renderPage, type Run } from './site.ts';
import { feed, sitemap } from './sitemap.ts';
import { runtime, siteServer, type SiteServer } from './vite.ts';
import { formatWarning, type MarkzWarning } from './warnings.ts';

export interface Dev {
	/** Where the site is served, such as `http://localhost:5173/`. */
	url: string;
	close(): Promise<void>;
}

export interface DevOptions {
	port?: number;
	/** Where `sitez` runs, which messages name files from. */
	cwd?: string;
	/** Prints a Markz warning, once per warning. */
	warn?: (line: string) => void;
	/** Prints a page's failure, as the browser shows it. */
	error?: (line: string) => void;
}

export async function dev(
	root: string,
	{ port = 5173, cwd = root, warn = () => {}, error: report = () => {} }: DevOptions = {}
): Promise<Dev> {
	const links = linkTargets(root);
	const islands: Islands = new Map();
	// What each page's script loads: its islands, from its last render.
	const rendered = new Map<string, string[]>();
	const warned = new Set<string>();
	const state = { server: undefined as SiteServer | undefined };

	const shown = (file: string) => relative(cwd, file) || file;
	const failed = (error: unknown) => {
		const text = errorText(error, shown);
		report(text);
		return errorPage(text);
	};
	// One request reads and renders at a time: reading the site refills the link targets that
	// rendering checks against. Overlapping requests happen not to see them half-filled today,
	// only because of how their awaits resolve; this makes it not depend on that.
	let queue: Promise<unknown> = Promise.resolve();
	const oneAtATime = (work: () => Promise<unknown>): Promise<unknown> => {
		const done = queue.then(work, work);
		queue = done.catch(() => {});
		return done;
	};
	const newWarnings = (warnings: MarkzWarning[]) => {
		for (const warning of warnings) {
			const line = formatWarning(warning, shown);
			if (warned.has(line)) continue;
			warned.add(line);
			warn(line);
		}
	};

	/** @prose
	 * A page's document: rendered as `build` renders it, with Vite's client and the page's own
	 * script in place of the built stylesheet and islands.
	 */
	const page = async (run: Run, url: string): Promise<string | undefined> => {
		const found = run.pages.find((page) => page.url === url);
		if (!found) return undefined;
		const out = await renderPage(run, found);
		rendered.set(url, islandsIn(out.parts.body));
		const assets = [
			'<script type="module" src="/@vite/client"></script>',
			`<script type="module" src="${ENTRY}?url=${encodeURIComponent(url)}"></script>`
		];
		const { tags, head, body } = out.parts;
		return document(run.site, [tags, ...assets].join('\n'), head, body);
	};

	/** @prose
	 * A page's script in dev: the stylesheet as modules, so Vite replaces them as they change,
	 * then the page's islands, hydrated as in `build`. A component's styles come from the module
	 * Svelte compiled them into, never from the component itself, which may import what only runs
	 * on the server.
	 */
	const entry = (url: string): string => {
		const server = state.server!;
		const style = join(server.real, 'pattern', 'style.css');
		const used = rendered.get(url) ?? [];
		const client = JSON.stringify(join(runtime, 'client.ts'));
		return [
			`import ${JSON.stringify(join(runtime, 'reset.css'))};`,
			...(existsSync(style) ? [`import ${JSON.stringify(style)};`] : []),
			...server
				.components()
				.map((file) => `import ${JSON.stringify(`${file}?svelte&type=style&lang.css`)};`),
			`import { hydrateIslands } from ${client};`,
			...used.map((island, i) => `import I${i} from ${JSON.stringify(islands.get(island))};`),
			`hydrateIslands({ ${used.map((island, i) => `${JSON.stringify(island)}: I${i}`).join(', ')} });`
		].join('\n');
	};

	/** @prose
	 * Pages first, before Vite's own middleware. `/about` redirects to `/about/`, as a static host
	 * would; the sitemap and the feed are written from the metadata, as `build` writes them; any
	 * other request that isn't a page is Vite's: a module, a file in `public/`. What nothing
	 * serves gets the 404 page, with a 404 status.
	 */
	const serve = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
		if (request.method !== 'GET' && request.method !== 'HEAD') return next();
		const url = new URL(request.url ?? '/', 'http://localhost');
		const path = pathOf(url);
		if (path.startsWith('/@') || path.startsWith('/__') || !looksLikePage(path)) return next();
		return oneAtATime(async () => {
			try {
				const run = await readRun(root, state.server!, links, { dev: true });
				newWarnings(run.warnings);
				const data = run.pages.map((page) => run.data.get(page)!);
				if (path === '/sitemap.xml')
					return send(response, 200, 'application/xml', sitemap(run.site.url, data));
				if (path === '/feed.xml' && run.hasFeed) {
					return send(response, 200, 'application/rss+xml', feed(run.site, run.site.url, data)!);
				}
				const target = path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path;
				const html = target === NOT_FOUND ? undefined : await page(run, target);
				if (html !== undefined) return send(response, 200, 'text/html', html);
				if (!path.endsWith('/') && run.pages.some((page) => page.url === `${path}/`)) {
					response.writeHead(301, { location: `${url.pathname}/${url.search}` });
					return response.end();
				}
				next();
			} catch (error) {
				send(response, 500, 'text/html', failed(error));
			}
		});
	};

	const notFound = (request: IncomingMessage, response: ServerResponse) =>
		oneAtATime(async () => {
			try {
				const run = await readRun(root, state.server!, links, { dev: true });
				const html = await page(run, NOT_FOUND);
				send(response, 404, 'text/html', html ?? `Nothing at ${escape(request.url ?? '/')}`);
			} catch (error) {
				send(response, 500, 'text/html', failed(error));
			}
		});

	/** @prose
	 * A change that isn't CSS or an island's own code reloads the page. Every server module is
	 * dropped, since any of them can change any page's HTML, and so are the pages' scripts, since
	 * a page may now use an island or a component it didn't.
	 */
	const reload = (server: ViteDevServer) => {
		server.environments.ssr.moduleGraph.invalidateAll();
		const client = server.environments.client.moduleGraph;
		for (const [id, module] of client.idToModuleMap) {
			if (id.startsWith(`\0${ENTRY}`)) client.invalidateModule(module);
		}
		server.ws.send({ type: 'full-reload' });
	};

	const plugin: Plugin = {
		name: 'sitez:dev',
		resolveId: (id) => (id.startsWith(ENTRY) ? `\0${id}` : null),
		load(id) {
			if (!id.startsWith(`\0${ENTRY}`)) return null;
			return entry(new URLSearchParams(id.split('?')[1]).get('url') ?? '/');
		},
		configureServer(server) {
			server.middlewares.use((request, response, next) => void serve(request, response, next));
			server.watcher.on('add', () => reload(server));
			server.watcher.on('unlink', () => reload(server));
			return () => {
				server.middlewares.use((request, response) => void notFound(request, response));
			};
		},
		// CSS is Vite's to replace, and an island's component Svelte's.
		hotUpdate({ file, server }) {
			if (this.environment.name !== 'client') return;
			if (file.endsWith('.css') || [...islands.values()].includes(file)) return;
			reload(server);
			return [];
		}
	};

	const server = await siteServer(root, links, islands, { port, plugin });
	state.server = server;
	await server.vite.listen();
	const address = server.vite.resolvedUrls?.local[0] ?? `http://localhost:${port}/`;
	return { url: address, close: () => server.close() };
}

// The URL of a page's script, served by the plugin above.
const ENTRY = '/@sitez/page.js';

/** A page's URL ends in `/` or `.html`, or has no extension: `/about` redirects. */
function looksLikePage(path: string): boolean {
	const last = path.slice(path.lastIndexOf('/') + 1);
	return (
		last === '' ||
		last.endsWith('.html') ||
		!last.includes('.') ||
		path === '/sitemap.xml' ||
		path === '/feed.xml'
	);
}

function send(response: ServerResponse, status: number, type: string, body: string): void {
	response.writeHead(status, { 'content-type': `${type}; charset=utf-8` });
	response.end(body);
}

/** @prose
 * A mistake in the site is shown as `build` prints it, `file: message`; anything else is a bug in
 * Sitez, shown with its stack. Vite's client is on the page, so it reloads once the file is fixed.
 */
function errorText(error: unknown, shown: (file: string) => string): string {
	if (error instanceof SiteError) return `${shown(error.file)}: ${error.message}`;
	return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

function errorPage(text: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sitez: this page didn't build</title>
<script type="module" src="/@vite/client"></script>
</head>
<body>
<pre style="white-space: pre-wrap; font: 14px/1.5 ui-monospace, monospace; padding: 1rem">${escape(text)}</pre>
</body>
</html>
`;
}
