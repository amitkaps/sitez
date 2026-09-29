/** @prose
 * # Bundling
 *
 * What the browser downloads besides the HTML, built by Rolldown once every page has rendered,
 * since only then is it known which components the site uses. A site has one stylesheet: Sitez's
 * reset, then `pattern/style.css`, then every component's scoped styles. CSS is small and needed
 * before anything paints, so one file, cached by the first page and reused by every other, is
 * cheaper than a split that saves a few bytes per page. Everything it references (a font, an
 * image) is bundled beside it. JavaScript is only the islands', only on the pages that have them.
 * Every file's name carries a content hash, so a new deploy is never served from a stale cache.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, type InlineConfig, type Logger, type Plugin, type Rolldown } from 'vite';
import { SiteError } from './errors.ts';
import type { Islands } from './islands.ts';
import {
	asGiven,
	cacheDir,
	fromSitez,
	noOptimizer,
	runtime,
	siteError,
	sveltePlugin
} from './vite.ts';

/** Files to write into `dist/`, by path. */
export type Files = Map<string, string | Uint8Array>;

/** @prose
 * The stylesheet, and the file it is written to. The reset is a layer of its own, so the order
 * that matters is the site's: `pattern/style.css` first, then components in a fixed order, so a
 * component's rule wins over the site's at equal specificity. A `url()` that doesn't resolve
 * fails the build rather than shipping as written, as a broken link would. The build has no code
 * splitting, so its CSS is one file even when a component imports something dynamically.
 */
export async function stylesheet(
	root: string,
	real: string,
	components: string[]
): Promise<{ href: string; files: Files }> {
	const imports = [
		...styleImports(real, `/pattern/style.css`),
		// Only a component's module brings its styles, so each is kept by exporting it.
		...components.map((file, i) => `export { default as c${i} } from ${JSON.stringify(file)};`)
	];
	const { output, unresolved } = await bundle(
		root,
		real,
		{ style: imports.join('\n') },
		{
			codeSplitting: false,
			assetFileNames: (asset) =>
				asset.names.some((name) => name.endsWith('.css'))
					? 'style.[hash].css'
					: 'assets/[name].[hash][extname]'
		}
	);
	const [url] = unresolved;
	if (url) {
		// Vite's warning names only the URL, so the file is the one whose source has it.
		const file = [join(real, 'pattern', 'style.css'), ...components].find(
			(file) => existsSync(file) && readFileSync(file, 'utf8').includes(url)
		);
		throw new SiteError(
			asGiven(root, real, file ?? join(real, 'pattern', 'style.css')),
			`url(${url}) isn't there. Fix the path: relative to this file, or /… for a file in public/.`
		);
	}
	const files: Files = new Map();
	let href = '';
	for (const item of output) {
		if (item.type !== 'asset') continue;
		files.set(item.fileName, item.source);
		if (item.fileName.endsWith('.css')) href = `/${item.fileName}`;
	}
	return { href, files };
}

/** @prose
 * The imports every page's styles start with: Sitez's reset, then the site's own
 * `pattern/style.css` when there is one, imported as `style` names it.
 */
export function styleImports(real: string, style: string): string[] {
	return [
		`import ${JSON.stringify(join(runtime, 'reset.css'))};`,
		...(existsSync(join(real, 'pattern', 'style.css')) ? [`import ${JSON.stringify(style)};`] : [])
	];
}

/** A page's script: its islands imported, then hydrated by name. */
export function hydrateEntry(used: string[], islands: Islands): string {
	return [
		`import { hydrateIslands } from ${JSON.stringify(join(runtime, 'client.ts'))};`,
		...used.map((island, i) => `import I${i} from ${JSON.stringify(islands.get(island))};`),
		`hydrateIslands({ ${used.map((island, i) => `${JSON.stringify(island)}: I${i}`).join(', ')} });`
	].join('\n');
}

/** @prose
 * The islands' JavaScript, for the pages that have any: each gets an entry that imports its
 * islands and hydrates them, named for the page (`blog/index.[hash].js` beside
 * `blog/index.html`). What more than one page uses, the Svelte runtime first, goes in
 * `common.[hash].js`. The build is in production mode whatever the process says, since a dev
 * server earlier in the same process leaves `NODE_ENV` at `development`, and Svelte's dev code is
 * larger. The islands' styles are already in the stylesheet, so Svelte emits none here.
 */
