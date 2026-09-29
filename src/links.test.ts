import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { linkTarget, renderedLinkProblem, type LinkKind, type LinkTargets } from './links.ts';

const root = mkdtempSync(join(tmpdir(), 'sitez-'));
mkdirSync(join(root, '.git'));
for (const file of [
	'site.md',
	'prose/index.md',
	'prose/404.md',
	'prose/blog/hello.md',
	'prose/blog/draft.md',
	'public/logo.svg',
	'src/code.ts',
	'docs/diagram.png'
]) {
	mkdirSync(dirname(join(root, file)), { recursive: true });
	writeFileSync(join(root, file), '');
}
const targets: LinkTargets = {
	root,
	repo: 'https://github.com/example/site',
	pages: new Map([
		['/', { draft: false }],
		['/404/', { draft: false }],
		['/blog/hello/', { draft: false }],
		['/blog/draft/', { draft: true }]
	]),
	generated: new Set(['/sitemap.xml'])
};
const from = join(root, 'prose/blog/hello.md');
const link = (destination: string, kind: LinkKind = 'link', site = targets) =>
	linkTarget(site, from, destination, kind);

describe('linkTarget', () => {
	test('leaves full URLs and fragments alone, unchecked', () => {
		for (const href of [
			'https://example.com/x',
			'mailto:me@example.com',
			'//cdn.example',
			'#top'
		]) {
			expect(link(href)).toEqual({ href });
		}
	});

	test("writes a page's file as its URL, keeping the fragment and query", () => {
		expect(link('../index.md')).toEqual({ href: '/' });
		expect(link('hello.md#usage')).toEqual({ href: '/blog/hello/#usage' });
		expect(link('hello.md?v=1')).toEqual({ href: '/blog/hello/?v=1' });
	});

	test('checks a site link against the pages and public/, adding the trailing slash', () => {
		expect(link('/blog/hello')).toEqual({ href: '/blog/hello/' });
		expect(link('/blog/hello/#x')).toEqual({ href: '/blog/hello/#x' });
		expect(link('/logo.svg')).toEqual({ href: '/logo.svg' });
		expect(link('/stories')).toEqual({
			problem:
				"/stories isn't a page or a file in public/. Link to one that is, or write a page elsewhere on this domain in full, starting https://"
		});
	});

	test('serves a file in public/ at its path', () => {
		expect(link('../../public/logo.svg', 'image')).toEqual({ href: '/logo.svg' });
	});

	test('sends any other repo file to GitHub, and a folder to its tree', () => {
		expect(link('../../src/code.ts#L3')).toEqual({
			href: 'https://github.com/example/site/blob/main/src/code.ts#L3'
		});
		expect(link('../../src')).toEqual({ href: 'https://github.com/example/site/tree/main/src' });
	});

	test('fails on what the build would ship broken', () => {
		expect(link('gone.md')).toEqual({
			problem: "gone.md isn't there: no file at prose/blog/gone.md."
		});
		expect(link('draft.md')).toEqual({
			problem:
				'/blog/draft/ is a draft, which build leaves out. Publish it (remove draft: true), or remove the link.'
		});
		expect(link('/404')).toMatchObject({
			problem: expect.stringMatching(/^404 is the page a host/)
		});
		expect(link('../../docs/diagram.png', 'image')).toMatchObject({
			problem: expect.stringMatching(/is an image outside public\//)
		});
		expect(link('../../src/code.ts', 'link', { ...targets, repo: undefined })).toMatchObject({
			problem: expect.stringMatching(/site\.md has no repo/)
		});
		expect(link('../../../outside.md')).toMatchObject({
			problem: expect.stringMatching(/isn't there/)
		});
	});
});

describe('renderedLinkProblem', () => {
	const check = (html: string) => renderedLinkProblem(targets, '/blog/hello/', html);

	test('passes URLs the site serves, relative ones read from the page', () => {
		expect(
			check(
				'<a href="/">Home</a> <a href="../hello/#top">Me</a> <img src="/logo.svg"> ' +
					'<a href="/sitemap.xml">Map</a> <a href="https://example.com">Out</a> <a href="#x">X</a>'
			)
		).toBeUndefined();
	});

	test('names the first broken link, whoever wrote it', () => {
		expect(check('<nav><a href="/">Home</a> <a href="/posts/">Posts</a></nav>')).toBe(
			'href="/posts/": /posts/ isn\'t a page or a file in public/. Link to one that is, or write a page elsewhere on this domain in full, starting https://'
		);
		expect(check('<a href="/blog/draft/">Soon</a>')).toMatch(/is a draft/);
	});

	test('reads links from tags only, not from text or code that shows one', () => {
		// As Svelte renders <code>{'<a href="guide">'}</code>: text escapes only `<` and `&`.
		expect(check('<p>Write <code>&lt;a href="guide"></code>.</p>')).toBeUndefined();
		expect(check('<script>const a = \'<a href="guide">\';</script>')).toBeUndefined();
		expect(check('<p title="a > b"><a href="/posts/">Posts</a></p>')).toMatch(/^href="\/posts\/"/);
		expect(check('<script src="/app.js"></script>')).toMatch(/^src="\/app\.js"/);
	});

	test('asks for the URL as served, not one a host redirects', () => {
		expect(check('<a href="/blog/hello">Me</a>')).toBe(
			'href="/blog/hello": /blog/hello is served at /blog/hello/. Write that, so no host has to redirect it.'
		);
	});
});
