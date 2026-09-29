import { parse } from 'markz';
import { describe, expect, test } from 'vite-plus/test';
import { patternMetadata, proseMetadata } from './metadata.ts';

describe('proseMetadata', () => {
	test('defaults the title to the first heading and the summary to the first paragraph', () => {
		const doc = parse('# Hello _there_\n\nThe first `post`.\n\nMore.\n');
		expect(proseMetadata('/hello/', doc)).toEqual({
			url: '/hello/',
			title: 'Hello there',
			summary: 'The first post.'
		});
	});

	test('keeps what the block says, and every other key', () => {
		const doc = parse(
			'---\ntitle: Short\nsummary: Brief.\ndate: 2026-09-01\ndraft: true\ntags: [a, b]\n---\n\n# Long title\n\nText.\n'
		);
		expect(proseMetadata('/x/', doc)).toEqual({
			url: '/x/',
			title: 'Short',
			summary: 'Brief.',
			date: '2026-09-01',
			draft: true,
			tags: ['a', 'b']
		});
	});

	test('looks only at the top level, where a reader starts', () => {
		const doc = parse('> # Quoted\n>\n> Quoted text.\n\n## Real\n\nReal text.\n');
		expect(proseMetadata('/x/', doc)).toMatchObject({ title: 'Real', summary: 'Real text.' });
	});

	test('leaves out what the page has none of', () => {
		const page = proseMetadata('/x/', parse('- a list\n'));
		expect(page.title).toBeUndefined();
		expect(page.summary).toBeUndefined();
	});
});

describe('patternMetadata', () => {
	test('is the exported metadata', () => {
		expect(patternMetadata('/blog/', { title: 'Blog', tags: ['x'] })).toEqual({
			url: '/blog/',
			title: 'Blog',
			tags: ['x']
		});
	});

	test("falls back to the first <h1>'s text", () => {
		const body =
			'<!--[--><h1 class="big">Tom &amp; <em>Jerry&#39;s</em>\n  page</h1><h1>Second</h1>';
		expect(patternMetadata('/', undefined, body).title).toBe("Tom & Jerry's page");
	});

	test('prefers the export to the <h1>', () => {
		expect(patternMetadata('/', { title: 'Set' }, '<h1>Heading</h1>').title).toBe('Set');
	});
});
