/** @prose
 * # Bundling
 *
 * What the browser downloads besides the HTML, built by Rolldown once every page has rendered,
 * since only then is it known which components the site uses. A site has one stylesheet: Sitez's
 * reset, then `pattern/style.css`, then every component's scoped styles. CSS is small and needed
 * before anything paints, so one file, cached by the first page and reused by every other, is
 * cheaper than a split that saves a few bytes per page. Everything it references (a font, an
 * image) is bundled beside it, and every file's name carries a content hash, so a new deploy is
 * never served from a stale cache.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { build, type InlineConfig, type Logger, type Plugin, type Rolldown } from 'vite';
import { SiteError } from './errors.ts';
import { fromSitez, noOptimizer, runtime, siteError, sveltePlugin } from './vite.ts';

/** Files to write into `dist/`, by path. */
export type Files = Map<string, string | Uint8Array>;

/** @prose
 * The stylesheet, and the file it is written to. The reset is a layer of its own, so the order
 * that matters is the site's: `pattern/style.css` first, then components in a fixed order, so a
 * component's rule wins over the site's at equal specificity. A `url()` that doesn't resolve
 * fails the build rather than shipping as written, as a broken link would.
 */
export async function stylesheet(
	root: string,
	real: string,
	components: string[]
): Promise<{ href: string; files: Files }> {
	const style = join(root, 'pattern', 'style.css');
	const imports = [
		`import ${JSON.stringify(join(runtime, 'reset.css'))};`,
		...(existsSync(style) ? [`import '/pattern/style.css';`] : []),
		// Only a component's module brings its styles, so each is kept by exporting it.
		...components.map((file, i) => `export { default as c${i} } from ${JSON.stringify(file)};`)
	];
	const { output, unresolved } = await bundle(root, real, imports.join('\n'), {
		assetFileNames: (asset) =>
			asset.names.some((name) => name.endsWith('.css'))
				? 'style.[hash].css'
				: 'assets/[name].[hash][extname]'
	});
	if (unresolved.length > 0) {
		const [url] = unresolved;
		const file = [style, ...components.map((file) => root + file.slice(real.length))].find(
			(file) => existsSync(file) && readText(file).includes(url!)
		);
		throw new SiteError(
			file ?? style,
			`url(${url}) isn't there. Fix the path: relative to this file, or /… for a file in public/.`
		);
	}
	const files: Files = new Map();
	let href: string | undefined;
	for (const item of output) {
		if (item.type !== 'asset') continue;
		if (!item.fileName.endsWith('.css')) {
			files.set(item.fileName, item.source);
			continue;
		}
		// Vite marks the CSS it emits with a comment for its own later passes.
		files.set(item.fileName, String(item.source).replace(/\/\*\$vite\$:\d+\*\/\n?/g, ''));
		href = `/${item.fileName}`;
	}
	return { href: href!, files };
}

/** @prose
 * One client build from a generated entry, written to memory: nothing reaches `dist/` until
 * every page has built. Vite reports a `url()` it can't find as a warning and leaves it in the
 * CSS, so warnings are read here instead of printed, and a file that doesn't compile fails naming
 * it, as it would while rendering.
 */
async function bundle(
	root: string,
	real: string,
	entry: string,
	output: Rolldown.OutputOptions
): Promise<{ output: Rolldown.RolldownOutput['output']; unresolved: string[] }> {
	const unresolved: string[] = [];
	const logger = quietLogger((message) => {
		const found = /^\s*(\S+) referenced in .* didn't resolve at build time/.exec(message);
		if (found) unresolved.push(found[1]!);
	});
	const config: InlineConfig = {
		configFile: false,
		root: real,
		logLevel: 'silent',
		customLogger: logger,
		plugins: [fromSitez(), entryModule(entry), sveltePlugin(real), noOptimizer()],
		build: {
			write: false,
			assetsInlineLimit: 0,
			cssCodeSplit: false,
			modulePreload: { polyfill: false },
			rolldownOptions: {
				input: { entry: ENTRY },
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
		const named = siteError(error, join(real, 'pattern'));
		if (!named.file.startsWith(real + sep)) throw named;
		throw new SiteError(root + named.file.slice(real.length), named.message, {
			cause: named.cause
		});
	}
}

const ENTRY = 'sitez:entry';

function entryModule(code: string): Plugin {
	return {
		name: 'sitez:entry',
		resolveId: (id) => (id === ENTRY ? `\0${ENTRY}` : null),
		load: (id) => (id === `\0${ENTRY}` ? code : null)
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

function readText(file: string): string {
	return readFileSync(file, 'utf8');
}
