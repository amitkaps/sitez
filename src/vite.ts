/** @prose
 * # Vite
 *
 * The Vite server Sitez runs for a site, with the config nobody writes. `build` and `dev` render
 * pages the same way, through its module runner, so a pattern's modules run from where they are
 * and `import.meta.url` still points at them: the Markz site's Quality page reads its test cases
 * relative to its own file. A site has no `node_modules`, so its imports resolve from Sitez.
 */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { parse } from '@amitkaps/markz';
import { compile } from 'svelte/compiler';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { SiteError } from './errors.ts';
import { nearest, urlOf } from './discover.ts';
import { islandModules, type Islands } from './islands.ts';
import { linkTarget, type LinkTargets } from './links.ts';
import { componentName, proseComponent } from './prose.ts';

/** Sitez's own files a site's pages and bundles load: the reset, and the islands' runtime. */
export const runtime = join(import.meta.dirname, 'runtime');

export interface SiteServer {
	vite: ViteDevServer;
	/** The site's root as Vite names its modules: its real path. */
	real: string;
	/** Imports a site file (absolute path) through the module runner. */
	load(file: string): Promise<Record<string, unknown>>;
	/** @prose
	 * Every Svelte component a render has loaded, in a fixed order: pages, layouts and what they
	 * import, from the site or a library. They are the components whose styles the site uses.
	 */
	components(): string[];
	close(): Promise<void>;
}

/** @prose
 * For `build`, a server with no HTTP listener and no watcher, only for rendering. For `dev`, the
 * same server listening on `port`, watching the site and hot-replacing what the browser loads,
 * with `dev.ts`'s plugin serving the pages. Svelte's dev checks are off either way, as they cost
 * time and don't change the HTML.
 *
 * Vite names modules by their real path, so a site reached through a symlink (macOS's `/var` is
 * `/private/var`) is served from its real path, and an error names the file by the path the
 * site was given, as every other message does.
 */
export async function siteServer(
	root: string,
	links: LinkTargets,
	islands: Islands,
	dev?: { port: number; plugin: Plugin }
): Promise<SiteServer> {
	const real = realpathSync(root);
	const vite = await createServer({
		configFile: false,
		root: real,
		cacheDir: cacheDir(real),
		logLevel: 'silent',
		appType: 'custom',
		// A site's modules import Sitez's runtime and Svelte from outside the site's folder.
		server: dev
			? { port: dev.port, host: 'localhost', fs: { strict: false } }
			: { middlewareMode: true, hmr: false, watch: null },
		plugins: [
			fromSitez(),
			proseModules(root, real, links),
			islandModules(root, real, islands),
			sveltePlugin(real, { hmr: dev !== undefined }),
			noOptimizer(),
			...(dev ? [dev.plugin] : [])
		]
	});
	return {
		vite,
		real,
		components: () =>
			[...vite.environments.ssr.moduleGraph.idToModuleMap.keys()]
				.filter((id) => id.endsWith('.svelte') && !id.startsWith('\0') && !id.startsWith(runtime))
				.sort(),
		load: async (file) => {
			try {
				return await vite.ssrLoadModule(
					`/${file
						.slice(root.length + 1)
						.split(sep)
						.join('/')}`
				);
			} catch (error) {
				const named = siteError(error, file);
				if (!named.file.startsWith(real + sep)) throw named;
				throw new SiteError(root + named.file.slice(real.length), named.message, {
					cause: named.cause
				});
			}
		},
		close: () => vite.close()
	};
}

/** @prose
 * Vite and vite-plugin-svelte keep a cache in `node_modules/.vite` of the nearest package, which
 * for a site with none may be a folder that isn't the site's. Sitez keeps it in the system's temp
 * folder instead, one per site, so a site's folder only ever gets `dist/`.
 */
export function cacheDir(real: string): string {
	return join(tmpdir(), 'sitez', createHash('sha256').update(real).digest('hex').slice(0, 12));
}

/** @prose
 * Svelte as every build of a site compiles it. A component's scoping class is hashed from its
 * path in the site, not on the disk, so the server render and the client build agree on it, and
 * a site builds to the same files wherever it is checked out.
 */
export function sveltePlugin(real: string, { hmr = false } = {}): Plugin[] {
	return svelte({
		configFile: false,
		compilerOptions: {
			dev: false,
			hmr,
			experimental: { async: true },
			cssHash: ({ hash, filename }) =>
				`svelte-${hash(
					relative(real, filename ?? '')
						.split(sep)
						.join('/')
				)}`
		}
	});
}

/** @prose
 * A file that doesn't compile, or a module that throws as it loads, is a mistake in the site.
 * Vite's error says which file (`id`) and shows the lines around it (`frame`); without an `id`,
 * it's the file being loaded.
 */
export function siteError(error: unknown, file: string): SiteError {
	const { message, id, frame } = error as { message?: string; id?: string; frame?: string };
	return new SiteError(
		id?.split('?')[0] ?? file,
		`${message ?? String(error)}${frame ? `\n\n${frame}` : ''}`,
		{ cause: error }
	);
}

/** @prose
 * Bare imports from a site's files resolve from the site first, so a site with its own
 * `package.json` gets its own libraries, then as if imported from inside Sitez, which is where
 * `svelte` is for a site without one.
 */
export function fromSitez(): Plugin {
	const inside = import.meta.filename;
	return {
		name: 'sitez:resolve',
		enforce: 'pre',
		async resolveId(id, importer, options) {
			if (!/^[@a-z]/.test(id)) return null;
			const own = await this.resolve(id, importer, { ...options, skipSelf: true });
			return own ?? this.resolve(id, inside, { ...options, skipSelf: true });
		}
	};
}

/** @prose
 * Each `.md` in `prose/` loads as the Svelte component `prose.ts` writes for it, with the
 * components its elements render found up the tree from the page's URL, as its layout is, and
 * its links checked against `links`. Vite hands over the real path; links and components are
 * looked up from the root the site was given, as every message names it.
 */
function proseModules(root: string, real: string, links: LinkTargets): Plugin {
	const folder = join(real, 'prose') + sep;
	return {
		name: 'sitez:prose',
		enforce: 'pre',
		load(id, options) {
			const file = id.split('?')[0]!;
			if (!file.startsWith(folder) || !file.endsWith('.md')) return null;
			const doc = parse(readFileSync(file, 'utf8'));
			const page = root + file.slice(real.length);
			const url = urlOf(join(root, 'prose'), page);
			const source = proseComponent(page, doc, {
				component: (name) => nearest(root, url, componentName(name)),
				link: (destination, kind) => linkTarget(links, page, destination, kind)
			});
			const { js } = compile(source, {
				filename: file,
				generate: options?.ssr ? 'server' : 'client',
				dev: false,
				experimental: { async: true }
			});
			return { code: js.code, map: js.map };
		}
	};
}

/** @prose
 * Vite's dependency optimizer resolves from the site root, where there are no packages, and
 * vite-plugin-svelte adds `svelte/*` to its list in a config hook. Svelte and Sitez's other
 * dependencies are ESM and need no pre-bundling, so the lists are cleared once resolved, and
 * `dev` doesn't discover more: it would write its cache into a `node_modules` the site doesn't
 * have.
 */
export function noOptimizer(): Plugin {
	return {
		name: 'sitez:no-optimizer',
		configResolved(config) {
			for (const options of [
				config.optimizeDeps,
				...Object.values(config.environments).map((environment) => environment.optimizeDeps)
			]) {
				options.include = [];
				options.noDiscovery = true;
			}
		}
	};
}
