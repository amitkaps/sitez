/** @prose
 * # Vite
 *
 * The Vite server Sitez runs for a site, with the config nobody writes. `build` and `dev` render
 * pages the same way, through its module runner, so a pattern's modules run from where they are
 * and `import.meta.url` still points at them: the Markz site's Quality page reads its test cases
 * relative to its own file. A site has no `node_modules`, so its imports resolve from Sitez.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { parse } from '@amitkaps/markz';
import { compile } from 'svelte/compiler';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { SiteError } from './errors.ts';
import { nearest, urlOf } from './discover.ts';
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
 * A server with no HTTP listener and no watcher, for rendering. `dev` (step 9) will add both.
 * Svelte's dev checks are off, as they cost time and don't change the HTML.
 *
 * Vite names modules by their real path, so a site reached through a symlink (macOS's `/var` is
 * `/private/var`) is served from its real path, and an error names the file by the path the
 * site was given, as every other message does.
 */
export async function siteServer(root: string, links: LinkTargets): Promise<SiteServer> {
	const real = realpathSync(root);
	const vite = await createServer({
		configFile: false,
		root: real,
		logLevel: 'silent',
		appType: 'custom',
		server: { middlewareMode: true, hmr: false, watch: null },
		plugins: [fromSitez(), proseModules(root, real, links), sveltePlugin(real), noOptimizer()]
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
 * Svelte as every build of a site compiles it. A component's scoping class is hashed from its
 * path in the site, not on the disk, so the server render and the client build agree on it, and
 * a site builds to the same files wherever it is checked out.
 */
export function sveltePlugin(real: string): Plugin[] {
	return svelte({
		configFile: false,
		compilerOptions: {
			dev: false,
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
 * dependencies are ESM and need no pre-bundling, so the lists are cleared once resolved.
 */
export function noOptimizer(): Plugin {
	return {
		name: 'sitez:no-optimizer',
		configResolved(config) {
			config.optimizeDeps.include = [];
			for (const environment of Object.values(config.environments)) {
				environment.optimizeDeps.include = [];
			}
		}
	};
}
