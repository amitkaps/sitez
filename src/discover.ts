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
 * The nearest `Layout.svelte` up the tree from a page's URL: `pattern/blog/Layout.svelte` for
 * `/blog/hello/`, else `pattern/Layout.svelte`. Only the nearest wraps a page; a layout that wants
 * the one above it imports it, as any component would.
 */
export function layoutFor(root: string, url: string): string | undefined {
	const segments = url.split('/').filter(Boolean);
	for (let n = segments.length; n >= 0; n--) {
		const file = join(root, 'pattern', ...segments.slice(0, n), 'Layout.svelte');
		if (statSync(file, { throwIfNoEntry: false })?.isFile()) return file;
	}
	return undefined;
}

function urlOf(folder: string, file: string): string {
	const segments = relative(folder, file).slice(0, -extname(file).length).split(sep);
	if (segments.at(-1) === 'index') segments.pop();
	return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
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
