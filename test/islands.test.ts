/** @prose
 * # Islands in a browser
 *
 * Built pages loaded into happy-dom with their own scripts: each island hydrates without a
 * warning, keeps the HTML the server wrote, children included, and responds to a click. The
 * snapshots show what a page ships; this shows that it works.
 */
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Window } from 'happy-dom';
import { expect, test } from 'vite-plus/test';
import { build } from '../src/build.ts';

test('the blog index hydrates its TagFilter and filters on a click', async () => {
	const outDir = await built('blog');
	// One page has islands, so there is nothing common to split out.
	expect(readdirSync(outDir).some((file) => file.startsWith('common.'))).toBe(false);
	await inBrowser(outDir, 'blog/index.html', async (document) => {
		const island = document.querySelector('sitez-island')!;
		const titles = () => [...island.querySelectorAll('li a')].map((a) => a.textContent);
		expect(titles()).toEqual(['Again', 'Hello']);

		const start = [...island.querySelectorAll('button')].find((b) => b.textContent === 'start')!;
		start.click();
		await Promise.resolve();
		expect(titles()).toEqual(['Hello']);
		expect(start.getAttribute('aria-pressed')).toBe('true');
	});
});

test('an island keeps its children as the server wrote them', async () => {
	const outDir = await built('elements');
	// Two pages use FoldOut, so Svelte's runtime is common to both.
	expect(readdirSync(outDir).some((file) => file.startsWith('common.'))).toBe(true);
	await inBrowser(outDir, 'index.html', async (document) => {
		const island = document.querySelector('sitez-island')!;
		const children = island.querySelector('sitez-children')!;
		const button = island.querySelector('button')!;
		expect(children.closest('div')!.hidden).toBe(true);
		button.click();
		await Promise.resolve();
		expect(children.closest('div')!.hidden).toBe(false);
		expect(button.getAttribute('aria-expanded')).toBe('true');
		// The children are the server's nodes, not a copy the script made.
		expect(island.querySelector('sitez-children')).toBe(children);
		expect(children.querySelector('dfn')!.textContent).toBe('term');
	});
});

async function built(site: string): Promise<string> {
	const outDir = join(mkdtempSync(join(tmpdir(), 'sitez-')), 'dist');
	await build(join(import.meta.dirname, 'sites', site), { outDir });
	return outDir;
}

/** @prose
 * Loads a built page into happy-dom and runs its script from `dist/`, as a browser would, with
 * the DOM as globals for Svelte. Hydration must not warn, and must keep the server's nodes.
 */
async function inBrowser(
	outDir: string,
	page: string,
	check: (document: Document) => Promise<void>
): Promise<void> {
	const html = readFileSync(join(outDir, page), 'utf8');
	const script = /<script type="module" src="\/([^"]+)"><\/script>/.exec(html)?.[1];
	expect(script).toMatch(/\.[\w-]+\.js$/);

	const window = new Window({ url: `https://example.com/${page.replace(/index\.html$/, '')}` });
	const added = Object.getOwnPropertyNames(window).filter((key) => !(key in globalThis));
	const globals = globalThis as Record<string, unknown>;
	for (const key of added) globals[key] = (window as unknown as Record<string, unknown>)[key];
	const warnings: unknown[] = [];
	const warn = console.warn;
	console.warn = (...args: unknown[]) => warnings.push(args);
	try {
		window.document.write(html);
		const document = window.document as unknown as Document;
		const island = document.querySelector('sitez-island')!;
		const first = island.firstElementChild;
		await import(pathToFileURL(join(outDir, script!)).href);
		expect(warnings).toEqual([]);
		expect(island.firstElementChild).toBe(first);
		await check(document);
	} finally {
		console.warn = warn;
		for (const key of added) delete globals[key];
		await window.happyDOM.close();
	}
}
