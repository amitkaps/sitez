/** @prose
 * # Links
 *
 * Where a link in prose goes, and whether it's there (rule 4). Prose links to files, as it does
 * on GitHub, and Sitez turns each into the URL the site serves it at: a page's `.md` into the
 * page's URL, a file in `public/` into its path, and any other file in the repo into its page on
 * GitHub. A site link (`/about`) is Markz's form for a URL on this site, and is checked the same
 * way. A full URL is another site's, and is never checked.
 *
 * Sitez knows every page and file, so a link to one that isn't there fails the build, as does a
 * link to a page `build` leaves out: a draft, or the 404 page. Nothing is guessed. Once a page
 * has rendered, every link in its HTML is checked the same way, so a layout's nav or a
 * component's `href` can't break either.
 */
import { statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { NOT_FOUND, urlOf } from './discover.ts';

/** @prose
 * What a link can point at. `pages` holds every page by URL, with whether this run leaves it out:
 * `build` fills it before any prose loads, since a Svelte page is a draft only once its module has
 * said so. `generated` is what Sitez writes beside the pages (`/sitemap.xml`, `/feed.xml`).
 */
export interface LinkTargets {
	root: string;
	repo: string | undefined;
	pages: Map<string, { draft: boolean }>;
	generated: Set<string>;
}

export type LinkKind = 'link' | 'image';

/** @prose
 * The URL a destination in `file` is written as, or the problem with it, which `prose.ts` turns
 * into a build error at the link's line. The query and fragment are kept as written; a fragment
 * alone (`#usage`) is a place on this page and passes as it is.
 */
export function linkTarget(
	targets: LinkTargets,
	file: string,
	destination: string,
	kind: LinkKind
): { href: string } | { problem: string } {
	if (destination === '' || destination.startsWith('#') || isFullUrl(destination)) {
		return { href: destination };
	}
	const cut = destination.search(/[?#]/);
	const path = cut === -1 ? destination : destination.slice(0, cut);
	const suffix = cut === -1 ? '' : destination.slice(cut);
	const target = path.startsWith('/')
		? siteLink(targets, path)
		: fileLink(targets, file, destination, path, kind);
	return 'href' in target ? { href: target.href + suffix } : target;
}

/** `https:`, `mailto:` and `//host` are another site's, and so are never checked. */
function isFullUrl(destination: string): boolean {
	return /^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//');
}

/** @prose
 * A site link names a page by its URL, with or without its trailing slash, or a file in
 * `public/` by its path, and is written as the URL the site serves. A path this site doesn't
 * build may still be on the same domain, as a separate site can be, but Sitez can't tell that
 * from a typo: the author writes it in full, as any other site's link.
 */
function siteLink(targets: LinkTargets, path: string): { href: string } | { problem: string } {
	const url = path.endsWith('/') ? path : `${path}/`;
	if (targets.pages.has(url)) return pageLink(targets, url);
	if (targets.generated.has(path) || isFile(join(targets.root, 'public', path))) {
		return { href: path };
	}
	return {
		problem: `${path} isn't a page or a file in public/. Link to one that is, or write a page elsewhere on this domain in full, starting https://`
	};
}

/** @prose
 * A relative link names a file from the page's own folder. A `.md` in `prose/` is that page; a
 * file in `public/` is served at its path; any other file in the repo, source code included, goes
 * to GitHub from `repo` in `site.md`, as a folder does. An image has to be served by the site
 * itself, so one outside `public/` fails rather than pointing at a GitHub page.
 */
function fileLink(
	targets: LinkTargets,
	file: string,
	destination: string,
	path: string,
	kind: LinkKind
): { href: string } | { problem: string } {
	const { root, repo, pages } = targets;
	const target = resolve(dirname(file), path);
	const stat = statSync(target, { throwIfNoEntry: false });
	if (!stat)
		return { problem: `${destination} isn't there: no file at ${relative(root, target)}.` };

	const prose = join(root, 'prose');
	if (stat.isFile() && extname(target) === '.md' && inside(prose, target)) {
		const url = urlOf(prose, target);
		if (pages.has(url)) return pageLink(targets, url);
	}
	const publicDir = join(root, 'public');
	if (stat.isFile() && inside(publicDir, target)) return { href: `/${posix(publicDir, target)}` };

	if (kind === 'image') {
		return {
			problem: `${destination} is an image outside public/, so the site doesn't serve it. Move it into public/ and link to it there.`
		};
	}
	if (!repo) {
		return {
			problem: `${destination} is a file in the repo, which the site links to on GitHub, but site.md has no repo. Add repo: https://github.com/…`
		};
	}
	const top = gitRoot(root);
	if (!inside(top, target) && target !== top) {
		return { problem: `${destination} is outside the repo, so it has no page on GitHub.` };
	}
	return {
		href: `${repo.replace(/\/$/, '')}/${stat.isFile() ? 'blob' : 'tree'}/main/${posix(top, target)}`
	};
}

/** @prose
 * The first broken link in a page's rendered HTML, whoever wrote it: a layout's nav, a
 * component's `href`, a raw block's `<img src>`. Patterns write URLs, not files, so a site link
 * must be the URL as the site serves it, `/about/` rather than `/about`, which a host would
 * redirect; a relative one is read from the page's URL, as a browser reads it. Prose links arrive
 * already rewritten, so they pass. Only real start tags are read: text that shows HTML has its
 * `<` escaped, and a script's or a stylesheet's body is code, so neither is taken for a link.
 */
export function renderedLinkProblem(
	targets: LinkTargets,
	url: string,
	html: string
): string | undefined {
	const tags = html
		.replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2>/gi, '$1')
		.matchAll(/<[a-zA-Z][^\s/>]*(?:\s+[^\s=>]+(?:="[^"]*")?)*\s*\/?>/g);
	const attributes = [...tags].flatMap(([tag]) => [...tag.matchAll(/\s(href|src)="([^"]*)"/g)]);
	for (const [, attribute, value = ''] of attributes) {
		const destination = value.replaceAll('&amp;', '&');
		if (destination === '' || destination.startsWith('#') || isFullUrl(destination)) continue;
		let path: string;
		try {
			path = decodeURI(new URL(destination, `https://site.invalid${url}`).pathname);
		} catch {
			path = destination;
		}
		const where = `${attribute}="${value}"`;
		const target = siteLink(targets, path);
		if ('problem' in target) return `${where}: ${target.problem}`;
		if (target.href !== path) {
			return `${where}: ${path} is served at ${target.href}. Write that, so no host has to redirect it.`;
		}
	}
	return undefined;
}

/** @prose
 * A page this run writes, or the problem with linking to one it leaves out: a draft would ship
 * as a broken link, and the 404 page is served for URLs that don't exist, never linked to.
 */
function pageLink(targets: LinkTargets, url: string): { href: string } | { problem: string } {
	if (targets.pages.get(url)?.draft) {
		return {
			problem: `${url} is a draft, which build leaves out. Publish it (remove draft: true), or remove the link.`
		};
	}
	if (url === NOT_FOUND) {
		return {
			problem: `404 is the page a host serves for a URL that doesn't exist, not one to link to. Link to a page that exists.`
		};
	}
	return { href: url };
}

/** GitHub paths are from the repo's root, which is the site's or a folder above it. */
function gitRoot(root: string): string {
	for (let dir = resolve(root); ; dir = dirname(dir)) {
		if (statSync(join(dir, '.git'), { throwIfNoEntry: false })) return dir;
		if (dirname(dir) === dir) return resolve(root);
	}
}

function inside(folder: string, file: string): boolean {
	return file.startsWith(folder + sep);
}

function posix(folder: string, file: string): string {
	return relative(folder, file).split(sep).join('/');
}

function isFile(path: string): boolean {
	return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}
