// A site with no package.json, no node_modules and no vite.config: dev server and build from code.
import {
	cpSync,
	mkdtempSync,
	realpathSync,
	readdirSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, createServer, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Outside the repo, so nothing resolves through Sitez's own node_modules by walking up.
const root = realpathSync(mkdtempSync(join(tmpdir(), 'sitez-vite-')));
cpSync(join(import.meta.dirname, '../../test/sites/landing'), root, { recursive: true });
writeFileSync(
	join(root, 'pattern/Counter.svelte'),
	`<script>let n = $state(0);</script>\n<button onclick={() => n++}>{n}</button>\n`
);
writeFileSync(
	join(root, 'pattern/index.svelte'),
	readFileSync(join(root, 'pattern/index.svelte'), 'utf8')
		.replace('let { site }', "import Counter from './Counter.svelte';\n\tlet { site }")
		.replace('<p><a', '<Counter />\n\n<p><a')
);
console.log('site:', root, readdirSync(root));

// Bare imports from the site's files resolve from the site first (a site with its own
// package.json), then as if imported from inside Sitez.
const insideSitez = join(import.meta.dirname, 'run.ts');
function fromSitez(): Plugin {
	return {
		name: 'sitez:resolve',
		enforce: 'pre',
		async resolveId(id, importer, options) {
			if (!/^[@a-z]/.test(id) || id.startsWith('virtual:')) return null;
			const own = await this.resolve(id, importer, { ...options, skipSelf: true });
			return own ?? this.resolve(id, insideSitez, { ...options, skipSelf: true });
		}
	};
}

// The optimizer resolves from the site root, where there are no packages. vite-plugin-svelte adds
// `svelte/*` to its list in a config hook, so clear the lists once the config is resolved.
const noOptimizer: Plugin = {
	name: 'sitez:no-optimizer',
	configResolved(config) {
		config.optimizeDeps.include = [];
		for (const env of Object.values(config.environments)) env.optimizeDeps.include = [];
	}
};

const plugins = () => [
	fromSitez(),
	svelte({ configFile: false, compilerOptions: { experimental: { async: true } } }),
	noOptimizer
];

// --- dev: render / on request with the server module graph.
const server = await createServer({
	configFile: false,
	root,
	logLevel: 'warn',
	server: { port: 0 },
	// The optimizer resolves from the site root, where there are no packages; Sitez's own
	// dependencies are ESM and need no pre-bundling.
	optimizeDeps: { noDiscovery: true, include: [] },
	ssr: { optimizeDeps: { noDiscovery: true, include: [] } },
	appType: 'custom',
	plugins: [
		...plugins(),
		{
			name: 'sitez:dev',
			configureServer(s) {
				s.middlewares.use(async (req, res, next) => {
					if (req.url !== '/') return next();
					const { render } = await s.ssrLoadModule('svelte/server');
					const { default: Page } = await s.ssrLoadModule('/pattern/index.svelte');
					const { body } = await render(Page, { props: { site: { name: 'Lantern' } } });
					res.setHeader('content-type', 'text/html').end(`<!doctype html>${body}`);
				});
			}
		}
	]
});
await server.listen();
const url = server.resolvedUrls!.local[0]!;
const html = await (await fetch(url)).text();
console.log(
	'dev GET / ->',
	html.includes('<h1>Lantern</h1>') && html.includes('<button>0</button>')
		? 'rendered'
		: html.slice(0, 400)
);
await server.close();

// --- build 1: the server side, one virtual entry per page, run by Node. The entry re-exports
// `render`, so the page and the renderer share the bundle's one copy of Svelte.
const entries: Plugin = {
	name: 'sitez:entries',
	resolveId: (id) => (id.startsWith('virtual:sitez/') ? '\0' + id : null),
	load(id) {
		if (id === '\0virtual:sitez/page/index')
			return `export { render } from 'svelte/server';\nexport { default } from '/pattern/index.svelte';\n`;
		return null;
	}
};
const result = await build({
	configFile: false,
	root,
	logLevel: 'warn',
	plugins: [...plugins(), entries],
	ssr: { noExternal: true },
	build: {
		ssr: true,
		outDir: join(root, '.sitez/server'),
		emptyOutDir: true,
		rollupOptions: { input: { index: 'virtual:sitez/page/index' } }
	}
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) =>
	'output' in r ? r.output : []
);
console.log(
	'server build ->',
	outputs.map((o) => o.fileName)
);
const serverOut = join(
	root,
	'.sitez/server',
	outputs.find((o) => o.type === 'chunk' && o.isEntry)!.fileName
);
const { render, default: Page } = await import(serverOut);
const built = await render(Page, { props: { site: { name: 'Lantern' } } });
console.log(
	'server render ->',
	built.body.includes('<button>0</button>') ? 'rendered' : built.body.slice(0, 300)
);
const code = readFileSync(serverOut, 'utf8');
console.log(
	'server bundle bare imports:',
	[...code.matchAll(/^import .* from ["']([^"'.][^"']*)["']/gm)].map((m) => m[1]),
	`${code.length} bytes`
);

// --- build 2: the client side, one entry for the island.
mkdirSync(join(root, '.sitez'), { recursive: true });
writeFileSync(
	join(root, '.sitez/island.js'),
	`import { hydrate } from 'svelte';\nimport Counter from '../pattern/Counter.svelte';\nfor (const el of document.querySelectorAll('sitez-island')) hydrate(Counter, { target: el });\n`
);
await build({
	configFile: false,
	root,
	logLevel: 'warn',
	plugins: plugins(),
	build: {
		outDir: join(root, 'dist'),
		emptyOutDir: true,
		manifest: true,
		rollupOptions: { input: { index: join(root, '.sitez/island.js') } }
	}
});
const assets = readdirSync(join(root, 'dist/assets'));
console.log(
	'client build ->',
	assets,
	existsSync(join(root, 'dist/.vite/manifest.json')) ? '+ manifest' : ''
);
for (const a of assets) {
	const bytes = readFileSync(join(root, 'dist/assets', a));
	console.log('  ', a, bytes.length, 'bytes,', gzipSync(bytes).length, 'gzipped');
}
