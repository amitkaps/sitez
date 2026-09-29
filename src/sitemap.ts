/** @prose
 * # Sitemap and feed
 *
 * The files a site has without writing them: `sitemap.xml`, every page for search engines, and
 * `feed.xml`, the pages with a `date` for feed readers, newest first. Both come from the same
 * metadata as the pages, and both need full addresses, from `url` in `site.md`.
 */
import { NOT_FOUND } from './discover.ts';
import { absolute, escape } from './head.ts';
import type { Metadata, PageData } from './metadata.ts';

/** Every page `build` writes, by URL, except the 404 page, which is no page of its own. */
export function sitemap(siteUrl: string, pages: PageData[]): string {
	const urls = pages
		.filter((page) => page.url !== NOT_FOUND)
		.map((page) => `<url><loc>${escape(absolute(siteUrl, page.url))}</loc></url>\n`);
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}</urlset>
`;
}

/** @prose
 * The pages with a `date`, whatever folder they're in, since only a post carries one. An entry is
 * the page's title, summary and date: whether the feed carries whole posts waits on the open
 * question of rendered bodies in `prose`. A site with no dated pages has no feed.
 */
export function feed(site: Metadata, siteUrl: string, pages: PageData[]): string | undefined {
	const dated = pages
		.filter((page) => page.date && page.url !== NOT_FOUND)
		.toSorted((a, b) =>
			a.date === b.date ? (a.url < b.url ? -1 : 1) : a.date! < b.date! ? 1 : -1
		);
	if (dated.length === 0) return undefined;
	const name = typeof site.name === 'string' ? site.name : siteUrl;
	const items = dated.map((page) => {
		const url = escape(absolute(siteUrl, page.url));
		const lines = [
			`<title>${escape(page.title ?? page.url)}</title>`,
			`<link>${url}</link>`,
			`<guid>${url}</guid>`,
			`<pubDate>${new Date(`${page.date}T00:00:00Z`).toUTCString()}</pubDate>`
		];
		if (page.summary) lines.push(`<description>${escape(page.summary)}</description>`);
		return `<item>\n${lines.join('\n')}\n</item>\n`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escape(name)}</title>
<link>${escape(absolute(siteUrl, '/'))}</link>
<description>${escape(name)}</description>
<atom:link href="${escape(absolute(siteUrl, '/feed.xml'))}" rel="self" type="application/rss+xml"/>
${items.join('')}</channel>
</rss>
`;
}
