/** @prose
 * # Finding the site
 *
 * The folder holding `site.md` is the site, from wherever `sitez` runs inside it, the way git
 * finds a repo. So `site.md` is the one file every site has, and a site needs no `prose/` at all.
 * The nearest `site.md` wins, which lets one repo hold several sites.
 */
import { statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { SiteError } from './errors.ts';

export const SITE_FILE = 'site.md';

/** @prose
 * Walks up from `from` to the first folder with a `site.md`. `prose/site.md` is reserved: found
 * from inside `prose/`, with a `site.md` one level up, it would otherwise make `prose/` a site of
 * its own. Found from the root, page discovery rejects it with the same message.
 */
export function findRoot(from: string): string {
	const start = resolve(from);
	for (let dir = start; ; dir = dirname(dir)) {
		if (isFile(join(dir, SITE_FILE))) {
			if (basename(dir) === 'prose' && isFile(join(dirname(dir), SITE_FILE))) {
				throw reserved(join(dir, SITE_FILE));
			}
			return dir;
		}
		if (dirname(dir) === dir) {
			throw new SiteError(
				start,
				`no ${SITE_FILE} here or in any folder above. Sitez needs one at the site's root, holding a metadata block:\n\n---\nname: My site\nurl: https://example.com\n---`
			);
		}
	}
}

/** `prose/site.md`, found here from inside `prose/` or by page discovery from the root. */
export function reserved(file: string): SiteError {
	return new SiteError(
		file,
		`${SITE_FILE} is reserved for the site's metadata, next to prose/, so it can't be a page. Rename it, or move its metadata into ../${SITE_FILE}.`
	);
}

function isFile(path: string): boolean {
	return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}
