/** @prose
 * # Pages
 *
 * Which files are pages, and at which URL (rules 1 and 2). Every `.md` in `prose/` and every
 * `.svelte` in `pattern/` whose name doesn't start with a capital is a page; its path, less the
 * extension, is its URL, and `index` is its folder's own. A capitalized `.svelte` is a pattern a
 * page uses, and `.js`/`.ts` files are modules: neither is a page. Folders and files starting with
 * `.` are skipped, as a site's tools leave them there.
 */
import { readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';
import { SiteError } from './errors.ts';
import { reserved, SITE_FILE } from './root.ts';

export interface Page {
	url: string;
	/** Absolute path to the page's file. */
	file: string;
	kind: 'prose' | 'pattern';
}

/** @prose
 * Finds every page, sorted by URL. Fails on `prose/site.md`, which would otherwise be a page, and
 * on two files for one URL (`prose/about.md` and `pattern/about.svelte`, or `prose/blog.md` and
 * `prose/blog/index.md`), naming both.
 */
export function discover(root: string): Page[] {
	const pages: Page[] = [];
	for (const file of files(join(root, 'prose'))) {
		if (extname(file) !== '.md') continue;
		if (file === join(root, 'prose', SITE_FILE)) throw reserved(file);
		pages.push({ url: urlOf(join(root, 'prose'), file), file, kind: 'prose' });
	}
	for (const file of files(join(root, 'pattern'))) {
		if (extname(file) !== '.svelte' || /^[A-Z]/.test(basename(file))) continue;
		pages.push({ url: urlOf(join(root, 'pattern'), file), file, kind: 'pattern' });
	}

	const byUrl = new Map<string, Page>();
	for (const page of pages) {
		const other = byUrl.get(page.url);
		if (other) {
			throw new SiteError(
				page.file,
				`${page.url} also comes from ${relative(root, other.file)}. A URL has one file: rename or remove one of them.`
			);
		}
		byUrl.set(page.url, page);
	}
	return pages.toSorted((a, b) => (a.url < b.url ? -1 : 1));
}

/** @prose
 * The nearest pattern of a name up the tree from a page's URL (rule 2): for `/blog/hello/`,
 * `pattern/blog/hello/`, then `pattern/blog/`, then `pattern/`. Layouts and the components prose
 * elements render are both found this way, so where a pattern sits says what it belongs to. Only
 * the nearest is used; a layout that wants the one above it imports it, as any component would.
 */
export function nearest(root: string, url: string, name: string): string | undefined {
	const segments = url.split('/').filter(Boolean);
	for (let n = segments.length; n >= 0; n--) {
		const file = join(root, 'pattern', ...segments.slice(0, n), `${name}.svelte`);
		if (statSync(file, { throwIfNoEntry: false })?.isFile()) return file;
	}
	return undefined;
}

/** @prose
 * The page at `/404/`, `prose/404.md` or `pattern/404.svelte`, is what a host serves for a URL
 * that doesn't exist, and hosts look for it at `404.html` (rule 1). Every other page is its
 * folder's `index.html`, so its URL needs no extension.
 */
export const NOT_FOUND = '/404/';

export function outputFile(url: string): string {
	return url === NOT_FOUND ? '404.html' : join(...url.split('/').filter(Boolean), 'index.html');
}

/** A file's URL from its path below `folder` (`prose/` or `pattern/`). */
export function urlOf(folder: string, file: string): string {
	const segments = relative(folder, file).slice(0, -extname(file).length).split(sep);
	if (segments.at(-1) === 'index') segments.pop();
	return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}

/** A file's path below `folder`, with `/` between its parts on every system. */
export function posix(folder: string, file: string): string {
	return relative(folder, file).split(sep).join('/');
}

/** Every file below `folder`, sorted, skipping anything under a name starting with `.`. */
function files(folder: string): string[] {
	if (!statSync(folder, { throwIfNoEntry: false })?.isDirectory()) return [];
	return readdirSync(folder, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.filter(
			(file) =>
				!relative(folder, file)
					.split(sep)
					.some((part) => part.startsWith('.'))
		)
		.sort();
}
