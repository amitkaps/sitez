/** @prose
 * Compiles `.svelte` files as Node loads them, with `experimental.async` on. `SVELTE_GENERATE`
 * picks `server` (the default) or `client` output.
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';

const generate = process.env.SVELTE_GENERATE === 'client' ? 'client' : 'server';

registerHooks({
	load(url, context, next) {
		if (!url.endsWith('.svelte')) return next(url, context);
		const filename = fileURLToPath(url);
		const { js } = compile(readFileSync(filename, 'utf8'), {
			filename,
			generate,
			experimental: { async: true }
		});
		return { format: 'module', source: js.code, shortCircuit: true };
	}
});
