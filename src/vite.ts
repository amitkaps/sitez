/** @prose
 * # Vite
 *
 * The Vite server Sitez runs for a site, with the config nobody writes. `build` and `dev` render
 * pages the same way, through its module runner, so a pattern's modules run from where they are
 * and `import.meta.url` still points at them: the Markz site's Quality page reads its test cases
 * relative to its own file. A site has no `node_modules`, so its imports resolve from Sitez.
 */
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { parse } from 'markz';
import { compile } from 'svelte/compiler';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { SiteError } from './errors.ts';
import { proseComponent } from './prose.ts';

export interface SiteServer {
	vite: ViteDevServer;
	/** Imports a site file (absolute path) through the module runner. */
	load(file: string): Promise<Record<string, unknown>>;
	close(): Promise<void>;
}

/** @prose
 * A server with no HTTP listener and no watcher, for rendering. `dev` (step 9) will add both.
 * Svelte's dev checks are off, as they cost time and don't change the HTML.
 */
export async function siteServer(root: string): Promise<SiteServer> {
	const vite = await createServer({
		configFile: false,
		root,
		logLevel: 'silent',
		appType: 'custom',
		server: { middlewareMode: true, hmr: false, watch: null },
		plugins: [
			fromSitez(),
			proseModules(root),
			svelte({ configFile: false, compilerOptions: { dev: false, experimental: { async: true } } }),
			noOptimizer()
		]
	});
	return {
		vite,
		load: async (file) => {
			try {
				return await vite.ssrLoadModule(
					`/${file
						.slice(root.length + 1)
						.split(sep)
						.join('/')}`
				);
			} catch (error) {
				throw siteError(error, file);
			}
		},
		close: () => vite.close()
	};
}

/** @prose
 * A file that doesn't compile, or a module that throws as it loads, is a mistake in the site.
 * Vite's error says which file (`id`) and shows the lines around it (`frame`); without an `id`,
 * it's the file being loaded.
 */
function siteError(error: unknown, file: string): SiteError {
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
function fromSitez(): Plugin {
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

/** Each `.md` in `prose/` loads as the Svelte component `prose.ts` writes for it. */
function proseModules(root: string): Plugin {
	const folder = join(root, 'prose') + sep;
	return {
		name: 'sitez:prose',
		enforce: 'pre',
		load(id, options) {
			const file = id.split('?')[0]!;
			if (!file.startsWith(folder) || !file.endsWith('.md')) return null;
			const doc = parse(readFileSync(file, 'utf8'));
			const { js } = compile(proseComponent(doc), {
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
function noOptimizer(): Plugin {
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
