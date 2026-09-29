/** @prose
 * # Metadata
 *
 * What pages and layouts know about a page, the site and all the prose (rule 5). A prose page's
 * metadata is its Markz block, with `title` defaulting to the first heading and `summary` to the
 * first paragraph, so most pages need no block. A Svelte page's is its exported `metadata`, with
 * `title` defaulting to its first `<h1>` once it has rendered. Every other key passes through
 * untouched, so a site can add its own (`tags`) without Sitez knowing them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, textContent, type Document, type MetadataValue } from 'markz';
import { SITE_FILE } from './root.ts';

export type Metadata = Record<string, MetadataValue | undefined>;

/** A page as a pattern sees it: its URL and its metadata. */
export interface PageData extends Metadata {
	url: string;
	title?: string;
	summary?: string;
	date?: string;
	draft?: boolean;
}

/** The metadata block in `site.md`; the rest of the file is notes for whoever maintains the site. */
export function siteMetadata(root: string): Metadata {
	return { ...parse(readFileSync(join(root, SITE_FILE), 'utf8')).metadata };
}

export function proseMetadata(url: string, doc: Document): PageData {
	const block = { ...doc.metadata };
	const title = first(doc, 'heading');
	const summary = first(doc, 'paragraph');
	return {
		...block,
		url,
		title: typeof block.title === 'string' ? block.title : title,
		summary: typeof block.summary === 'string' ? block.summary : summary
	};
}

/** @prose
 * A Svelte page's metadata, from its module's `metadata` export, and its title from the first
 * `<h1>` of its HTML when the export has none. Svelte writes text escaped, so the few entities
 * it produces are all there is to decode.
 */
export function patternMetadata(url: string, exported: unknown, body?: string): PageData {
	const block = (exported && typeof exported === 'object' ? exported : {}) as Metadata;
	const h1 = body?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
	const title = typeof block.title === 'string' ? block.title : h1 && text(h1);
	return { ...block, url, title: title || undefined };
}

export function isDraft(page: PageData): boolean {
	return page.draft === true;
}

/** The text of the first top-level node of `type`, which is what a reader sees first. */
function first(doc: Document, type: 'heading' | 'paragraph'): string | undefined {
	for (const node of doc.children(doc.root)) {
		if (doc.type(node) === type) return textContent(doc, node).trim() || undefined;
	}
	return undefined;
}

function text(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->|<[^>]+>/g, '')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&')
		.replace(/\s+/g, ' ')
		.trim();
}