export async function scripts(
	root: string,
	real: string,
	pages: Map<string, string[]>,
	islands: Islands
): Promise<Scripts> {
	if (pages.size === 0) return { files: new Map(), pages: new Map(), common: undefined };
	const entries = Object.fromEntries(
		[...pages].map(([name, used]) => [name, hydrateEntry(used, islands)])
	);
	const mode = process.env.NODE_ENV;
	process.env.NODE_ENV = 'production';
	let output: Rolldown.RolldownOutput['output'];
	try {
		({ output } = await bundle(
			root,
			real,
			entries,
			{
				entryFileNames: '[name].[hash].js',
				chunkFileNames: (chunk) =>
					chunk.name === 'common' ? 'common.[hash].js' : 'assets/[name].[hash].js',
				assetFileNames: 'assets/[name].[hash][extname]',
				codeSplitting: { groups: [{ name: 'common', minShareCount: 2 }] }
			},
			{ css: false }
		));
	} finally {
		if (mode === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = mode;
	}
	const common = output.find(
		(item) => item.type === 'chunk' && item.name === 'common' && !item.isEntry
	)?.fileName;
	const files: Files = new Map();
	const scripts: Scripts['pages'] = new Map();
	for (const item of output) {
		if (item.type === 'asset') {
			files.set(item.fileName, item.source);
			continue;
		}
		files.set(item.fileName, item.code);
		if (!item.isEntry) continue;
		const preload = item.imports.map((file) => `<link rel="modulepreload" href="/${file}">`);
		scripts.set(item.name, {
			tags: [`<script type="module" src="/${item.fileName}"></script>`, ...preload].join('\n'),
			own: [item.fileName, ...item.imports.filter((file) => file !== common)]
		});
	}
	return { files, pages: scripts, common };
}

/** What `scripts` built: by page, the tags that load its script and the files only it loads. */
export interface Scripts {
	files: Files;
	pages: Map<string, { tags: string; own: string[] }>;
	common: string | undefined;
}

/** @prose
 * One client build from generated entries, written to memory: nothing reaches `dist/` until
 * every page has built. Vite reports a `url()` it can't find only as a warning, and leaves it in
 * the CSS, so warnings are read here instead of printed. A file that doesn't
 * compile fails naming it, as it would while rendering.
 */
async function bundle(
	root: string,
	real: string,
	entries: Record<string, string>,
	output: Rolldown.OutputOptions,
	{ css = true } = {}
): Promise<{ output: Rolldown.RolldownOutput['output']; unresolved: string[] }> {
	const unresolved: string[] = [];
	const logger = quietLogger((message) => {
		const found = /^\s*(\S+) referenced in .* didn't resolve at build time/.exec(message);
		if (found) unresolved.push(found[1]!);
	});
	const config: InlineConfig = {
		configFile: false,
		root: real,
		cacheDir: cacheDir(real),
		logLevel: 'silent',
		customLogger: logger,
		plugins: [fromSitez(), entryModules(entries), sveltePlugin(real, { css }), noOptimizer()],
		build: {
			write: false,
			assetsInlineLimit: 0,
			modulePreload: { polyfill: false },
			rolldownOptions: {
				input: Object.fromEntries(Object.keys(entries).map((name) => [name, ENTRY + name])),
				// Vite drops an app entry's exports, and with them the modules only exported.
				preserveEntrySignatures: 'exports-only',
				output
			}
		}
	};
	try {
		const result = (await build(config)) as Rolldown.RolldownOutput;
		return { output: result.output, unresolved };
	} catch (error) {
		throw siteError(error, join(real, 'pattern'), root, real);
	}
}

const ENTRY = 'sitez:entry/';

function entryModules(entries: Record<string, string>): Plugin {
	return {
		name: 'sitez:entry',
		resolveId: (id) => (id.startsWith(ENTRY) ? `\0${id}` : null),
		load: (id) => (id.startsWith(`\0${ENTRY}`) ? entries[id.slice(ENTRY.length + 1)] : null)
	};
}

function quietLogger(onWarn: (message: string) => void): Logger {
	const warned = new Set<string>();
	return {
		hasWarned: false,
		info() {},
		warn: (message) => onWarn(message),
		warnOnce(message) {
			if (warned.has(message)) return;
			warned.add(message);
			onWarn(message);
		},
		error() {},
		clearScreen() {},
		hasErrorLogged: () => false
	};
}
