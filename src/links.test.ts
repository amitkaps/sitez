import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { linkTarget, type LinkKind, type LinkTargets } from './links.ts';

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
	])
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
